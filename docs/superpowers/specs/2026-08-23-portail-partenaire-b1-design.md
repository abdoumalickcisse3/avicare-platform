# Design — Portail partenaire B1 : socle backend + Couche « Voir »

> Statut : **design validé (2026-08-23), prêt à planifier.**
> Cycle **B1** du plan « b » (portail partenaire). Consomme le socle `com.avicare.partner`
> (PR #215) et les surfaces éleveur (PR #218). Le portail front `partner.jawdi.app` est **B2**
> (cycle séparé). Prolonge `docs/superpowers/specs/2026-08-20-produit-partenaire-cooperative-design.md`
> (§5 `partner_users`, §6 portail dédié, Couche 1 « Voir »).

---

## 1. Contexte

Le lien ferme↔partenaire existe (`partner_farm_memberships` + curseurs de partage), et l'éleveur
peut déjà déclarer/rejoindre/régler/quitter (PR #218). Mais **le partenaire ne peut rien voir** :
aucun compte de connexion partenaire, aucun endpoint côté partenaire. B1 pose ce socle : des
comptes `partner_users` cloisonnés, une authentification partenaire séparée, et des endpoints
**read-only** qui exposent, pour chaque partenaire, **uniquement ce que ses éleveurs partagent**.

La frontière de confiance est déjà amorcée par `PartnerFacade` :
`farmIdsInNetwork(partnerId)` (fermes CONFIRMED) et `sharedScopes(partnerId, farmId)` (les clés de
scope qu'une ferme partage). B1 s'appuie dessus — jamais contournable par le front.

## 2. Périmètre

**Dans B1 :**
- Table `partner_users` + provisioning par l'ADMIN.
- **Auth partenaire cloisonnée** : login/refresh/logout séparés, JWT à audience `partner`,
  `PartnerPrincipal` distinct, gate `@partnerAccess`.
- Endpoints **read-only** `/api/v1/partner/**` : profil, dashboard réseau agrégé, vue par ferme —
  **filtrés par scope**.

**Hors B1 (cycles suivants) :**
- Portail front `partner.jawdi.app` (login + dashboard) = **B2**.
- Permissions fines des `partner_users` (B1 = un compte lit tout le réseau de son partenaire).
- Couches « Garder » / « Développer » ; toute écriture ; co-branding ; monétisation.

## 3. Décisions verrouillées (brainstorming 2026-08-23)

| # | Sujet | Choix |
|---|---|---|
| 1 | Découpe du plan « b » | **2 cycles** : B1 backend (ce doc) puis B2 portail front. |
| 2 | Modèle d'auth | **Entité `partner_users` séparée** + principal `PARTNER` (cloisonnement total du monde éleveur). |
| 3 | Permissions partner_user | **Aucune granularité fine** en B1 : un compte lit tout le réseau de son partenaire (read-only). |
| 4 | Crypto/sessions | **Réutiliser les clés + `JwtService` existants** ; le token partenaire porte `aud=partner` + `partner_id` ; refresh via chemin partenaire dédié. |
| 5 | Identité ferme | Le **nom** de la ferme est visible pour les membres CONFIRMED ; seules les **métriques** sont masquées par scope. |

**Invariant** : le `partnerId` provient **toujours du token**, jamais du path/body → un partenaire
ne voit que SON réseau. Le masquage par scope est la **seule** autorisation de contenu, côté backend.

## 4. Modèle de données — `partner_users` (migration V37)

```sql
CREATE TABLE partner_users (
    id            BIGSERIAL PRIMARY KEY,
    partner_id    BIGINT NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    email         VARCHAR(200) NOT NULL UNIQUE,
    password_hash VARCHAR(100) NOT NULL,
    full_name     VARCHAR(200),
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_partner_users_partner ON partner_users(partner_id);
CREATE TRIGGER trg_partner_users_updated_at
    BEFORE UPDATE ON partner_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Dedicated refresh-token store for partner sessions. NOT reusing `refresh_tokens`
-- (which FKs users(id)) — cloisonnement + FK integrity. Mirrors its design (token + revoked_at).
CREATE TABLE partner_refresh_tokens (
    id              BIGSERIAL PRIMARY KEY,
    partner_user_id BIGINT NOT NULL REFERENCES partner_users(id) ON DELETE CASCADE,
    token           VARCHAR(500) NOT NULL UNIQUE,
    expires_at      TIMESTAMP NOT NULL,
    revoked_at      TIMESTAMP,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_partner_refresh_tokens_user ON partner_refresh_tokens(partner_user_id);
```

Pas de soft delete (comme `users`, on utilise `is_active`). Entités JPA `PartnerUser` +
`PartnerRefreshToken` (timestamps lecture seule via trigger le cas échéant, pas de `password`/`token`
dans un `toString`).

## 5. Authentification partenaire (le cœur)

### 5.1 Principal & audience
- Nouveau `PartnerPrincipal(Long partnerUserId, String email, Long partnerId)` (record), **distinct**
  d'`AvicarePrincipal` — un token partenaire ne porte **pas** de memberships ferme.
- Le JWT partenaire porte un claim **`aud=partner`** + `partner_id`. Un token éleveur n'a pas ce
  claim ; le filtre les distingue et refuse le croisement.

### 5.2 Intégration filtre + `SecurityConfig`
- `JwtService` : ajouter `generatePartnerAccessToken(PartnerPrincipal)` (claims `sub`=partnerUserId,
  `partner_id`, `aud=partner`, `type=access`) ; réutiliser `generateRefreshToken(...)` avec un sujet
  partenaire.
- Le `JwtFilter` : si le token décodé porte `aud=partner`, poser une authentification
  `PartnerPrincipal` avec autorité `ROLE_PARTNER` (et exposer `partnerId` via un `PartnerContext`
  ThreadLocal, miroir de `TenancyContext`) ; sinon, chemin `AvicarePrincipal` existant inchangé.
- `SecurityConfig` : `/api/v1/partner/auth/**` **permitAll** ; `/api/v1/partner/**` **authenticated**.
  Une gate `@partnerAccess` (bean `PartnerAccessChecker`) expose `isPartner()` /
  `currentPartnerId()` pour les `@PreAuthorize("@partnerAccess.isPartner()")`.

### 5.3 Endpoints d'auth (`PartnerAuthController`, `/api/v1/partner/auth`)
- `POST /login` `{email,password}` → `{accessToken, refreshToken}` (401 si inconnu/inactif/mauvais mdp).
- `POST /refresh` `{refreshToken}` → rotation (source de vérité **`partner_refresh_tokens`**,
  révocation via `revoked_at` ; même logique que doc 05 côté éleveur).
- `POST /logout` → révocation du refresh courant.
Hash BCrypt(strength=12) ; jamais de mot de passe en clair/`toString`.

### 5.4 Provisioning (côté ADMIN)
Ajout à `AdminPartnerController` : `POST /api/v1/admin/partners/{partnerId}/users`
`{email, fullName}` → crée un `partner_user` avec mot de passe temporaire (retourné une fois),
gaté `hasRole('ADMIN')`. (Patron = provisioning de membres éleveurs.)

## 6. Endpoints « Voir » (`PartnerPortalController`, `/api/v1/partner`)

Tous gatés `@PreAuthorize("@partnerAccess.isPartner()")`. Le `partnerId` vient du token.

- `GET /me` → `PartnerProfileResponse` (nom, type, logo, nb fermes réseau).
- `GET /network` → `NetworkDashboardResponse` : nb fermes CONFIRMED, nb actives (activité < 30 j),
  tonnage aliment (Σ sur les fermes partageant `feed_consumption`), mortalité moyenne (sur celles
  partageant `flock_health`), etc. **Chaque agrégat n'inclut que les fermes partageant le scope.**
- `GET /network/farms` → `List<NetworkFarmRow>` : une ligne/ferme (nom toujours ; métriques
  présentes **seulement** si partagées ; les non partagées = `null`).
- `GET /network/farms/{farmId}` → détail ; **404** si la ferme ne fait pas partie du réseau CONFIRMED
  du partenaire OU ne partage aucun scope (pas de divulgation).

### 6.1 Orchestration & sources
`PartnerNetworkReadService` :
1. `partnerFacade.farmIdsInNetwork(partnerId)` → fermes CONFIRMED.
2. Pour chaque ferme : `partnerFacade.sharedScopes(partnerId, farmId)` → scopes autorisés.
3. Tirer les façades **et masquer** selon les scopes :
   - `activity` → `LivestockFacade.recentActivity` / `countActiveUnits` (actif/inactif).
   - `flock_health` → mortalité (via `LivestockFacade.livestockStats`).
   - `feed_consumption` → tonnage aliment (via `LivestockFacade.livestockStats` / `InventoryFacade`).
   - `sales_volume` → volumes de vente (façade commerciale/livestock).
   - `finances` → `FinanceFacade.farmPnl` (rare ; OFF par défaut).
   - nom ferme → `TenancyFacade.findById`.
4. Agréger pour `/network` ; conserver le détail par ferme pour `/network/farms`.

Les champs exacts de `LivestockStats` sont résolus au plan ; si un agrégat manque, on **ajoute une
méthode de lecture** sur la façade métier concernée (pas d'accès DB cross-context direct).

**Aucune écriture métier.** Le masquage par scope est appliqué **dans le service**, jamais délégué
au front.

## 7. Gestion des erreurs

| Cas | HTTP |
|---|---|
| Login inconnu / inactif / mauvais mdp | 401 |
| Token partenaire sur endpoint éleveur, ou token éleveur sur `/api/v1/partner/**` | 403 |
| Ferme hors réseau CONFIRMED / ne partageant rien | 404 |
| Non authentifié | 401 |

## 8. Tests

- **Cloisonnement (preuve clé, DB-less)** : login partenaire 200/401 ; **token partenaire → 403 sur
  un endpoint éleveur** (`/api/v1/farms/{id}/**`) ; **token éleveur → 403 sur `/api/v1/partner/**`**.
- **Scopes (service DB-less, façades mockées)** : une ferme partageant `feed_consumption` contribue
  au tonnage, une autre non est exclue ; masquage par ferme (`null` sur non partagé) ; un partenaire
  ne voit que ses fermes CONFIRMED ; `/network/farms/{id}` 404 hors réseau.
- **Repository slice** (`@DataJpaTest` + Testcontainers, CI) : `partner_users` (unicité email,
  cascade sur suppression du partenaire).
- **DB-less recurrent** : les nouveaux repos `PartnerUserRepository` **et** `PartnerRefreshTokenRepository`
  doivent être `@MockitoBean` dans les **4** contextes DB-less (`SecurityE2ETest`,
  `SecurityIntegrationTest`, `DashboardControllerIT`, `NotificationControllerIT`) — sinon vert local,
  rouge CI (footgun connu).

## 9. Suite → B2

Portail front `partner.jawdi.app` (nouvelle app) : écran de login partenaire + dashboard réseau
read-only consommant `/api/v1/partner/**`. Spec→plan séparé.

## 10. Prochaine étape

Invoquer `writing-plans` pour le plan d'implémentation B1 (migration + entité + repo → auth
partenaire/principal/filtre/SecurityConfig → provisioning ADMIN → endpoints Voir + masquage par
scope), en TDD, sur `feat/partner-portal-b1-backend`.
