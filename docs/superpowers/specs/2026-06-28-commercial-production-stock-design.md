# Synchronisation commercial ↔ stock de production

**Date** : 2026-06-28
**Statut** : Validé (design, révisé v2) — en attente de relecture spec
**Sprint** : amélioration d'intégrité métier (post-B5, hors plan dashboard)
**Périmètre** : Backend (livestock + commercial, sous-domaines plats de `livestock`) + Frontend (`web/`). Nouvelles migrations Flyway.

> **Révision v2** : le modèle œufs réutilise le `egg_tray_stocks` existant (plateaux pleins, par ferme) au lieu d'un nouveau solde par lot — voir §3/§4.

---

## 1. Contexte & problème

Aujourd'hui une ligne de vente/commande référence un **article** par `article_key` + `article_source ∈ {INVENTORY, TREATMENT}` + snapshot — **sans aucun lien avec un lot de production ni sa disponibilité réelle**. Conséquence : la **production de la ferme** (poulets de chair vivants d'un lot, œufs) n'est même pas une source vendable, et rien n'empêche de **survendre** ce qui n'existe pas.

Objectif demandé par l'utilisateur : le commercial doit être **synchronisé avec la production** — une **vente directe** ou une **commande** puise dans la production réelle, et **on ne peut pas vendre ce qu'on n'a pas**, que ce soit du **poulet de chair** (par lot) ou des **œufs** (en plateaux).

## 2. Objectif & non-objectifs

**Objectif** : introduire la **production comme source vendable**, avec contrôle de disponibilité **bloquant** et décrément atomique du stock de production à la sortie des marchandises.

**Non-objectifs (hors périmètre V1)** :
- Vente de chair au **poids (kg)** (V1 = à la tête).
- **Unités configurables** / paramétrage des unités.
- Prix par **grade** d'œuf ; gestion des œufs en vrac (< 1 plateau) — voir limite §10.
- **Réservation** de stock (commande ne réserve pas).
- Stock d'œufs **par lot** (les œufs sont mis en commun au niveau ferme — §3).
- Rollup multi-ferme ; modifications de migrations existantes (immuables).

## 3. Décisions verrouillées

