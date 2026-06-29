# Gestion des comptes membres d'une ferme (création + accès personnalisés)

**Date** : 2026-06-29
**Statut** : Validé (design + 2 écrans Stitch) — en attente de relecture spec
**Périmètre** : Backend (`identity` + `tenancy` + `common-security`) + Frontend (`web/`). Aucune migration
(le schéma `users.full_name/phone` et `user_farms.role/permissions/is_active` existe déjà).
**Designs Stitch** (projet « Avicare Design System » `2827477240241166880`) :
- Création : « Modale Ajouter un membre - AviCare » (`4524f35defdd4c67b9910712c68ccca2`)
- Modification : « Modale Modifier le membre - AviCare » (`8d615c9354094c918abc7fe99dd5f493`)

> Sous-projet **A**. Le sous-projet **B** (gestionnaire de catalogue réglages) suit séparément.

---

## 1. Contexte & problème

Le pattern RBAC est déjà respecté (`user_farms(role, permissions JSONB)`, `FarmRole.defaultPermissions()`,
JWT, `@farmAccess`). **Deux manques** :
1. **Création de compte** : `MembershipService.addMember` ne fait qu'**inviter un user existant** par email
   (`identityFacade.findByEmail` → 404 sinon). On ne peut pas **créer le compte** d'un collaborateur
   (nom, téléphone), ni personnaliser ses accès à la création (`AddMemberRequest{email, role}` seul).
2. **Édition** : `UpdateMemberRequest{role, permissions?}` existe mais sans UI dédiée (accès, reset mot de
   passe, activation).

Objectif : l'éleveur **crée le compte** d'un membre (nom complet + numéro + email + rôle + accès
personnalisables), un **mot de passe temporaire est généré** et affiché une fois ; il peut ensuite
**modifier** le membre (rôle, accès, réinitialiser le mot de passe, activer/désactiver, retirer).

## 2. Objectif & non-objectifs

**Objectif** : provisionner des comptes membres avec identité complète + mot de passe temporaire, exposer
un catalogue de permissions (source backend), et offrir création/édition d'accès via 2 modales (designs
Stitch), `PermissionEditor` partagé.

**Non-objectifs** :
- Migration / schéma (tout existe).
- Lien d'invitation par email (choix : mot de passe temporaire généré — pas de dépendance email/SMS).
- Logique « écriture implique lecture » (permissions = chaînes littérales).
- Assigner le rôle **OWNER** (réservé au créateur de la ferme ; rôles assignables = MANAGER, FARMER,
  VETERINARIAN, BUYER).
- Permissions scopées par entité précise (un lot) — V1 = `resource:verb` global ferme.

## 3. Décisions verrouillées

- **Provisioning de compte** (pas invite-by-email) : à la création, on **crée un `users`** (full_name,
  phone, email, password_hash d'un **mot de passe temporaire généré**, role=USER, is_active=true) PUIS la
  membership `user_farms` (role + permissions). Le mot de passe temporaire en clair est **renvoyé une seule
  fois** dans la réponse, affiché à l'éleveur (jamais re-consultable). Email déjà pris → 422.
- **Mot de passe temporaire** : généré par un utilitaire `TemporaryPasswordGenerator` (aléatoire sûr,
  lisible : ex. 10–12 caractères sans ambiguïté O/0/l/1). Hashé `BCrypt(strength=12)` comme le reste (doc 05).
- **Catalogue de permissions = endpoint backend** : `GET /api/v1/permissions/catalog` (authentifié) →
  ressources/verbes (depuis `PermissionConstants`) + défauts par rôle (depuis `FarmRole.defaultPermissions()`).
  Source unique ; pas de liste figée front.
- **Convention d'envoi** des permissions : non personnalisé → on envoie `role` seul (le backend applique les
  défauts *avec wildcards* `resource:*`) ; personnalisé → liste explicite `resource:verb`. Idem en édition.
