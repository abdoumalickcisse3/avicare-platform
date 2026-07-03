# Gestionnaire de catalogue générique (réglages)

**Date** : 2026-07-03
**Statut** : Validé (design) — en attente de relecture spec
**Périmètre** : Frontend uniquement (`web/`). **Aucun changement backend, aucune migration.**
**Contexte** : les pages `/reglages/[category]` sont des placeholders « Bientôt disponible ». Le backend expose déjà un catalogue générique par ferme (`GET/POST/DELETE /api/v1/farms/{farmId}/catalog/{category}`, lecture `settings:read`, écriture OWNER/MANAGER — gating posé au Sous-projet A-bis, cf. [[member_permission_enforcement_done]]). On construit un **manager générique** piloté par une config déclarative, câblé d'abord sur les catégories nettes.

> Sous-projet **B**. Suit A (provisioning membres) et A-bis (permissions). Sanitaire reste bespoke ; Stock/Ventes = lots séparés.

---

## 1. Problème & objectif

Les catégories du hub Réglages (`stock, lots, sanitaire, ventes, comptabilite`) pointent vers une page générique `[category]` qui n'affiche qu'un placeholder. Deux catégories correspondent proprement à un catalogue backend existant, sans page bespoke :

| Hub | Catégorie backend | `value` (JSONB) |
|---|---|---|
| **Lots** | `breeds` | `{label, type: "broiler"\|"layer", species: "poultry"}` |
| **Comptabilité** | `expense_categories` | `{label}` |

Objectif : un **composant manager réutilisable** qui liste/ajoute/édite/désactive les entrées d'une catégorie via les endpoints génériques existants, piloté par une **config déclarative par catégorie** (le `value` étant du JSONB libre). Ajouter une catégorie ultérieurement = ajouter une config, zéro nouveau code.

## 2. Décisions verrouillées