- **D27 — Vente de production BLOQUANTE** : si quantité demandée > disponible, la vente/livraison est **refusée** (`BusinessRuleException`, HTTP 422). *Distinct de D19 (insuffisance d'intrants inventaire = non-bloquant, inchangé pour `INVENTORY`/`TREATMENT`). D27 s'applique uniquement à la source `PRODUCTION`.*
- **Source de vérité du stock de production = domaine élevage** ; le commercial le consomme via `LivestockFacade` (pas de cross-import ; commercial et livestock sont des sous-domaines plats de `livestock`).
- **Chair (par lot)** : stock = `production_units.current_count` (existant). Vendre N têtes → `current_count −= N`.
- **Œufs (par ferme, en plateaux)** : stock = **`egg_tray_stocks.full_trays_count` existant** (réutilisé). Vendre N plateaux → `full_trays_count −= N`. **Auto-alimenté** : à la clôture d'une `daily_egg_productions`, `full_trays_count += floor((collectés − cassés) / 30)`. Une seule source de vérité œufs (pas de stock parallèle). Les œufs ne sont **pas** suivis par lot (mise en commun ferme).
- **Unités** : chair = **tête** ; œufs = **plateau de 30**. Le stock œufs étant déjà en plateaux, **aucune conversion ×30 à la vente** (décrément direct en plateaux). La conversion ×30 n'intervient qu'à l'**auto-alimentation** (œufs → plateaux, division entière).
- **Timing** : vente directe = contrôle + décrément immédiats ; commande = check indicatif à la saisie + check **bloquant** + décrément à la **livraison** ; annulation = restock. **Pas de réservation.**

## 4. Modèle de données (migrations Flyway nouvelles, immuables — dernière migration = V23, donc V24+)

1. **Œufs** : **aucune nouvelle table/colonne de stock** — réutilisation de `egg_tray_stocks.full_trays_count` (V8). (L'auto-alimentation et le décrément sont applicatifs, §5/§6.)
2. **Lignes de vente/commande/livraison** — migration sur `sale_items`, `order_items`, `delivery_items` :
   - étendre le CHECK **inline** `article_source` (actuellement `IN ('INVENTORY','TREATMENT')`, défini par table en V20/V21) pour inclure **`PRODUCTION`** : `ALTER TABLE … DROP CONSTRAINT <auto-name> ; ADD CONSTRAINT … CHECK (article_source IN ('INVENTORY','TREATMENT','PRODUCTION'))`. (Le nom auto-généré du CHECK inline doit être relevé via `information_schema`/`\d` à l'écriture de la migration ; alternative robuste : recréer la contrainte nommée.)
   - ajouter `production_unit_id BIGINT NULL REFERENCES production_units(id)` — **renseigné pour BROILER** (le lot), **null pour EGGS** (pool ferme) ;
   - ajouter `product_type VARCHAR(20) NULL CHECK (product_type IN ('BROILER','EGGS'))` — non nul si `article_source='PRODUCTION'` ;
   - `unit` existant porte `tête`/`plateau` ; `quantity` existante porte le nombre de têtes / de plateaux ;
   - index sur `production_unit_id`.

Cohérence (validée applicativement) : `article_source='PRODUCTION'` ⇒ `product_type` non nul ; `BROILER` ⇒ `production_unit_id` non nul ; `EGGS` ⇒ `production_unit_id` null.

## 5. API interne — `LivestockFacade` (production stock)

Le domaine élevage expose (lecture + écriture transactionnelle), avec un enum public `ProductType { BROILER, EGGS }` :
- `long productionAvailable(Long farmId, ProductType type, Long unitId)` — disponible (têtes du lot pour BROILER ; `full_trays_count` de la ferme pour EGGS, `unitId` ignoré/null). Valide l'appartenance ferme et la cohérence type↔espèce du lot pour BROILER.
- `void consumeProduction(Long farmId, ProductType type, Long unitId, long qty)` — décrémente atomiquement (`current_count` du lot pour BROILER ; `full_trays_count` de la ferme pour EGGS) ; **lève `BusinessRuleException` (422) si `qty > disponible`** ; pour BROILER, journalise un `LifecycleEvent` (raison `SALE`) et applique les garde-fous `LivestockService` (jamais `< 0`, pas d'opération sur unité CLOSED/CANCELLED → 422).
- `void restockProduction(Long farmId, ProductType type, Long unitId, long qty)` — réincrémente (annulation vente/livraison) ; pour BROILER, journalise (raison `SALE_CANCEL`).
- **Auto-alimentation œufs** : à la clôture d'une production journalière, `EggTrayStockService.adjustStock(farmId, fullDelta = floor((collectés − cassés)/30), 0)`. (Hook côté layer service de clôture.)

`qty` est exprimé dans l'unité de stock : **têtes** (BROILER) ou **plateaux** (EGGS). Pas de conversion à la vente. Fonction pure testable `goodEggsToTrays(collected, broken) -> floor(max(collected − broken, 0)/30)` pour l'auto-alimentation.

## 6. Flux commercial (intégration)

- **Clôture production œufs** : `full_trays_count += goodEggsToTrays(...)` (même transaction que la clôture).
- **Vente directe** (`SaleService`) : pour chaque ligne `PRODUCTION`, dans la **même transaction** que la vente : `consumeProduction(...)` (bloquant). Échec d'une ligne ⇒ rollback de toute la vente.
- **Commande** (`OrderService`) : à la saisie/draft, **check indicatif** (`productionAvailable`) ; **aucun** décrément.
- **Livraison** (`DeliveryService`) : pour chaque ligne `PRODUCTION` livrée, **check bloquant + `consumeProduction`** dans la transaction de livraison (là où l'OUT inventaire se fait déjà).
- **Annulation** d'une vente / livraison déjà décrémentée : `restockProduction(...)` par ligne `PRODUCTION`, atomique.
- Les sources `INVENTORY`/`TREATMENT` conservent leur comportement (D18/D19 inchangés).

## 7. Frontend

- **Vente rapide** (`QuickSaleDialog`) et **OrderDialog** : à l'ajout d'une ligne, choix de la source ; pour `PRODUCTION`, choix du **type produit** : **Chair (lot)** → sélecteur du **lot** (unités chair actives via `GET /farms/{id}/production-units`) avec **têtes restantes** affichées ; **Œufs (plateaux)** → pas de lot, **plateaux disponibles** affichés (= `full_trays_count`). Unité déduite (tête / plateau), quantité, garde front ≤ dispo (le **422 backend reste la garde réelle**).
- Pas de rôle-ferme exposé au front.

## 8. Découpage en livraisons (PRs) — 1 PR par phase

- **P1 — Stock de production (élevage)** : enum `ProductType` ; `goodEggsToTrays` (pur, testé) ; auto-alimentation `full_trays_count` à la clôture des productions journalières ; `LivestockFacade` `productionAvailable` / `consumeProduction` / `restockProduction` (BROILER via `current_count`+`LifecycleEvent`, EGGS via `egg_tray_stocks`), bloquant/atomique/réversible. Tests unit + IT (CI). *(Pas de migration ici — réutilise l'existant.)*
- **P2 — Intégration commerciale** : migration V24 (items : `PRODUCTION` + `production_unit_id` + `product_type`) ; wiring `SaleService`/`OrderService`/`DeliveryService`/annulations vers la façade ; validation cohérence ligne. Endpoints REST : mêmes routes, payload enrichi. Tests unit + IT.
- **P3 — Frontend** : sélecteur type produit + lot (chair) / plateaux dispo (œufs) dans Vente rapide & OrderDialog ; types & slices RTK Query ; tests composant.

## 9. Tests

- **Pur** : `goodEggsToTrays(collected, broken)` (ex. 95,5 → 3 ; cassés ≥ collectés → 0 ; bornes).
- **Élevage (IT Testcontainers, CI)** : `full_trays_count` incrémenté à la clôture (floor des bons œufs/30) ; `consumeProduction` BROILER décrémente `current_count` + `LifecycleEvent` SALE / EGGS décrémente `full_trays_count` ; **blocage 422 si insuffisant** (chair et œufs) ; refus unité CLOSED ; `restockProduction` réincrémente (les deux types).
- **Commercial (IT, CI)** : vente directe production décrémente atomiquement + rollback si une ligne dépasse ; livraison décrémente, annulation restocke ; commande draft ne décrémente pas ; cohérence ligne (PRODUCTION ⇒ product_type ; BROILER ⇒ unit ; EGGS ⇒ pas d'unit) → 422 sinon.
- **Frontend (Vitest)** : sélecteur type produit/lot rendu ; dispo affichée (têtes / plateaux) ; garde quantité ≤ dispo.
- Garde-fou : `mvn verify` + suite web verte ; `npm run lint` projet entier ; **`spotless:apply -pl avicare-app` avant commit** (gate CI).

## 10. Risques & mitigations

- **Atomicité multi-lignes** : tout le décrément production d'une vente/livraison dans **une** transaction ; rollback global si une ligne échoue (pattern `StockConsumptionService` D18).
- **Concurrence / survente simultanée** : décrément sous transaction ; `CHECK (>= 0)` DB + vérif applicative empêchent le négatif (la 2e transaction échoue). Verrou pessimiste seulement si contention réelle (V1 : sans verrou).
- **Œufs en vrac (reste < 30) à l'auto-alimentation** : division entière → jusqu'à 29 œufs/jour non comptabilisés en plateaux (V1). Acceptable ; un compteur d'œufs en vrac pourra être ajouté plus tard. `empty_trays_count` non touché par l'auto-alimentation V1.
- **Cohérence `full_trays_count` historique** : alimenté par auto (clôtures futures) + ventes/annulations + saisie manuelle existante ; pas de backfill rétroactif V1.
- **Espèce du lot ↔ product_type** (BROILER) : la façade valide que le lot est bien une unité chair → 422 sinon.
- **D27 vs D19** : cloisonnés — D27 (bloquant) seulement pour `PRODUCTION` ; `INVENTORY`/`TREATMENT` restent non-bloquants (D19).
