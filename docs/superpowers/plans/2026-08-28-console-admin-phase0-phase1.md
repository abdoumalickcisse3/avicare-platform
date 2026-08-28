# Console super-admin — Phase 0 + Phase 1 — Implementation Plan

**Spec :** `docs/superpowers/specs/2026-08-20-console-super-admin-design.md` (révisé 2026-08-28,
lire le bandeau, §3bis et §6bis).

**Goal :** rendre la plateforme pilotable — comptes staff, audit inviolable, support des fermes et
des utilisateurs, et **l'administration des partenaires**, qui ne se fait aujourd'hui qu'au curl
alors que le portail tourne en production.

**17 tâches. Migrations V40 → V43.**

## Décisions actées (2026-08-28)

| # | Sujet | Décision |
|---|---|---|
| D1 | Périmètre de l'audit | **Interceptor global** sur toute mutation portée par un principal `ADMIN`, quel que soit le chemin |
| D2 | `SUPER_ADMIN` | **Permission `*`** dans `staff_permissions` (pas de colonne sur `users`) — `PermissionCatalog` traite déjà `*` comme joker |
| D3 | Front | **Route-group `(admin)` dans `web/`**, chemin `/console`, servi sur `admin.{$DOMAIN}` |
| D4 | Permissions staff | **Lookup DB sans cache** — exception documentée à la règle « le JWT porte tout » : une révocation doit être immédiate |
| D5 | Impersonation | **Token séparé** `impersonation_access`, TTL court, **sans** `role=ADMIN` — le staff voit exactement ce que voit l'éleveur |
| D7 | Logo partenaire | **URL externe**, hors périmètre (aucun stockage d'objets n'existe) |
| D8 | Seed fondateur | **`ApplicationRunner`** conditionné par `avicare.admin.founder-email`, pas une migration |
| D9 | Seuils health-score | **`catalog_items`**, catégorie `admin` |
| D10 | Dernière connexion partenaire | **Colonne** `partner_users.last_login_at`, patron `users.last_login_at` |

## Hors périmètre

- **Upload de logo / stockage d'objets** (D7).
- **Écran de gestion des permissions staff** : il y aura un seul compte, détenteur de `*`. Le
  modèle DB et le gate sont livrés ; l'UI d'attribution attendra le 2ᵉ compte staff.
- **2FA staff** — déjà différé par le spec.
- **Écran prospects partenaires** — reporté (spec §6bis.3).
- **Funnel d'activation** — `onboarding_completed` est un *user setting écrit par le front*, pas un
  état serveur : un éleveur qui change de navigateur « redevient » non-onboardé, le funnel serait
  faux. Seule la liste « fermes qui décrochent », adossée à des faits métier, est livrée.

## Contraintes

- **Six contextes de test DB-less.** Ancre fiable : `grep -rl 'ActiveProfiles("test")'
  backend/avicare-app/src/test/java`. Tout nouveau repository JPA y est déclaré `@MockitoBean`
  **dans le commit qui le crée**. Le compte a déjà bougé 2→3→4→6 : re-grep, ne jamais se fier au
  chiffre écrit ici.
- **Gates backend** : `./mvnw clean verify` puis `./mvnw spotless:apply -pl avicare-app`. La CI
  lance `spotless:check` en premier et échoue avant même de compiler.
- **Gates web** : `npm run lint && npx tsc --noEmit && npm test && npm run build`. **La CI web ne
  lance pas `npm test`** (seulement lint, tsc, build) — les vitest ne sont vérifiés qu'en local.
- **Testcontainers ne tourne pas sur cette machine** : les `*IT` sont écrits, validés en CI. Les
  `*Test` doivent passer en local.
- **Pas de cross-import entre contextes** : `admin` n'importe que des `*Facade`.
- Migrations V36→V39 immuables. 1 tâche = 1 commit, Conventional Commits, aucune mention IA.

---

## PHASE 0 — Socle sécurité & identité

