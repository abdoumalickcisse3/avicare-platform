# Circuits de distribution — Design

> Sujet B du backlog « Réglages Stock & Vente ». Le Sujet A (Réglages Stock) est livré (PR #132).
> Décisions validées avec le client le 2026-07-18 : circuit sur **ventes ET commandes** ;
> exécution **spec → plan → subagent-driven**.

## Objectif

Permettre à une ferme de définir ses **circuits de distribution** (Détail, Grossiste, Restaurant,
Marché, Coopérative, + les siens) et de **taguer chaque vente et chaque commande** avec un circuit.
Le champ est capté dès maintenant pour être exploitable plus tard par une analytique « CA par
circuit » (hors périmètre de ce sujet).

## Hors périmètre (explicite)

- **Analytique « CA par circuit »** : viendra dans un sujet finance séparé. Ici on ne fait que
  **capter et afficher** le circuit. On n'ajoute aucun agrégat ni écran de reporting.
- Pas de circuit sur les livraisons (`deliveries`) ni sur les paiements : le circuit se décide à la
  vente / à la commande, la livraison hérite de sa commande.
- Pas de circuit obligatoire : le champ est **toujours optionnel** (une vente/commande peut n'avoir
  aucun circuit).

## Modèle de données

### Catalogue `sales_channels`

Nouvelle catégorie dans `catalog_items` (Décision 15 — pas de table dédiée, valeur en JSONB, lue via
`ParametersFacade`). Valeur : `{"label": "...", "wave": "V1"}` (comme `expense_categories`, +`wave`
pour cohérence avec le seed plateforme).

Seed plateforme (locale NULL), migration V29 :

| key | label |
|---|---|
| `retail` | Détail |
| `wholesale` | Grossiste |
| `restaurant` | Restaurant |
| `market` | Marché |
| `cooperative` | Coopérative |

Une ferme ajoute/masque/personnalise ses circuits via **Réglages › Ventes** (gestionnaire de
catalogue générique existant, exactement comme Lots / Comptabilité / Stock). Le libellé est le seul
champ éditable.

### Colonne `sales_channel_key`

Migration V29, colonne **nullable**, stockant la **clé** du circuit (pas le label — cohérent avec le
référencement par clé du reste du catalogue) :

- `ALTER TABLE sales ADD COLUMN sales_channel_key VARCHAR(80) NULL;`
- `ALTER TABLE orders ADD COLUMN sales_channel_key VARCHAR(80) NULL;`

Pas de FK (les catalogues sont référencés par clé, pas par FK — cf. `article_key`). Pas d'index
(V1 : volume faible, aucun filtre par circuit tant que l'analytique n'existe pas).

**Immuabilité Flyway** : V29 est une nouvelle migration, ne modifie aucune migration mergée.

## Backend — chaîne à traverser

Le circuit se thread de la requête jusqu'à l'entité, à l'identique pour ventes et commandes.

### Ventes (`sales`)

- `SaleRequest` : + `@Size(max = 80) String salesChannelKey` (optionnel).
- `SaleCommand` : + `String salesChannelKey`.
- `SaleService.record` : `sale.setSalesChannelKey(cmd.salesChannelKey())`.
- `Sale` (entité) : + `@Column(name = "sales_channel_key") private String salesChannelKey;`
- `SaleResponse` : + `String salesChannelKey` (+ mapping dans `from(...)`).

### Commandes (`orders`)

- `OrderDraftRequest` : + `@Size(max = 80) String salesChannelKey`.
- `OrderDraftCommand` : + `String salesChannelKey`.
- `OrderService` (création draft) : `order.setSalesChannelKey(cmd.salesChannelKey())`.
- `Order` (entité) : + colonne `sales_channel_key`.
- `OrderResponse` : + `String salesChannelKey` (+ mapping).

### Gating

`CatalogGate.moduleFor` : + `case "sales_channels" -> "module.commercial.basic"`. La route générique
`/catalog/sales_channels` exige donc le module commercial — même protection que santé et stock (fin
du bypass). Aucun changement sur les endpoints de vente/commande eux-mêmes (déjà gatés commercial).

## Frontend

### Réglages › Ventes

- `catalogCategories.ts` : nouvelle `CategoryConfig` `ventes` → `sales_channels`, un seul champ
  `label` (texte requis). La carte « Ventes » du hub mène désormais au gestionnaire fonctionnel.
- `CATEGORY_NAMES` / le hub : la carte Ventes existe déjà, plus de cul-de-sac.

### Capture du circuit

Un select **optionnel** « Circuit » alimenté par les circuits de la ferme (via
`listForFarm(farmId, 'sales_channels')` — un hook/endpoint RTK à réutiliser ou ajouter, type
`useListCatalogQuery('sales_channels')`), dans :

- le dialogue **Vente directe** (QuickSaleDialog) ;
- le formulaire de **création de commande**.

Vide par défaut (« — Aucun circuit — »). La clé choisie part dans `salesChannelKey` de la requête.

### Affichage

Le circuit (son **label**, résolu depuis le catalogue) affiché sur :

- le détail d'une vente ;
- le détail d'une commande.

Résolution clé → label côté frontend via la liste des circuits (le backend renvoie la clé ; le front
mappe vers le label courant). Si la clé n'a plus de correspondance (circuit supprimé), afficher la
clé brute en repli.

## Tests

- **Backend** : IT commercial — créer une vente et une commande avec `salesChannelKey`, vérifier
  qu'il est persisté et renvoyé dans la réponse ; `CatalogGateTest` — `sales_channels` →
  `module.commercial.basic` ; IT gating — sans `module.commercial.basic`, `POST /catalog/sales_channels`
  → 403 (réutiliser le pattern de `HealthFlowIT.genericCatalogRoute_cannotBypassHealthModuleGate`).
- **Frontend** : `catalogCategories.test` — `ventes` → `sales_channels` ; test du select Circuit
  dans QuickSaleDialog (choisir un circuit → présent dans la requête) ; affichage du circuit sur le
  détail vente.

## Contraintes du projet (rappel)

- Migration Flyway **immuable** (V29 nouvelle, rien de mergé modifié) ; snake_case pluriel ;
  `VARCHAR` + nullable.
- Pas de cross-import entre bounded contexts ; `CatalogGate` reste dépendance-free (réutilise
  `@features` en SpEL).
- DTO = records Java 21 ; `@Service` + `@RequiredArgsConstructor` ; champ optionnel donc pas de
  `@NotNull`.
- Commits sans signature Claude ; spotless avant commit ; `*IT` en CI only.
- Frontend : gestionnaire de catalogue générique réutilisé tel quel (pas de nouveau composant) ;
  MUI v9 ; « This is NOT the Next.js you know ».

## Livrables / séquencement pressenti (le plan détaillera)

1. Migration V29 (colonnes + seed `sales_channels`) + gating `CatalogGate`.
2. Backend ventes : DTO/Command/Service/entité/Response + IT.
3. Backend commandes : idem.
4. Frontend Réglages › Ventes (CategoryConfig).
5. Frontend capture (select Circuit dans vente directe + commande) + endpoint liste circuits.
6. Frontend affichage (détail vente + commande) + tests.