- **Scope de ce lot** : Lots (`breeds`) + Comptabilité (`expense_categories`). Sanitaire = bespoke inchangé. Stock (chevauche Stocks › Bibliothèque) et Ventes (aucune catégorie backend) = **non-objectifs**, lots séparés.
- **Config déclarative** : chaque catégorie décrite par un `CategoryConfig` (slug, catégorie backend, champs du `value`). Le manager ne connaît aucune catégorie en dur.
- **« Désactiver » un item plateforme** = le masquer de la liste de la ferme (`DELETE /{key}` → `farm_catalog_items.disabled`), **réversible** en le ré-ajoutant. Pas de toggle actif/inactif visible V1.
- **Aucun backend** : le `value` reste libre (pas de validation de schéma backend) ; la config front décrit les champs éditables.
- **Écriture réservée OWNER/MANAGER** : gating par **rôle de ferme** (pas `settings:write`, que MANAGER n'a pas). Un membre à qui `settings:read` a été accordé sur mesure (donc non OWNER/MANAGER) peut atteindre la page mais ne verra pas les actions d'écriture (le back renverrait 403 sinon).

## 3. Config déclarative

```ts
export interface FieldDescriptor {
  name: string;              // clé dans le value map (ex. "label", "type")
  label: string;             // libellé FR
  type: "text" | "select";
  required?: boolean;
  options?: { value: string; label: string }[]; // requis si type === "select"
  const?: string;            // valeur fixe injectée, non éditée (ex. species="poultry")
}

export interface CategoryConfig {
  slug: string;              // segment d'URL (ex. "lots")
  backendCategory: string;   // catégorie backend (ex. "breeds")
  title: string;
  description: string;
  labelField: string;        // champ servant de nom affiché (ex. "label")
  fields: FieldDescriptor[]; // champs éditables (hors const)
}
```

Registre `web/src/constants/catalogCategories.ts` :
- **Lots** : `{ slug:"lots", backendCategory:"breeds", labelField:"label", fields:[ {name:"label",label:"Nom",type:"text",required:true}, {name:"type",label:"Type",type:"select",required:true,options:[{value:"broiler",label:"Chair"},{value:"layer",label:"Ponte"}]}, {name:"species",label:"Espèce",type:"text",const:"poultry"} ] }`
- **Comptabilité** : `{ slug:"comptabilite", backendCategory:"expense_categories", labelField:"label", fields:[ {name:"label",label:"Libellé",type:"text",required:true} ] }`

Helper `getCategoryConfig(slug): CategoryConfig | undefined`.

## 4. Composants (frontend uniquement)

- **`store/api/catalogApi.ts`** (RTK Query, `baseApi.injectEndpoints`, tag `"Catalog"` — déjà dans `tagTypes`) :
  - `getCatalog({ farmId, category }): CatalogEntry[]` — `GET .../catalog/{category}`, `transformResponse: r => r.data`, `providesTags: [{type:"Catalog", id:`${farmId}-${category}`}]`.
  - `overrideCatalogEntry({ farmId, category, key, value }): CatalogEntry` — `POST .../catalog/{category}` body `{key, value}`, invalide le tag.
  - `deleteCatalogEntry({ farmId, category, key }): void` — `DELETE .../catalog/{category}/{key}`, invalide le tag.
  - Type `CatalogEntry { category: string; key: string; value: Record<string, unknown>; custom: boolean }`.

- **`hooks/useFarmRole.ts`** : `useFarmRole(farmId): FarmRole | null` — décode le JWT (réutilise `decodeJwtPayload` de A-bis) et renvoie `membership.farmRole`. Helper `canManageCatalog(role) = role === "OWNER" || role === "MANAGER"`.

- **`components/settings/CatalogEntryDialog.tsx`** : formulaire générique construit à partir de `config.fields`. `text` → `TextField` ; `select` → `TextField select` avec `options` ; les champs `const` ne sont pas affichés. Props `{ open, onClose, config, farmId, entry? }` (entry présent = édition). Soumission : construit `value` = `{ ...(entry?.value ?? {}), ...champsSaisis, ...consts }` (on part du `value` existant en édition pour **préserver les clés inconnues** — cf. §7 — puis on écrase les champs de la config et les consts) ; `key` = `entry.key` en édition, sinon `slugify(valeurDuLabelField)` ; appelle `overrideCatalogEntry`. Validation : champs `required` non vides (react-hook-form + zod, comme les dialogs existants).

- **`components/settings/CatalogManager.tsx`** : composant principal. Props `{ config: CategoryConfig; farmId: number }`.
  - `getCatalog` → tableau : colonne nom (`value[labelField]`), colonnes des autres champs non-const (valeur brute ou libellé d'option), badge « Personnalisé » si `custom`, sinon « Plateforme ».
  - Bouton « Ajouter » (si `canManageCatalog`) → `CatalogEntryDialog` (création).
  - Par ligne (si `canManageCatalog`) : « Modifier » → dialog en édition ; action de retrait — **« Supprimer »** si `custom`, **« Désactiver »** si plateforme — via `ConfirmDialog` puis `deleteCatalogEntry`.
  - États : skeleton en chargement ; vide → « Aucune entrée. Ajoutez la première. » ; erreurs via `useToast`/`apiErrorMessage`.

- **`app/(dashboard)/reglages/[category]/page.tsx`** : remplace le placeholder — résout `getCategoryConfig(slug)`. Si trouvé → rend `<CatalogManager config farmId />` (avec le fil d'Ariane existant). Sinon → conserve le placeholder « Bientôt disponible » (stock, ventes). `farmId` via `useSelectedFarm`.

## 5. Sémantique (backend existant, inchangé)

- **Liste** = vue effective fusionnée (`CatalogService.listForFarm`) : items plateforme actifs + overrides ferme (valeur remplacée) + ajouts custom (sans parent) ; disables masqués. Chaque entrée : `{category, key, value, custom}`.
- **Ajouter (custom)** → `POST {key: slugify(label), value}` ; si un item plateforme partage la clé, le backend le lie (devient un override) — acceptable et rare (slug de label).
- **Éditer un item plateforme** → `POST` même `key`, nouvelle `value` : override lié à la plateforme (`custom` reste `false` dans la liste).
- **Désactiver plateforme / supprimer custom** → même `DELETE /{key}` ; le libellé de l'action dépend de `custom`.

Note : `breeds` est consommé par l'élevage (création de lot lit le catalogue races). Désactiver/éditer une race change ce qui est sélectionnable — comportement voulu.

## 6. Tests (Vitest, patterns existants)

- `slugify` (pur) : minuscule, accents retirés, espaces → `-`, caractères spéciaux nettoyés.
- `catalogApi` : `getCatalog` (transformResponse déballe `data`) via stub `fetch`.
- `useFarmRole` : décode le rôle de la ferme ; ferme sans membership → `null`.
- `CatalogEntryDialog` : champs générés depuis la config (text/select), `const` injecté dans le `value` soumis et non affiché, `key` dérivée du label en création, `key` figée en édition ; champ requis bloque la soumission.
- `CatalogManager` : rendu du tableau (nom + badge custom/plateforme), « Ajouter » ouvre le dialog, action « Supprimer » (custom) vs « Désactiver » (plateforme) selon la ligne, actions masquées si `!canManageCatalog`.
- `reglages/[category]` : rend `CatalogManager` pour `lots`/`comptabilite`, placeholder pour un slug inconnu.
- Garde-fou : `tsc` 0, `lint` 0, `vitest` vert, `next build` OK.

## 7. Risques & mitigations

- **Collision de clé custom** (slug d'un label = clé d'un item plateforme) → le backend traite l'ajout comme un override de cet item plateforme. Rare ; acceptable ; documenté. (Amélioration V2 : préfixer les clés custom.)
- **Édge case droits** : un membre non-OWNER/MANAGER avec `settings:read` sur mesure atteint la page en lecture seule (actions d'écriture masquées via `useFarmRole`) ; toute écriture forcée renverrait 403 (back autorité).
- **JWT périmé** (rôle changé, token non rafraîchi) : borné par la rotation refresh, comme A-bis. Back autorité.
- **Champs `value` non décrits** : la config ne rend que ses `fields` ; d'éventuelles clés supplémentaires du `value` plateforme sont préservées en édition uniquement si on fusionne l'ancien `value` — **décision** : à l'édition, partir de `entry.value` et n'écraser que les champs de la config (préserver les clés inconnues comme `schedule_days` d'un vaccin — non concerné ici mais garantit la généricité).

## 8. Non-objectifs

Sanitaire (bespoke, inchangé) · Stock (chevauche Bibliothèque inventaire — lot séparé) · Ventes (nécessite une catégorie backend + migration seed — lot séparé) · réordonnancement des entrées · i18n des libellés plateforme · validation de schéma JSONB backend · gestion des `user_settings` (couche 3).