- **OWNER = `*`**, non assignable et non éditable dans l'UI.
- **`PermissionEditor` = composant partagé** (création + édition).
- **Reset mot de passe** (édition) : régénère un mot de passe temporaire, le renvoie une fois.
- **Compte actif** (édition) : bascule `user_farms.is_active` (désactive l'accès du membre à CETTE ferme,
  sans supprimer le compte global). « Retirer de la ferme » = suppression de la membership (existant).

## 4. Taxonomie (registre `PermissionConstants`)

| Ressource (clé) | Libellé FR | Verbes |
|---|---|---|
| `poultry` | Élevage volaille | read, write, delete |
| `health` | Sanitaire | read, write |
| `commercial` | Commercial | read, write |
| `inventory` | Stock | read, write |
| `finance` | Finance | read, write |
| `settings` | Réglages | read, write |

Défauts rôles (`FarmRole.defaultPermissions()`) : MANAGER `["poultry:*","health:*","commercial:*",
"inventory:*","finance:read","settings:read"]` ; FARMER `["poultry:read","poultry:write","health:read",
"health:write"]` ; VETERINARIAN `["health:read","health:write","poultry:read"]` ; BUYER
`["commercial:read","finance:read"]`. (OWNER `["*"]`, non assignable.)

## 5. API interne

**`identity`** (façade — nouvelles méthodes) :
- `UserInfo provisionUser(ProvisionUserCommand{ String fullName, String email, String phone, String rawPassword })`
  — crée le `User` (BCrypt(rawPassword)), role USER, actif ; email unique sinon `BusinessRuleException`/
  `ValidationException` (422). Réutilise la logique de `AuthService.signup` (extraire un helper privé).
- `void resetPassword(Long userId, String rawPassword)` — ré-encode + sauvegarde.

**`common-security`** :
- `PermissionValidator.validate(List<String>)` — chaque entrée ∈ { `*`, `resource:*`, `resource:verb` } du
  registre `PermissionConstants` (sinon `ValidationException` 422). Réutilisé par add + update.

**`tenancy`** :
- `PermissionCatalogController` : `GET /api/v1/permissions/catalog` → `PermissionCatalogResponse{
  resources: [{resource, label, verbs[]}], roleDefaults: Map<FarmRole, List<String>> }`. Labels FR via un
  mapping statique (clé→libellé) — seules valeurs « métier » admises (i18n en V2).
- `MembershipService.createMemberAccount(Long farmId, CreateMemberRequest)` →
  `CreateMemberResult{ MemberResponse member, String temporaryPassword }`. `CreateMemberRequest{
  @NotBlank fullName, @NotNull @Email email, String phone, @NotNull FarmRole role, List<String> permissions }`.
  Flux : générer temp pw → `provisionUser(...)` → valider/résoudre permissions (`null` → défauts rôle ;
  sinon `PermissionValidator.validate`) → créer `UserFarm`. Rôle OWNER refusé (422). Endpoint
  `POST /api/v1/farms/{farmId}/members` (gating OWNER/MANAGER via `@farmAccess`, inchangé).
- `MembershipService.resetMemberPassword(farmId, userId)` → `String temporaryPassword`. Endpoint
  `POST /api/v1/farms/{farmId}/members/{userId}/reset-password`.
- `UpdateMemberRequest` → ajouter `Boolean active` (bascule `is_active`) en plus de `role, permissions?`.
  Endpoint `PUT /api/v1/farms/{farmId}/members/{userId}` (existant).
- L'ancien `addMember` (invite-by-email) : conservé OU remplacé par `createMemberAccount` (décision impl :
  remplacer, l'invite-by-email n'est plus le flux V1).

**Frontend** :
- Slice `permissionsApi.getPermissionCatalog()`.
- `membersApi` : `createMember` (retourne temp pw), `updateMember` (role/permissions/active),
  `resetMemberPassword` (retourne temp pw), `removeMember` (existant).

## 6. Frontend (designs Stitch → MUI v7, tokens `@/theme/tokens`)

- **`PermissionEditor`** (partagé) : props `value: string[]`, `roleDefaults`, `catalog`, `disabled`,
  `onChange`. Grille **modules × {Lecture, Écriture, Suppression}** (Suppression seulement `poultry`).
  Cases vertes (`colors.primary`). Les `resource:*` sont étendus en cases individuelles. `disabled`
  (rôle OWNER) → « Accès total ». Responsive (colonnes lisibles en mobile, ≥ 48px tactile).
