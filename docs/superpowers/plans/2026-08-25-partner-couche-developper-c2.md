# Couche « Développer » (partenaire C2) — Implementation Plan

**Goal:** Un calendrier de recommande par réseau — quand chaque bande se termine, combien
d'aliment il reste à livrer d'ici là — gouverné par un **nouveau curseur de consentement**
`restock_forecast` disponible sur **web et mobile**.

**Spec:** `docs/superpowers/specs/2026-08-25-partner-couche-developper-design.md`

**Stack:** Spring Boot 3 / Java 21 / Flyway · Next.js 16 + MUI v9 + RTK Query · React Native
(Expo Router) + RTK Query.

## Global Constraints

- **Consentement d'abord** : le curseur `restock_forecast` (OFF par défaut) doit être livré sur
  **les deux clients** dans la même PR que l'exploitation de la donnée. Pas de prévision exposée
  au partenaire avant que l'éleveur puisse la couper depuis son téléphone.
- **Pas de cross-import** : le contexte partenaire lit les lots via une nouvelle méthode de
  `LivestockFacade`, jamais les entités.
- **Migrations** : V39 seule ; V36 immuable. Colonne `share_restock_forecast BOOLEAN NOT NULL
  DEFAULT FALSE`.
- **DB-less contexts** : grep l'ancre `FarmRepository` (le compte a bougé 2→3→4→6, ne jamais s'y
  fier) — aucun nouveau repository prévu ici, mais re-vérifier si ça change.
- **Gates backend** : `./mvnw clean verify` + `spotless:apply -pl avicare-app`.
- **Gates web** : `npm run lint && npx tsc --noEmit && npm test && npm run build`.
- **Gates mobile** : `npx tsc --noEmit && npx jest` (pas de lint ; `render`/`renderHook` sont
  **async**, importer les écrans par chemin relatif, le filtre `-t` casse sur les parenthèses
  des routes).
- **Commits** : Conventional Commits, aucune mention Claude/IA.

---

### Task 1 : V39 — le 6ᵉ curseur, bout en bout backend

**Files:**
- Create: `db/migration/V39__partner_restock_forecast_scope.sql`
- Modify: `PartnerFarmMembership`, `SharingScopes`, `PartnerFacadeImpl.scopesOf`,
  `UpdateSharingRequest`, `FarmPartnerResponse`, `PartnerNetworkService`
- Modify: `PartnerFacadeImplTest`, `PartnerNetworkServiceTest`, `FarmerPartnerControllerIT`

