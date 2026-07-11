# Stock › Bibliothèque — articles personnalisés (CRUD) — Design

**Date :** 2026-07-11
**Contexte :** Bug #4 du backlog de test. La page **Stock › Bibliothèque**
(`web/src/app/(dashboard)/stocks/articles/page.tsx`) liste le catalogue plateforme des
articles stockables (read-only) ; le bouton « Nouvel article » est **désactivé** (« arrive en V2 »).
Objectif : permettre à une ferme de **créer / modifier / supprimer ses propres articles**.

## Décisions verrouillées (brainstorming)

- Portée : **CRUD complet** sur les articles **personnalisés** (ferme). Les articles **plateforme
  restent en lecture seule**.
- Source des articles custom = **INVENTORY** uniquement (les médicaments/vaccins viennent du
  catalogue sanitaire — hors périmètre).
- Réutilise le mécanisme de paramétrage 3 couches existant : les articles sont des `catalog_items`
  de catégorie `inventory_items` ; un article custom ferme est une entrée `farm_catalog_items`
  sans parent plateforme.

## Architecture existante (réutilisée)

- **Endpoint create/edit/delete déjà présent** : `FarmCatalogController`
  (`/api/v1/farms/{farmId}/catalog/{category}`) —
  - `POST` (`{key, value}`) → `catalogService.override(...)` (upsert : crée OU remplace), RBAC
    **OWNER/MANAGER** ;
  - `DELETE /{key}` → supprime la ligne farm (custom) / disable, RBAC **OWNER/MANAGER** ;
  - lecture `settings:read`.
- `CatalogService.listForFarm(farmId, category)` fusionne plateforme + `farm_catalog_items`
  (override, disable, ajout custom) et marque chaque entrée `custom = (catalogItemId == null)`.
- `CatalogEntryInfo(category, key, value, custom)` porte déjà le flag `custom`.
- Frontend : `catalogApi` (`overrideCatalogEntry`, `deleteCatalogEntry`), `lib/slug.ts`
  (slugify), `useFarmRole` (gating rôle).

## Backend (petit — aucune migration, aucun nouvel endpoint)

### `InventoryCatalogItemDto` — ajout du flag `custom`

Ajouter `boolean custom` (dernier composant). Les médicaments (TREATMENT) → `custom = false`.

### `InventoryCatalogService` — lecture fusionnée

- `listInventoryArticles(Long farmId)` : remplacer `parametersFacade.listPlatform("inventory_items")`
  par `parametersFacade.listForFarm(farmId, "inventory_items")`, et propager `e.custom()` dans le DTO.
- `listAllAvailableArticles(Long farmId)` (utilisé par les pickers mouvement/BC) : idem, pour que les
  articles custom soient sélectionnables.
- `toInventoryDto` reçoit le `custom` du `CatalogEntryInfo`. Value JSONB lue :
  `{label, subcategory, unit, typical_unit_price_xof}` (clés inchangées).
- Le contrôleur (`InventoryCatalogController`) passe déjà `farmId` aux endpoints `/articles` et
  `/articles/all` → propager `farmId` aux méthodes du service.

> Aucun changement au flux de création : il passe par `FarmCatalogController` existant.

## Frontend

### Type + API

- `InventoryCatalogItem` (`@/types`) : ajouter `custom: boolean`.
- `inventoryCatalogApi` : ajouter trois mutations qui invalident le tag `InventoryCatalog`
  (`articles` **et** `all`) :
  - `createArticle({ farmId, key, value })` → `POST /catalog/inventory_items` `{key, value}`
  - `updateArticle({ farmId, key, value })` → même `POST` (upsert, key fixe)
  - `deleteArticle({ farmId, key })` → `DELETE /catalog/inventory_items/{key}`
  (Un endpoint dédié n'est pas requis : on tape le `FarmCatalogController` ; l'invalidation vise le
  tag lu par la Bibliothèque, pas le tag générique `Catalog`.)

### `ArticleDialog` (création / édition)

Champs :
- **Libellé** (`label`, requis).
- **Sous-catégorie** (`subcategory`, menu) — valeurs `FEED`/`CONSUMABLE`/`EQUIPMENT`/`PRODUCT`,
  libellés FR : Aliment / Consommable / Équipement / Produit.
- **Unité** (`unit`, texte libre : kg, sac, L, unité, plateau…).
- **Prix moyen (XOF)** (`typical_unit_price_xof`, entier, optionnel).

Comportement :
- Création : `key = slugify(label)` (via `lib/slug.ts`) ; refuser un doublon de key
  (message si l'article existe déjà). Édition : `key` fixe, champs pré-remplis, `label`/`subcategory`/
  `unit`/`price` modifiables.
- Submit : construit `value = { label, subcategory, unit, typical_unit_price_xof }` (omettre le prix
  s'il est vide) → `createArticle`/`updateArticle`. Fermeture + refresh à la réussite.
- Le dialog est piloté par edge-trigger sur `open` (reset des champs à l'ouverture — cf. leçon
  `member_access_customization`).

### Page Bibliothèque

- Bouton **« Nouvel article »** : activé si `useFarmRole` = OWNER/MANAGER (sinon masqué/désactivé
  avec tooltip). Ouvre `ArticleDialog` en mode création.
- Table : colonne d'actions à droite. Sur une ligne **`custom`** → puce « Perso » + boutons
  **éditer** (ouvre `ArticleDialog` en édition) et **supprimer** (ouvre une confirmation →
  `deleteArticle`). Lignes plateforme → aucune action (lecture seule).
- Le filtre par sous-catégorie (chips) fonctionne tel quel pour les articles custom.

## Tests

- **Backend** : `InventoryCatalogService.listInventoryArticles(farmId)` fusionne plateforme + custom
  et positionne `custom` correctement (test avec façade mockée ou IT Testcontainers avec un
  `farm_catalog_items` custom + un article plateforme).
- **Frontend** :
  - `ArticleDialog` — création : payload exact `{ key: slug, value: {label, subcategory, unit,
    typical_unit_price_xof} }` ; édition : key inchangée, valeurs pré-remplies ; prix omis si vide.
  - Page — bouton « Nouvel article » activé pour OWNER (et masqué/désactivé pour un rôle FARMER) ;
    une ligne custom affiche la puce « Perso » + actions ; une ligne plateforme n'a pas d'actions ;
    suppression demande confirmation.

## Hors périmètre (V1)

- Articles **médicaments/TREATMENT** custom (catalogue sanitaire séparé).
- Édition/suppression des articles **plateforme** (seul un `disable` existe côté backend, différé).
- La page détail `stocks/articles/[id]` (inchangée).
- Unicité forte de la key côté backend (l'`override` est un upsert ; le frontend prévient le
  doublon avant envoi).

## Contraintes globales

- Aucune signature Claude/AI dans les commits ; Conventional Commits, scope bounded-context
  (`feat(livestock:inventory)`, `feat(web)`).
- Branch protection → PR + `gh pr merge --rebase --delete-branch`.
- Pas de cross-import entre bounded contexts — façades publiques ; l'inventaire lit le catalogue via
  `ParametersFacade`.
- RBAC : create/edit/delete = OWNER/MANAGER (déjà enforce côté endpoint) ; l'UI gate le bouton/les
  actions en miroir via `useFarmRole`.
- `*IT` Testcontainers = CI only (Docker local indisponible).
- Spotless Google Java Format avant commit backend ; vitest + `npm run lint` côté frontend.
- Web : « This is NOT the Next.js you know » — consulter `web/node_modules/next/dist/docs/` au besoin.
- MUI est **v9** dans ce repo (pas v7 — cf. leçon `member_access_customization`).