- **`AddMemberDialog`** (design `4524f35d…`) : Nom complet ; rangée Numéro + Email ; select Rôle (4 options) ;
  aide « Les accès par défaut du rôle sont appliqués. » ; encart info « mot de passe temporaire généré
  après création » ; toggle « Personnaliser les accès » (« Laisser les défauts est recommandé ») → 
  `PermissionEditor` pré-rempli ; CTA « Créer le compte » (orange). **Sur succès → état de confirmation**
  affichant le **mot de passe temporaire** (champ lecture seule + bouton « Copier ») et un rappel « notez-le,
  il ne sera plus affiché ».
- **`EditMemberDialog`** (design `8d615c93…`) : en-tête identité (avatar initiales + nom + email·téléphone) ;
  select Rôle + lien « Réinitialiser aux accès par défaut du rôle » ; `PermissionEditor` (accès actuels) ;
  section Compte (« Réinitialiser le mot de passe » → affiche le nouveau temp pw ; toggle « Compte actif ») ;
  « Retirer de la ferme » (rouge, confirmation) ; CTA « Enregistrer les modifications » (orange).
- Soumission création : non personnalisé → `{fullName, email, phone, role}` ; personnalisé → `+ permissions`.
- Au changement de rôle : la grille se réinitialise aux défauts du nouveau rôle (V1 simple).
- `FarmTeamTab` : remplacer l'ancien `InviteMemberDialog` par `AddMemberDialog` ; ligne membre → ouvre
  `EditMemberDialog`.

## 7. Gestion d'erreurs & états

- Catalogue en chargement → toggle « Personnaliser » désactivé + skeleton.
- Email déjà pris → 422 (toast). Permission inconnue → 422.
- Mot de passe temporaire : affiché **une seule fois** ; aucune relecture (pas stocké en clair).
- Gating ajout/édition réservé OWNER/MANAGER via `@farmAccess` (inchangé). Rôle OWNER en création → 422.
- Révocation/rétrogradation (mémo) : permissions dans le JWT → la rotation refresh (A3) + désactivation
  `is_active` limitent la fenêtre ; pas d'action supplémentaire ici.

## 8. Tests

- **Backend** : `TemporaryPasswordGenerator` (longueur, charset sans ambiguïté). `PermissionValidator`
  (accepte/rejette). `PermissionCatalogController` (cohérent avec registre + rôles). `createMemberAccount`
  (provisionne user + membership, renvoie temp pw, défauts si permissions null, 422 si email pris / rôle
  OWNER / permission inconnue). `resetMemberPassword` (nouveau hash, renvoie pw). IT (Testcontainers, CI).
- **Frontend (Vitest)** : `PermissionEditor` (grille, pré-coche défauts rôle, onChange explicite, OWNER
  désactivé). `AddMemberDialog` (payload sans/ avec permissions ; état temp-password après succès).
  `EditMemberDialog` (role/permissions/active ; reset password affiche pw). Stub `fetch` (pattern existant).
- Garde-fou : backend `mvn verify` + `spotless:apply -pl avicare-app` ; web `tsc/lint/vitest/next build`.

## 9. Risques & mitigations

- **Provisioning = écriture identité depuis tenancy** : passer **uniquement par `IdentityFacade`** (pas de
  cross-import) ; la création user reste dans `identity`.
- **Mot de passe temporaire en clair en réponse** : transiteur HTTPS, jamais loggé, jamais re-renvoyé.
  Forcer le changement à la 1re connexion = amélioration V2 (noté).
- **Défaut wildcard vs liste explicite** : personnaliser fige les verbes connus ; cas non personnalisé garde
  les wildcards. Acceptable, documenté.
- **Labels FR backend** : un seul mapping clé→libellé ; i18n V2.
- **Rôle OWNER** : exclu côté UI ET validé côté backend (422) pour éviter plusieurs propriétaires non voulus.