- [ ] **Step 1** — V39 : `ALTER TABLE partner_farm_memberships ADD COLUMN share_restock_forecast
      BOOLEAN NOT NULL DEFAULT FALSE;` (défaut FALSE = les adhésions existantes ne consentent pas
      rétroactivement — c'est le cœur de la décision §3).
- [ ] **Step 2** — Propager le champ : entité, `SharingScopes` (6ᵉ booléen), `scopesOf` (clé
      `restock_forecast`), DTO requête/réponse, `updateSharingScopes*`.
- [ ] **Step 3** — Tests : `scopesOf` expose la clé quand ON et l'omet quand OFF ; une adhésion
      créée aujourd'hui a le curseur à FALSE ; l'IT vérifie que PUT /scopes le persiste.
- [ ] **Step 4** — `./mvnw clean verify` + commit
      `feat(backend:partner): restock_forecast sharing scope (V39, off by default)`

---

### Task 2 : Le curseur côté éleveur (web + mobile) — AVANT toute exploitation

**Files:**
- Modify: `web/src/types/index.ts`, `web/src/components/settings/PartnerNetwork.tsx` (+ test)
- Modify: `mobile/src/types/index.ts`, `mobile/app/(field)/reglages/partenaires.tsx` (+ test)

- [ ] **Step 1** — Web : `SharingScopes` + `FarmPartner` gagnent `restockForecast` /
      `shareRestockForecast` ; entrée dans `COMMERCIAL` (c'est un partage à visée commerciale),
      libellé « Prévisions de recommande », sous le hint « Privé par défaut ».
- [ ] **Step 2** — Mobile : mêmes ajouts dans `src/types/index.ts`, `scopesOf`, et le tableau
      `COMMERCIAL` de `partenaires.tsx`. Structure identique au web, rien à réinventer.
- [ ] **Step 3** — Tests des deux côtés : le curseur s'affiche OFF sur une adhésion existante et
      son basculement envoie bien `restockForecast: true`.
- [ ] **Step 4** — Gates web + mobile, puis commit
      `feat(web,mobile:partner): restock forecast sharing slider`

> **Ordre non négociable** : cette tâche précède la tâche 4. Le consentement doit être coupable
> avant que la donnée soit lisible.

---

### Task 3 : `LivestockFacade.activeBatchCycles`

**Files:**
- Create: `livestock/api/dto/BatchCycleInfo.java`
- Modify: `LivestockFacade` + son impl, `GrowthPerformanceRepository` si besoin
- Create/Modify: le test de l'impl

- [ ] **Step 1** — `record BatchCycleInfo(Long unitId, String name, int headcount, LocalDate
      startDate, LocalDate expectedEndDate, String forecastMethod)` — `forecastMethod` ∈
      {`GROWTH`, `THEORETICAL`}.
- [ ] **Step 2** — `List<BatchCycleInfo> activeBatchCycles(Long farmId)` : lots de chair ACTIFS ;
      `expectedEndDate` = `growth_performance.forecasted_target_date` de la dernière snapshot,
      sinon `startDate + targetAgeDays`, sinon la ligne est **omise** (pas de date inventée).
- [ ] **Step 3** — Tests : projection sur croissance quand une pesée existe, repli théorique
      sinon, lot sans `targetAgeDays` ni pesée absent du résultat, lots CLOSED exclus.
- [ ] **Step 4** — `./mvnw clean verify` + commit
      `feat(backend:livestock): expose active batch cycles with end-of-cycle forecast`

---

### Task 4 : Le read model « Recommandes » + endpoint

**Files:**
- Create: `partner/dto/response/RestockForecastRow.java`, `RestockForecastSummary.java`
- Create: `partner/service/PartnerRestockForecastService.java` + test
- Modify: `PartnerPortalController`, `PartnerPortalControllerIT`

- [ ] **Step 1** — Service : pour chaque ferme du réseau **partageant `restock_forecast`**, croiser
      `activeBatchCycles` et `livestockStats(...).dailyFeedKg`.
      `estimatedFeedKg = round(dailyFeedKg × joursRestants)`, null si `dailyFeedKg` est null.
- [ ] **Step 2** — `GET /api/v1/partner/network/restock?horizonDays=30` → `{summary, rows}`,
      trié par `expectedEndDate` croissante.
- [ ] **Step 3** — Tests : **une ferme ne partageant pas le scope n'apparaît pas et ses lots ne
      sont même pas lus** (la garde, comme pour `activity` en C1) ; un lot sans `dailyFeedKg` sort
      avec `estimatedFeedKg` null mais garde sa date ; le résumé ne somme que la fenêtre demandée.
- [ ] **Step 4** — IT : token éleveur → 403 ; le partnerId vient du token.
- [ ] **Step 5** — `./mvnw clean verify` + commit
      `feat(backend:partner): restock forecast read model + endpoint`

---

### Task 5 : Onglet « Recommandes » + export CSV (portail)

**Files:**
- Modify: `web/src/store/api/partnerApi.ts`, `web/src/types/index.ts`
- Create: `web/src/components/partner/RestockForecast.tsx` + test
- Create: `web/src/lib/csv.ts` + test
- Modify: `web/src/app/(partner)/portal/page.tsx` (bascule d'onglets Réseau / Recommandes)

- [ ] **Step 1** — `useGetRestockForecastQuery`, types `RestockForecastRow`/`Summary`.
- [ ] **Step 2** — Onglets MUI dans la page portail : « Réseau » (existant) et « Recommandes ».
- [ ] **Step 3** — Vue : en-tête tonnage 30 j + nb de bandes ; table triée par échéance ; puce
      « estimation théorique » quand `forecastMethod === "THEORETICAL"` ; kg affichés « ≥ X kg »
      (c'est un plancher, cf. spec §4).
- [ ] **Step 4** — Export CSV **côté client** depuis les lignes déjà chargées (`Blob` +
      `URL.createObjectURL`). Helper `csv.ts` testé à part (échappement des `;` et guillemets,
      séparateur `;` pour Excel FR).
- [ ] **Step 5** — État vide qui nomme la raison (« Aucun éleveur… ne partage encore ses
      prévisions »), pas un vide muet.
- [ ] **Step 6** — Gates web + commit `feat(web:partner): restock forecast tab with CSV export`

---

### Task 6 : Validation complète + PR

- [ ] **Step 1** — `./mvnw clean verify` (les 2 erreurs Docker connues restent attendues en local).
- [ ] **Step 2** — Gates web complets.
- [ ] **Step 3** — Gates mobile (`npx tsc --noEmit && npx jest`).
- [ ] **Step 4** — PR + `gh pr checks --watch` → **vert avant tout merge** ; la CI est la seule à
      exécuter les ITs Testcontainers (V39 sur base propre).

---

## Ordre & dépendances

1 → 2 → 3 → 4 → 5 → 6, strict. La 2 avant la 4 est une contrainte de conception, pas de
compilation : le consentement doit être révocable avant que la donnée soit exposée.

## Dette identifiée, hors périmètre de cette PR

Le co-branding C1 (`partnerLogoUrl` + bloc « Mon réseau ») est **web-only** ; le mobile ignore le
champ. Non bloquant (ce n'est pas une surface de consentement), à rattraper dans un cycle suivant.
