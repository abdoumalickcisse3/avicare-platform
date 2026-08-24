# Design — Portail partenaire B2 : front (login + dashboard « Voir »)

> Statut : **design validé (2026-08-24), prêt à planifier.**
> Cycle **B2** du plan « b ». Consomme les endpoints B1 (`/api/v1/partner/**`, PR #219).
> Prolonge `docs/superpowers/specs/2026-08-23-portail-partenaire-b1-design.md`.

---

## 1. Contexte

B1 a livré le backend : auth partenaire cloisonnée (`/api/v1/partner/auth/**`) et la Couche « Voir »
read-only (`/api/v1/partner/{me,network,network/farms,…}`), le `partnerId` venant du token, le
masquage par scope appliqué côté backend. **Il manque la surface** : un partenaire n'a pas d'écran
pour se connecter ni voir son réseau. B2 = le portail front.

## 2. Périmètre

**Dans B2 :** login partenaire + dashboard réseau **read-only** (KPIs agrégés + table par ferme),
dans une section dédiée de l'app `web/`, cloisonnée (token + api séparés).

**Hors B2 :** app éleveur inchangée ; toute écriture ; couches Garder/Développer ; graphiques
élaborés ; app front autonome (extraction ultérieure possible).

## 3. Décisions verrouillées (brainstorming 2026-08-24)

| # | Sujet | Choix |
|---|---|---|
| 1 | Hébergement | **Section `(partner)` dans `web/`** (pas d'app autonome) ; Caddy route `partner.jawdi.app` → `web:3000`. |
| 2 | Cloisonnement front | **Stockage token séparé** (`partnerTokenStorage`) + **`partnerApi` dédié** (propre `createApi`, propre reauth contre `/api/v1/partner/auth/refresh`). On ne réutilise pas `baseApi`. |
| 3 | UI | **Layout minimal dédié** (branding sobre, pas la nav éleveur) ; dashboard = KPI cards + table par ferme, null-safe (« — » sur non partagé). |

**Invariant** : le backend reste l'autorité (un token éleveur → 403 sur `/api/v1/partner/**`). Le
cloisonnement front est **logique** (token + routes + api séparés), suffisant pour une SPA.

## 4. Structure

- Route-group `web/src/app/(partner)/portal/` :
  - `layout.tsx` — layout partenaire (garde de route : token présent sinon redirect `/portal/login`).
  - `login/page.tsx` — écran de connexion (hors garde).
  - `page.tsx` — dashboard réseau.
- Deploy : bloc Caddy `partner.{$DOMAIN}` miroir du bloc `app.` (handle `/api*`,`/actuator*` → `backend:8080` ; handle → `web:3000`). Ajout à `infra/Caddyfile`.

## 5. Cloisonnement front

- **`partnerTokenStorage`** (`web/src/lib/partnerStorage.ts`) : clés `jawdi_partner_access_token` /
  `jawdi_partner_refresh_token`, SSR-safe (miroir de `tokenStorage`). Coexiste avec le token éleveur
  sans collision.
- **`partnerApi`** (`web/src/store/api/partnerApi.ts`) : `createApi({ reducerPath: "partnerApi" })`
  avec un `baseQuery` qui (a) pose le header `Bearer` depuis `partnerTokenStorage`, (b) sur 401 tente
  **un** refresh contre `POST /api/v1/partner/auth/refresh`, rejoue, et en cas d'échec purge le token
  partenaire + redirige vers `/portal/login`. Enregistré dans le store à côté de `baseApi`
  (`[partnerApi.reducerPath]: partnerApi.reducer` + middleware).

## 6. Endpoints consommés (slice `partnerApi`)

- `partnerLogin` (POST `/partner/auth/login`) → `{accessToken, refreshToken, expiresIn}`.
- `partnerRefresh` (POST `/partner/auth/refresh`), `partnerLogout` (POST `/partner/auth/logout`).
- `getPartnerProfile` (GET `/partner/me`) → `{partnerId, name, type, logoUrl, farmCount}`.
- `getNetworkDashboard` (GET `/partner/network`) → `{farmCount, activeFarmCount, totalFeedKg, avgMortalityRate}`.
- `getNetworkFarms` (GET `/partner/network/farms`) → `NetworkFarmRow[]` (`{farmId, farmName, active, feedKg, mortalityRate}`).

## 7. UI (read-only)

- **Login** (`/portal/login`) : champs email + mot de passe → `partnerLogin` → stocke les tokens →
  redirect `/portal`. 401 → « Identifiants invalides ou compte inactif ».
- **Dashboard** (`/portal`) :
  - En-tête : nom + type partenaire (`/me`), bouton **Déconnexion** (purge token + redirect login).
  - **KPI cards** (`/network`) : Nombre de fermes · Fermes actives · Tonnage aliment · Mortalité
    moyenne — chaque valeur null-safe (« — » quand aucune ferme ne partage le scope).
  - **Table fermes** (`/network/farms`) : Nom · statut (badge Actif/—) · Aliment (kg) · Mortalité (%)
    — chaque cellule non partagée affiche « — ». État vide : « Aucune ferme dans votre réseau. »
- **Garde de route** : `(partner)/portal/layout.tsx` vérifie `partnerTokenStorage.getAccess()` ;
  absent → redirect `/portal/login`. Le login est hors garde.

## 8. Gestion des erreurs

| Cas | Traitement |
|---|---|
| Login 401 | message inline « Identifiants invalides ou compte inactif » |
| Session expirée (401 sur un GET) | refresh silencieux ; si échec → redirect `/portal/login` |
| Métrique non partagée (`null`) | « — » (pas d'erreur) |

## 9. Tests

- **Slice `partnerApi`** (vitest) : chaque endpoint frappe `/api/v1/partner/**` avec le token
  partenaire (mock `partnerTokenStorage`) ; le refresh sur 401 cible `/partner/auth/refresh`.
- **Composants** : login (submit → tokens stockés + 401 → message) ; dashboard (KPIs rendus,
  cellules masquées « — », état vide) ; garde de route (pas de token → redirect).

## 10. Infra

Ajout du bloc `partner.{$DOMAIN}` à `infra/Caddyfile` (optionnel en local ; requis au déploiement).
Le portail est servi par le même conteneur `web` que l'app éleveur.

## 11. Prochaine étape

Invoquer `writing-plans` pour le plan B2 (partnerStorage → partnerApi + store → login → dashboard +
garde → Caddy), en suivant les conventions `web/` (Next.js/MUI/RTK Query, vitest), sur
`feat/partner-portal-b2-frontend`.
