# Personnalisation des accès à la création de membre (RBAC)

**Date** : 2026-06-29
**Statut** : Validé (design + design Stitch) — en attente de relecture spec
**Périmètre** : Backend (`identity`/`tenancy` + `common-security`) + Frontend (`web/`). Aucune migration.
**Design Stitch** : projet « Avicare Design System » (`2827477240241166880`), écran « Modale Inviter un membre - AviCare » (`7711a2c61854457589e3c4123ae443ab`).

> Sous-projet **A** du chantier « réglages & RBAC ». Le sous-projet **B** (gestionnaire de
> catalogue réglages) suit séparément.

---

## 1. Contexte & problème

Le pattern RBAC multi-tenant est **déjà respecté** : `user_farms(role, permissions JSONB)`,
`FarmRole.defaultPermissions()` (`resource:verb` + `*` OWNER), JWT porteur des memberships, bean
`@farmAccess` (`FarmAccessChecker`). La **modification** d'un membre supporte déjà la surcharge des
permissions (`UpdateMemberRequest{role, permissions?}`). **Mais la création** ne prend que
`AddMemberRequest{email, role}` — impossible de personnaliser les accès à l'invitation, et l'UI
n'expose que le rôle.

Objectif : à la **création/invitation** d'un membre, pouvoir **choisir le rôle ET personnaliser les
accès si besoin**, les défauts du rôle restant recommandés.

## 2. Objectif & non-objectifs

**Objectif** : exposer un catalogue de permissions (source unique backend), étendre l'ajout de membre
pour accepter des permissions optionnelles, et offrir une UI rôle + grille de permissions
personnalisable (défauts recommandés), réutilisée en création **et** en modification.

**Non-objectifs** :
- Migration / changement de schéma (`user_farms.permissions` existe déjà).
- Logique « écriture implique lecture » (les permissions sont des chaînes littérales, comme le backend).
- Permissions scopées par ressource individuelle (un lot précis) — V1 reste `resource:verb` global ferme.
- Refonte du système de rôles (les 5 rôles restent : OWNER, MANAGER, FARMER, VETERINARIAN, BUYER).

## 3. Décisions verrouillées

- **Catalogue de permissions = endpoint backend** (source unique de vérité ; pas de liste figée front).
  `GET /api/v1/permissions/catalog` (authentifié) renvoie les ressources/verbes (depuis
  `PermissionConstants`) + les défauts par rôle (depuis `FarmRole.defaultPermissions()`).
- **`AddMemberRequest`** étendu : `{ email, role, permissions? }`. `permissions == null` → défauts du
  rôle appliqués côté service ; sinon **valider** chaque chaîne contre le catalogue (sinon `ValidationException` 422)
  puis stocker. Mêmes règles de validation que `UpdateMemberRequest` (factoriser un validateur).
- **Convention d'envoi** (front) : non personnalisé → on envoie **`role` seul** (le backend applique les
  défauts *avec wildcards* `resource:*`, donc un futur verbe est hérité) ; personnalisé → liste
  **explicite** `resource:verb`. (Idem pour la modification.)
- **OWNER = `*`** : non personnalisable dans l'UI (accès total). L'invitation d'un OWNER n'est pas un cas V1
  (le créateur de la ferme est OWNER) ; si le rôle OWNER apparaît, la grille est désactivée.
