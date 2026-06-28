# Synchronisation commercial ↔ stock de production

**Date** : 2026-06-28
**Statut** : Validé (design) — en attente de relecture spec
**Sprint** : amélioration d'intégrité métier (post-B5, hors plan dashboard)
**Périmètre** : Backend (livestock + commercial, sous-domaines plats de `livestock`) + Frontend (`web/`). Nouvelles migrations Flyway.

---

## 1. Contexte & problème

Aujourd'hui une ligne de vente/commande référence un **article** par `article_key` + `article_source ∈ {INVENTORY, TREATMENT}` + snapshot — **sans aucun lien avec un lot de production ni sa disponibilité réelle**. Conséquence : la **production de la ferme** (poulets de chair vivants d'un lot, œufs d'un lot pondeuse) n'est même pas une source vendable, et rien n'empêche de **survendre** ce qui n'existe pas.

Objectif demandé par l'utilisateur : le commercial doit être **synchronisé avec la production** — une **vente directe** ou une **commande** puise dans un **lot sélectionné**, et **on ne peut pas vendre ce qu'on n'a pas** dans le lot, que ce soit du **poulet de chair** ou des **œufs**.

## 2. Objectif & non-objectifs

**Objectif** : introduire la **production comme source vendable liée à un lot**, avec contrôle de disponibilité **bloquant** et décrément atomique du stock de production à la sortie des marchandises.

**Non-objectifs (hors périmètre V1)** :
- Vente de chair au **poids (kg)** (V1 = à la tête).
- **Unités configurables** / paramétrage des unités.
- Prix par **grade** d'œuf.
- **Réservation** de stock (commande ne réserve pas).
- Rollup multi-ferme ; modifications de migrations existantes (immuables).

## 3. Décisions verrouillées

- **D27 — Vente de production BLOQUANTE** : si quantité demandée > disponible, la vente/livraison est **refusée** (`BusinessRuleException`, HTTP 422). *Distinct de D19 (insuffisance d'intrants inventaire = non-bloquant, qui reste inchangé pour `INVENTORY`/`TREATMENT`). D27 s'applique uniquement à la source `PRODUCTION`.*
- **Source de vérité du stock de production = domaine élevage** ; le commercial le consomme via `LivestockFacade` (pas de cross-import ; commercial et livestock sont des sous-domaines plats de `livestock`).
- **Chair** : stock = `production_units.current_count` (existant). **Œufs** : nouveau **solde matérialisé `eggs_available`** par lot pondeuse.
- **Unités** : chair = **tête** (1 tête → `current_count −1`) ; œufs = **plateau de 30** (1 plateau → `eggs_available −30`). Conversion fixe ×30 vers la **base** (œufs).
- **Timing** : vente directe = contrôle + décrément immédiats ; commande = check indicatif à la saisie + check **bloquant** + décrément à la **livraison** ; annulation = restock. **Pas de réservation.**

## 4. Modèle de données (migrations Flyway nouvelles, immuables)

1. **Solde d'œufs** : `eggs_available INTEGER NOT NULL DEFAULT 0 CHECK (eggs_available >= 0)` sur le lot pondeuse (table `poultry_layer_batches` ou équivalent — à confirmer à l'implémentation en lisant V8). Incrémenté à la clôture d'une `daily_egg_productions` des **œufs bons** = `total_eggs_collected − total_broken_eggs`. Décrémenté par la vente.
2. **Lignes de vente/commande/livraison** : sur `sale_items`, `order_items`, `delivery_items` :
   - étendre le CHECK `article_source` pour inclure **`PRODUCTION`** ;
   - ajouter `production_unit_id BIGINT NULL REFERENCES production_units(id)` (renseigné si `article_source = 'PRODUCTION'`) ;
   - ajouter `product_type VARCHAR(20) NULL CHECK (product_type IN ('BROILER','EGGS'))` (idem) ;
   - l'`unit` existant porte `tête`/`plateau` ; la `quantity` existante porte le nombre de têtes / de plateaux.
   - index sur `production_unit_id`.

Cohérence : `article_source = 'PRODUCTION'` ⇒ `production_unit_id` et `product_type` non nuls (validé applicativement ; les colonnes restent nullables pour les sources INVENTORY/TREATMENT existantes).

## 5. API interne — `LivestockFacade` (production stock)

Le domaine élevage expose (lecture + écriture transactionnelle) :
- `long productionAvailableBase(Long farmId, Long unitId, ProductType type)` — base disponible (têtes ou œufs) ; valide que l'unité appartient à la ferme et correspond au type.
- `void consumeProduction(Long farmId, Long unitId, ProductType type, long qtyBase)` — décrémente atomiquement (`current_count` ou `eggs_available`) ; **lève `BusinessRuleException` (422) si `qtyBase > disponible`** ; journalise un `LifecycleEvent` (raison `SALE`) pour la chair.
- `void restockProduction(Long farmId, Long unitId, ProductType type, long qtyBase)` — réincrémente (annulation de vente/livraison) ; journalise (raison `SALE_CANCEL`).