### T1 — `staff_permissions` (V40) + catalogue de permissions staff
Table `staff_permissions(user_id, permission, granted_by, timestamps)`, `UNIQUE(user_id, permission)`,
pas de `deleted_at` (une permission se retire, elle ne s'archive pas). Catalogue en miroir de
`PermissionConstants`, **taxonomies ferme et staff disjointes** — ne pas réutiliser
`PermissionCatalog.isValid`. Permissions : les 11 du spec §5.1 + les 5 de §6bis.4
(`partners:read|write|users|attach|prospect`). Joker `*`.
→ 6 contextes DB-less. Test : validité de `*`, d'un `resource:verb` connu, rejet d'un inconnu.

### T2 — `admin_audit_log` (V41) + `AdminAuditService`
Append-only : **pas de colonne ni de trigger `updated_at`**, et un trigger
`BEFORE UPDATE OR DELETE ... RAISE EXCEPTION` pour que l'inviolabilité soit vraie en base et pas
seulement dans le code. Entité sans setters publics. Service en
**`@Transactional(propagation = REQUIRES_NEW)`** — sinon un rollback métier efface la trace.
→ 6 contextes DB-less. Test : l'écriture survit à un rollback de la transaction appelante.

### T3 — Gate `AdminAccess` + interceptor d'audit global (D1)
Bean SpEL `@adminAccess.can('...')`, fail-closed sans principal (patron `FarmAccessChecker`).
Lookup DB sans cache (D4). L'interceptor journalise **toute requête non-GET d'un principal
`ADMIN`**, quel que soit le chemin — c'est ce qui rend l'invariant du spec vrai, puisque `ADMIN`
contourne déjà `FarmAccessChecker` et `FeatureChecker`.
Javadoc : expliciter que « staff » ≠ `TenantData.isSuperAdmin` (qui signifie déjà `ADMIN`).
Ajouter un `@PreAuthorize` fin par méthode sur `AdminPartnerController` et
`AdminChangeRequestController`.
Test : `*` ouvre tout, permission exacte ouvre une seule chose, `USER` porteur d'une ligne
`staff_permissions` refusé, absence de principal refusée.

### T4 — Compte fondateur + `GET /api/v1/admin/me`
`ApplicationRunner` conditionné (D8) : si l'email configuré existe, forcer `role=ADMIN` et garantir
`staff_permissions(user_id, '*')`. **Idempotent, audité** (auto-promotion tracée), ne crée jamais de
compte. C'est aussi le filet anti-lock-out de D2. `/admin/me` renvoie les permissions — le front en
dérive sa navigation.

### T5 — Révocation de sessions + audit des connexions staff
`POST /admin/users/{id}/revoke-sessions` (délègue à `RefreshTokenService.revokeAllForUser`).
`AuthService.login` audite les connexions `ADMIN`. **Piège** : `AuthService` est dans `identity`,
`AdminAuditService` dans `admin` → passer par un `spi` optionnel (patron
`identity/spi/MembershipProvider` + implémentation no-op), sinon cross-import et 6 contextes cassés.

### T6 — Front : shell, login staff, sous-domaine (D3)
`adminStorage.ts` (clés `jawdi_admin_*`), `adminApi.ts` (**`createApi` autonome**, jamais
`injectEndpoints` sur `baseApi`), route-group `(admin)/console/`, `middleware.ts` renvoyant 404 hors
host admin, bloc Caddy `admin.{$DOMAIN}`, DNS.
Le login appelle `/auth/login` puis `/admin/me` : **un 403 purge le token et refuse** — un éleveur
qui connaît l'URL ne doit pas atterrir dans un shell vide. Bannière de contexte permanente.
Test : le token va bien dans `jawdi_admin_*` et pas dans `avicare_*`.

> Fin de Phase 0 : rien de fonctionnel, tout est audité et déployable. C'est le contrat du spec.

---

## PHASE 1 — Support, anti-churn, partenaires

> Les tâches partenaires (T16-T17) débloquent de la production existante et sont **déplaçables
> juste après T8** sans réécriture, si on veut livrer cette valeur plus tôt.

### T7 — Fermes : liste + fiche 360° (backend)
`GET /admin/farms` paginé (patron `PageResponse.from`), `GET /admin/farms/{id}` agrégé via
`TenancyFacade` + `SubscriptionFacade` + `LivestockFacade` + `PartnerFacade`. **Aucune requête
directe sur les entités d'un autre contexte.** Ajouter `lastActivityByFarm(List<Long>)` **en batch**
aux façades — sinon N+1 cross-contexte sur toutes les fermes.
Test : ferme sans abonnement, ferme sans activité (`null`, pas 0).

### T8 — Fermes (front)

### T9 — Recherche utilisateurs cross-tenant + actions (backend)
Recherche paginée email/nom/téléphone. **`IdentityFacade` n'a aucun chemin pour désactiver un
compte** → ajouter `setActive`. **Désactiver révoque les sessions dans la même transaction**, sinon
le compte reste utilisable jusqu'à expiration de l'access token.

### T10 — Recherche utilisateurs (front)
Mot de passe temporaire dans un dialog **avec copie**, jamais un toast qui disparaît.

### T11 — Impersonation encadrée (backend, D5)
Token `impersonation_access`, TTL court, `role=USER`, memberships de la cible, `impersonatedBy`.
**Pas de refresh token** : l'impersonation expire, elle ne se prolonge pas. **Refus d'impersonner un
`ADMIN`** (escalade latérale). Audit à l'ouverture *et* à la fermeture.
**Piège** : `AvicarePrincipal` est un record — ajouter un composant casse `JwtServiceTest`,
`AvicarePrincipalTest`, `JwtFilterTest` et tout appel positionnel.
Test : le token d'impersonation est rejeté par `validateAccessToken` et réciproquement (même
cloisonnement de type que les tokens partenaires).