- **Éditeur de permissions = composant partagé** réutilisé par l'invitation (création) ET l'édition de
  membre (l'`UpdateMemberRequest` le supporte déjà).

## 4. Taxonomie (registre `PermissionConstants`, source de l'endpoint)

| Ressource (clé) | Libellé FR | Verbes |
|---|---|---|
| `poultry` | Élevage volaille | read, write, delete |
| `health` | Sanitaire | read, write |
| `commercial` | Commercial | read, write |
| `inventory` | Stock | read, write |
| `finance` | Finance | read, write |
| `settings` | Réglages | read, write |
| (`*`) | Accès total | — (OWNER) |

Défauts par rôle (`FarmRole.defaultPermissions()`) : OWNER `["*"]` ; MANAGER `["poultry:*","health:*",
"commercial:*","inventory:*","finance:read","settings:read"]` ; FARMER `["poultry:read","poultry:write",
"health:read","health:write"]` ; VETERINARIAN `["health:read","health:write","poultry:read"]` ;
BUYER `["commercial:read","finance:read"]`.

## 5. API interne

**Backend — nouveau contrôleur** `PermissionCatalogController` :
- `GET /api/v1/permissions/catalog` (authentifié, tout membre — c'est du vocabulaire, pas une donnée
  sensible) → `PermissionCatalogResponse`:
  ```
  {
    resources: [ { resource: "poultry", label: "Élevage volaille", verbs: ["read","write","delete"] }, … ],
    roleDefaults: { "OWNER": ["*"], "MANAGER": ["poultry:*", …], "FARMER": […], … }
  }
  ```
  Construit depuis `PermissionConstants` (ressources/verbes) + `FarmRole.defaultPermissions()`. Labels FR
  via un mapping statique côté backend (clé→libellé) — *seules* valeurs « métier » admises ici, sinon i18n V2.
- **`AddMemberRequest`** → `record AddMemberRequest(@NotNull @Email String email, @NotNull FarmRole role,
  List<String> permissions)`. Service `addMember` : `permissions==null` → `role.defaultPermissions()` ;
  sinon `PermissionValidator.validate(permissions)` (chaque entrée ∈ catalogue : `resource:verb`,
  `resource:*`, ou `*`) puis stocker. Extraire `PermissionValidator` (réutilisé par add + update).

**Frontend — slice** `permissionsApi` : `getPermissionCatalog()` → `PermissionCatalog`.

## 6. Frontend (design Stitch)

Réf. visuelle : écran Stitch « Modale Inviter un membre - AviCare ». Implémentation MUI v7 contre
`@/theme/tokens` (vert `colors.primary`, orange `colors.accent` pour le CTA, `text-secondary` neutre).

- **`PermissionEditor`** (nouveau, partagé) : reçoit `value: string[]`, `roleDefaults` du catalogue, et
  `onChange`. Affiche une grille : **lignes = modules** (icône + libellé), **colonnes = Lecture / Écriture /
  Suppression** (Suppression uniquement pour `poultry`, sinon cellule vide/tiret). Cases vertes. Les
  `resource:*` du défaut sont **étendus** en cases individuelles pour l'affichage/édition. Désactivé +
  « Accès total » si le rôle est OWNER. Responsive : colonnes empilées proprement en mobile (≥ 48px tactile).
- **`InviteMemberDialog`** (modifié) : champ Email + select Rôle (existant). Sous le rôle : ligne d'aide
  grise « Les accès par défaut du rôle sont appliqués. ». Toggle **« Personnaliser les accès »**
  (sous-texte « Laisser les défauts est recommandé », replié par défaut). Déplié → `PermissionEditor`
  pré-rempli aux défauts du rôle courant. CTA « Envoyer l'invitation » (orange). Soumission : toggle OFF →
  `{email, role}` ; toggle ON → `{email, role, permissions: <liste explicite>}`.
- **Édition de membre** (`FarmTeamTab` / dialog d'édition) : réutilise `PermissionEditor` ; soumission via
  `UpdateMemberRequest{role, permissions?}` (déjà supporté backend).
- Au changement de rôle, la grille se **réinitialise** aux défauts du nouveau rôle (sauf si l'utilisateur a
  déjà personnalisé — alors confirmer la réinitialisation ; V1 simple : réinitialise toujours au changement de rôle).

## 7. Gestion d'erreurs & états

- Catalogue en chargement → toggle « Personnaliser » désactivé + skeleton.
- Permission inconnue envoyée → 422 `ValidationException` (RFC 7807), toast d'erreur.
- Gating inchangé : ajout/édition de membre réservé OWNER/MANAGER via `@farmAccess` (déjà en place).
- Email déjà membre, user introuvable → erreurs existantes inchangées.

## 8. Tests

- **Backend** : `PermissionCatalogController` renvoie ressources + roleDefaults cohérents avec
  `PermissionConstants`/`FarmRole`. `addMember` : sans permissions → défauts du rôle ; avec permissions
  valides → stockées ; avec permission inconnue → 422. `PermissionValidator` (unitaire : accepte
  `resource:verb`/`resource:*`/`*`, rejette le reste). IT add-member (Testcontainers, CI).
- **Frontend (Vitest)** : `PermissionEditor` rend la grille + pré-coche les défauts d'un rôle ; bascule une
  case → `onChange` reçoit la liste explicite ; OWNER → désactivé. `InviteMemberDialog` : toggle OFF →
  payload `{email, role}` ; toggle ON → payload avec `permissions`. Stub `fetch` (pattern existant).
- Garde-fou : backend `mvn verify` + `spotless:apply` ; web `tsc/lint/vitest/next build`.

## 9. Risques & mitigations

- **Défaut wildcard vs liste explicite** : en personnalisant, on fige les verbes connus (un futur verbe
  n'est pas hérité). Acceptable (le cas non personnalisé garde les wildcards). Documenté.
- **Catalogue authentifié pour tous** : c'est du vocabulaire (pas de fuite) ; le gating reste sur les
  mutations de membres. OK.
- **Cohérence labels FR backend** : un seul mapping clé→libellé ; à migrer en i18n en V2 (noté).
- **Révocation/rétrogradation** (rappel du mémo) : permissions dans le JWT → prévoir TTL courte + refresh
  pour ne pas garder un droit périmé. Déjà géré par la rotation des refresh tokens (A3) ; pas d'action ici.
