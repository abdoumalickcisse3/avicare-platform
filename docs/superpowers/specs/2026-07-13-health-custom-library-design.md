# Réglage sanitaire — vaccins & traitements custom (CRUD) — Design

**Date :** 2026-07-13
**Contexte :** Bug #7 du backlog de test. La page **Réglages › Sanitaire**
(`web/src/components/health/HealthLibraryView.tsx`) affiche vaccins / traitements / programmes en
**lecture seule** (note « L'édition de votre bibliothèque personnalisée arrivera prochainement »)
et un annuaire vétérinaire déjà en CRUD. Le backend `HealthCatalogService` lit uniquement
`parametersFacade.listPlatform(...)` — son Javadoc annonce même « custom vaccines… come in B3-2 »,
jamais fait. Objectif : permettre à une ferme de **créer / modifier / supprimer ses propres vaccins
et traitements**. Réplique du pattern #4 (articles d'inventaire custom).

## Décisions verrouillées (brainstorming)

- Portée : **CRUD complet** sur les **vaccins** (`vaccines`) et **traitements** (`treatments`)
  **personnalisés** (ferme). Les entrées **plateforme restent en lecture seule**.
- **Hors périmètre** : programmes vaccinaux custom (édition de calendrier = lourd) ; vétos (déjà
  CRUD) ; édition/désactivation des entrées plateforme.
- **Champs des formulaires (choix « essentiels + délais d'attente ») :**
  - Vaccin : **Nom** (`label`, requis), **Maladie** (`disease`, texte), **Voie** (`route`, select).
  - Traitement : **Nom** (`label`, requis), **Molécule** (`molecule`, texte), **Voie(s)**
    (`routes`, multi-select), **Délai viande** (`withdrawal_days_meat`, entier j), **Délai œufs**
    (`withdrawal_days_eggs`, entier j).
  - Champs non exposés (restent absents des customs) : vaccin `active_strain`/`usage`, traitement
    `class`/`wave`.
- **Gating par module (parité lecture/écriture)** : les écritures passent par des endpoints santé
  gétés au même niveau que les lectures — vaccins = `module.health.basic`, traitements =
  `module.health.advanced` — **pas** par le `FarmCatalogController` générique (gété OWNER/MANAGER
  sans garde module). Leçon de parité de gating (cf. le bug de gating rattrapé en #6).

## Architecture existante (réutilisée)

- `CatalogService` (contexte `parameters`) : `override(farmId, category, key, value) → FarmCatalogItem`
  (upsert ; `catalogItemId == null` ⇒ custom pur) et `disable(farmId, category, key)` (retire
  l'entrée de `listForFarm`, qui filtre les désactivées). C'est le mécanisme utilisé par
  `FarmCatalogController` en #4.
- `ParametersFacadeImpl` a déjà `CatalogService` injecté ; la façade `ParametersFacade` est
  aujourd'hui **en lecture seule** (`resolve`, `resolveAs`, `listForFarm`, `listPlatform`).
- `HealthCatalogService.listVaccines()/listTreatments()` mappent `CatalogEntryInfo` → `VaccineDto`/
  `TreatmentDto` ; `CatalogEntryInfo(category, key, value, boolean custom)` porte déjà `custom`.
- `HealthAccess` porte les constantes SpEL : `READ_BASIC`, `READ_ADVANCED`, `WRITE_BASIC_MANAGER`
  (module.health.basic + OWNER/MANAGER), `WRITE_ADVANCED_MANAGER` (module.health.advanced +
  OWNER/MANAGER).
- Frontend : `useFarmRole`/`canManageCatalog` (gating rôle, #4), `lib/slug.ts` (`slugify`, #4),
  `HealthLibraryView` (onglets + annuaire véto CRUD comme gabarit), `healthApi` (RTK Query).

## Backend

### `ParametersFacade` — surface d'écriture (nouveau)

Ajouter deux méthodes à l'interface + impl (délégation à `CatalogService`) :
- `CatalogEntryInfo override(Long farmId, String category, String key, Map<String,Object> value)` →
  `catalogService.override(...)`, puis mapper `FarmCatalogItem` → `CatalogEntryInfo`
  (`custom = catalogItemId == null`).
- `void delete(Long farmId, String category, String key)` → `catalogService.disable(...)`.

> Écriture cross-context propre : la santé (livestock) écrit le catalogue (parameters) **via la
> façade**, jamais en important `CatalogService` directement.

### `HealthCatalogService` — lecture fusionnée + upsert/delete

- `listVaccines(Long farmId)` / `listTreatments(Long farmId)` : remplacer `listPlatform(cat)` par
  **`listForFarm(farmId, cat)`**, propager `e.custom()` dans le DTO. (Le contrôleur passe déjà
  `farmId`.)
- `saveVaccine(Long farmId, String key, Map<String,Object> value) → VaccineDto` :
  `parametersFacade.override(farmId, CAT_VACCINES, key, value)` puis `toVaccine(...)`.
  `deleteVaccine(Long farmId, String key)` : `parametersFacade.delete(farmId, CAT_VACCINES, key)`.
- Idem `saveTreatment` / `deleteTreatment` sur `CAT_TREATMENTS`.
- Le mapping value JSONB reste dans le service (connaissance de forme centralisée). Les mappers
  lisent déjà toutes les clés (`disease`, `route`, `molecule`, `withdrawal_days_*`, `routes`) ; un
  custom qui n'écrit que les champs « essentiels » verra les autres à `null`/absents — OK.

### `VaccineDto` / `TreatmentDto` — flag `custom`

Ajouter `boolean custom` (dernier composant) à chaque record.

### `HealthCatalogController` — endpoints d'écriture

- `POST /health/catalog/vaccines` (body `{key, value}`) → `@PreAuthorize(HealthAccess.WRITE_BASIC_MANAGER)`
  → `healthCatalogService.saveVaccine(farmId, key, value)`.
- `DELETE /health/catalog/vaccines/{key}` → `WRITE_BASIC_MANAGER` → `deleteVaccine`.
- `POST /health/catalog/treatments` → `@PreAuthorize(HealthAccess.WRITE_ADVANCED_MANAGER)` →
  `saveTreatment`.
- `DELETE /health/catalog/treatments/{key}` → `WRITE_ADVANCED_MANAGER` → `deleteTreatment`.
- Corps de requête : réutiliser un record REST `{String key, Map<String,Object> value}` (miroir du
  `CatalogOverrideRequest` de parameters ; définir un équivalent local `HealthCatalogWriteRequest`
  si l'import cross-context n'est pas souhaité).

## Frontend

### Types + API (`healthApi`)

- `Vaccine` / `Treatment` (`@/types`) : ajouter `custom: boolean`.
- `healthApi` : ajouter les mutations, invalidant le tag lu par la bibliothèque
  (`{type:"HealthCatalog", id:"vaccines"|"treatments"}`) :
  - `createVaccine/updateVaccine({farmId, key, value})` → `POST /health/catalog/vaccines`
  - `deleteVaccine({farmId, key})` → `DELETE /health/catalog/vaccines/{key}`
  - idem `…Treatment` sur `/health/catalog/treatments`.

### Vocabulaire des voies (nouveau)

Aucun n'existe. Définir `HEALTH_ROUTE_LABELS` (clé stable → libellé FR, comme
`INVENTORY_SUBCATEGORY_LABELS`) : `drinking_water`→« Eau de boisson », `injectable`→« Injectable »,
`ocular`→« Oculo-nasal (goutte) », `spray`→« Nébulisation / spray », `wing_web`→« Piqûre au jabot
d'aile », `oral`→« Oral ». Stocke la **clé** en JSONB, affiche le libellé.

### `VaccineLibraryDialog` / `TreatmentLibraryDialog` (création / édition)

- Vaccin : `label` (requis), `disease` (texte libre), `route` (select `HEALTH_ROUTE_LABELS`).
  Value JSONB : `{label, disease, route}` (omettre les vides).
- Traitement : `label` (requis), `molecule` (texte), `routes` (multi-select), `withdrawal_days_meat`
  / `withdrawal_days_eggs` (entiers optionnels). Value : `{label, molecule, routes,
  withdrawal_days_meat, withdrawal_days_eggs}` (omettre les vides).
- Création : `key = slugify(label)` ; **garde anti-doublon** (message si la key existe déjà, comme
  #4). Édition : `key` fixe, champs pré-remplis. Reset **edge-triggered sur `open`**.

### `HealthLibraryView`

- Retirer la note « lecture seule » sur les onglets vaccins/traitements.
- Bouton **« Nouveau vaccin »** (onglet vaccins) / **« Nouveau traitement »** (onglet traitements),
  affiché si `canManageCatalog(useFarmRole(farmId))` **et** le tier module de l'onglet est actif
  (`hasHealth` pour vaccins, `hasAdvanced` pour traitements — déjà exposés par `useHealthGating`).
- Sur une ligne **`custom`** → puce « Perso » + boutons éditer / supprimer (confirmation →
  `deleteVaccine`/`deleteTreatment`). Lignes plateforme → aucune action.
- Les dialogues d'événement (`VaccinationDialog`, `TreatmentDialog`) verront automatiquement les
  customs (même catalogue, désormais mergé) — aucun changement requis.

## Tests

- **Backend** :
  - `HealthCatalogService` : `listVaccines/listTreatments(farmId)` fusionnent plateforme + custom et
    positionnent `custom` ; `saveVaccine`/`saveTreatment` délèguent à la façade et remappent le DTO ;
    `delete*` délèguent. (Façade mockée.)
  - `ParametersFacadeImpl.override/delete` délèguent à `CatalogService` (mock) et mappent le retour.
  - IT gating (`*IT`, CI-only) : POST vaccin gété basic, POST traitement gété advanced (403 si module
    absent) ; parité avec les lectures.
- **Frontend** :
  - `VaccineLibraryDialog` / `TreatmentLibraryDialog` : payload exact (clés value, délais omis si
    vides), anti-doublon en création, key fixe en édition.
  - `HealthLibraryView` : boutons gétés (OWNER + module) ; ligne custom → puce « Perso » + actions ;
    ligne plateforme → aucune action ; suppression demande confirmation.

## Hors périmètre (V1)

- Programmes vaccinaux custom (édition de calendrier).
- Édition/désactivation des vaccins/traitements **plateforme**.
- Champs vaccin `active_strain`/`usage`, traitement `class`/`wave` (choix « essentiels »).
- Unicité forte de la key côté backend (l'`override` est un upsert ; le frontend prévient le
  doublon avant envoi — comme #4).

## Contraintes globales

- Aucune signature Claude/AI dans les commits ; Conventional Commits, scope bounded-context
  (`feat(livestock:health)`, `feat(parameters)`, `feat(web)`).
- Branch protection → PR + `gh pr merge --rebase --delete-branch`.
- Pas de cross-import entre bounded contexts — la santé écrit le catalogue **via `ParametersFacade`**
  (jamais `CatalogService` en direct).
- RBAC + gating : écriture vaccins = `module.health.basic` + OWNER/MANAGER ; traitements =
  `module.health.advanced` + OWNER/MANAGER (enforce côté endpoint) ; l'UI gate en miroir.
- Spotless Google Java Format avant commit backend (`./mvnw -q spotless:apply -pl avicare-app`).
- `*IT` Testcontainers = CI only (Docker local indisponible).
- MUI est **v9** dans ce repo ; reset dialog edge-trigger sur `open` (leçon
  `member_access_customization`). Web : « This is NOT the Next.js you know ».