`qtyBase` = `quantity` (têtes) pour BROILER ; `quantity × 30` (œufs) pour EGGS. La conversion plateau→œufs est faite par l'appelant commercial (ou par la façade via `unit`/type — fixée à l'implémentation, fonction pure testable `toBaseQuantity(type, unit, quantity)`).

Réutilise les garde-fous existants de `LivestockService` (jamais `current_count < 0`, pas d'opération sur unité CLOSED/CANCELLED → 422) et la mécanique atomique du `StockConsumptionService` (D18).

## 6. Flux commercial (intégration)

- **Clôture production œufs** : à la clôture d'une `daily_egg_productions`, `eggs_available += (collectés − cassés)` du lot. (Hook côté layer service.)
- **Vente directe** (`SaleService`) : pour chaque ligne `PRODUCTION`, dans la **même transaction** que la vente : `consumeProduction(...)` (bloquant). Échec d'une ligne ⇒ rollback de toute la vente.
- **Commande** (`OrderService`) : à la saisie/draft, **check indicatif** de dispo (n'empêche pas de créer la commande, signale) ; **aucun** décrément.
- **Livraison** (`DeliveryService`) : pour chaque ligne `PRODUCTION` livrée, **check bloquant + `consumeProduction`** dans la transaction de livraison (là où l'OUT inventaire se fait déjà pour `INVENTORY`).
- **Annulation** d'une vente / d'une livraison déjà décrémentée : `restockProduction(...)` pour chaque ligne `PRODUCTION` (réincrémente), atomique.
- Les sources `INVENTORY`/`TREATMENT` conservent leur comportement actuel (D18/D19 inchangés).

## 7. Frontend

- **Vente rapide** (`QuickSaleDialog`) et **OrderDialog** : à l'ajout d'une ligne, choix du **type de source** ; pour `PRODUCTION`, sélecteur du **lot** (unités actives de la ferme, via l'endpoint élevage existant `GET /farms/{id}/production-units`) + **type produit** (déduit de l'espèce du lot : chair→BROILER, pondeuse→EGGS) + **unité** (tête/plateau) + quantité.
- **Disponibilité affichée** à côté du sélecteur (têtes restantes / plateaux disponibles = `eggs_available / 30`), et **garde front** quantité ≤ dispo (le **422 backend reste la garde réelle**, cohérent avec le reste du front).
- Pas de rôle-ferme exposé au front.

## 8. Découpage en livraisons (PRs) — 1 PR par phase

- **P1 — Stock de production (élevage)** : migration `eggs_available` + incrément à la clôture des productions journalières ; `ProductType` enum ; `LivestockFacade` `productionAvailableBase` / `consumeProduction` / `restockProduction` (bloquant, atomique, réversible) + décrément chair via `LifecycleEvent` ; `toBaseQuantity` (pur, testé). Tests unit + IT (CI).
- **P2 — Intégration commerciale** : migration items (`PRODUCTION` source + `production_unit_id` + `product_type`) ; wiring `SaleService`/`OrderService`/`DeliveryService`/annulations vers la façade ; validation cohérence ligne ; endpoints REST inchangés en surface (mêmes routes, payload enrichi). Tests unit + IT.
- **P3 — Frontend** : sélecteur de lot + type produit + dispo dans Vente rapide & OrderDialog ; types & slices RTK Query ; tests composant.

## 9. Tests

- **Pur** : `toBaseQuantity(type, unit, quantity)` (tête→×1, plateau→×30) ; conversions et bornes.
- **Élevage (IT Testcontainers, CI)** : `eggs_available` incrémenté à la clôture (bons œufs) ; `consumeProduction` décrémente / **bloque à 422 si insuffisant** / refuse unité CLOSED ; `restockProduction` réincrémente ; chair `current_count` décrémenté + `LifecycleEvent` SALE.
- **Commercial (IT, CI)** : vente directe production décrémente atomiquement + rollback si une ligne dépasse ; livraison décrémente, annulation restocke ; commande draft ne décrémente pas.
- **Frontend (Vitest)** : sélecteur de lot rendu, dispo affichée, garde quantité ≤ dispo.
- Garde-fou : `mvn verify` + suite web verte ; `npm run lint` projet entier.

## 10. Risques & mitigations

- **Atomicité multi-lignes** : tout le décrément production d'une vente/livraison dans **une** transaction ; rollback global si une ligne échoue (pattern `StockConsumptionService` D18).
- **Concurrence / survente entre deux ventes simultanées** : le décrément `current_count`/`eggs_available` se fait sous transaction ; le `CHECK (>= 0)` DB + la vérification applicative empêchent le négatif (la 2e transaction échoue). Verrou pessimiste seulement si la contention s'avère réelle (V1 : pas de verrou).
- **Cohérence `eggs_available` vs historique** : alimenté uniquement à la clôture des productions journalières et par ventes/annulations ; pas de recalcul rétroactif V1 (un script de backfill pourra initialiser le solde si nécessaire).
- **Espèce du lot ↔ product_type** : la façade valide que le type demandé correspond à l'espèce de l'unité (chair⇒BROILER, pondeuse⇒EGGS) → 422 sinon.
- **D27 vs D19** : bien cloisonner — D27 (bloquant) ne s'applique qu'à `PRODUCTION` ; `INVENTORY`/`TREATMENT` restent non-bloquants (D19).