### T12 — Impersonation (front)
Bannière « Mode support » **permanente, non fermable**. Flag en `sessionStorage` (pas
`localStorage` : ne doit pas survivre à la fermeture de l'onglet). La session éleveur précédente est
sauvegardée et restaurée à la sortie.

### T13 — Modules / feature-flags par ferme
Endpoints `/admin/**` déléguant à `SubscriptionService`, **pour que l'audit soit explicite**
(`action=farm.module.enable`) plutôt qu'une ligne générique de l'interceptor.

### T14 — Health-score (V42, seuils en `catalog_items`)
Score **dérivé, non stocké** : jours depuis la dernière saisie, lots actifs, membre actif. Trois
niveaux + une raison textuelle. Test : changer le seuil dans le catalogue change le classement (donc
rien n'est en dur).

### T15 — Health-score (front) + export CSV (`web/src/lib/csv.ts` existe)

### T16 — Manques d'API partenaires (V43)
`ALTER TABLE partner_users ADD COLUMN last_login_at`. Puis :

| Manque | État réel |
|---|---|
| Détacher une ferme | `PartnerNetworkService.leave` **existe** → 3 lignes de controller |
| Désactiver un compte | `PartnerUser.active` existe, mais **`revokeAllForPartnerUser` n'existe pas** → sans elle, le salarié parti reste connecté jusqu'à expiration |
| Réinitialiser | `PasswordEncoder` + `TemporaryPasswordGenerator` disponibles |
| Lister/révoquer les codes | `active` + `uses_count` existent, conversion via `memberships.invite_code_id` |
| `MembershipResponse` | **n'expose que 5 curseurs sur 6** — `shareRestockForecast` manque depuis V39 |
| `PartnerUserRepository` | pas de `findByPartnerId` |
| Comptages | aucune projection → N+1 sur la liste des partenaires |

Attach/detach → audit avec `tenant_id` renseigné : **les entrées les plus sensibles du back-office**.

### T17 — Écrans partenaires (front)
Liste + fiche : identité, portefeuille avec **les 6 curseurs consentis en lecture seule**, comptes,
codes. **Le détachement d'une ferme exige une confirmation typée** (saisir le nom de la ferme) : il
coupe l'accès d'un tiers aux données d'un éleveur, il ne doit pas être à un clic d'un tableau.

---

## Ordre

1→3 est une chaîne dure (pas de gate sans catalogue, pas d'audit sans table). 4 après 3 pour que la
promotion du fondateur soit elle-même auditée. 5 avant 6 pour que le front ait un backend complet.
6 est le point de bascule : rien n'est affichable avant. Ensuite chaque paire backend→front est
réordonnable ; seules 11→12 et 16→17 sont couplées, 13 dépend de 8, 14 dépend de 7.

## Pièges à relire avant chaque commit

1. Re-grep les contextes DB-less — le chiffre bouge.
2. `AvicarePrincipal` est un record (T11).
3. `admin` n'importe que des façades ; l'audit depuis `identity` passe par un `spi` (T5).
4. `REQUIRES_NEW` sur l'audit (T2).
5. `spotless:apply` avant chaque commit backend.
6. `npx tsc --noEmit` systématiquement — la CI web ne lance pas les tests.
7. V36→V39 immuables ; toute correction = V44+.
