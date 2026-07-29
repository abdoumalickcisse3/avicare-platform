# Mobile Onboarding — Signup + Config Wizard ("Terroir vivant")

**Date:** 2026-07-29
**Status:** Design approved, ready for implementation plan
**Scope:** Replicate the web onboarding on mobile (Expo / React Native): a signup
screen + a 7-step configuration wizard that leaves the farm ready to run, with a
bold immersive "Terroir vivant" visual direction.

## 1. Context & goal

The mobile app (`mobile/`, Expo SDK 56, expo-router) currently has **login only** —
accounts and farm configuration are created on the web. The web onboarding was
just shipped (PR #146): signup collects identity, provisions a farm, then a
7-step wizard configures farm + élevage + stock + commercial + finance.

This project brings the **same signup + full config wizard to mobile**, rebuilt
natively (web components cannot be reused in RN), with a distinctive immersive
design the owner asked for ("design de folie").

**Success criteria**
- A new user can sign up on mobile and walk through all 7 steps, leaving the
  farm configured (at least one lot for non-mixed farms; catalogs tuned;
  optional suppliers/clients), then land in the field app.
- `tsc` + `jest` green; native-dep mocks keep CI (jest-only) passing.
- The experience is visibly premium and on-brand — not a generic SaaS wizard.

## 2. Architecture & flow

New expo-router group `app/(onboarding)/`:

- `app/(auth)/signup.tsx` — account creation (login links here via "Créer un compte").
- `app/(onboarding)/_layout.tsx` — auth guard + the **Terroir vivant chassis**
  (animated gradient sky, hero illustration, rising-sun progress, fixed footer).
- `app/(onboarding)/index.tsx` — the wizard: an internal `step` state machine
  (mirrors the web `OnboardingWizard`) rendering one step component at a time.

**Flow:** `signup.tsx` → `useSignupMutation` + `useCreateFarmMutation` (default
name `Ferme de {firstName}`) + `refresh` (so the token carries the new OWNER
membership) → `router.replace('/(onboarding)')` → 7 steps →
`router.replace('/(field)')`, setting a `welcome_pending` flag (persisted via
the existing `expo-secure-store`, no new dep) for a future home welcome.

**Chosen approach:** a **single wizard screen with internal step state** (not one
expo-router route per step) — gives full control over the animated transitions,
a simple shared state, and instant back navigation. (Rejected: a route per step
→ native transitions are harder to choreograph and state must be re-hydrated.)

**Reusable units** (RN ports of the web patterns):
- `WizardContext` — `{ farmId, registerNext, setCanAdvance }`, identical contract
  to web. A step registers an async commit + a validity gate.
- `useOnboardingSky(step)` — pure helper mapping a step index → sky gradient
  stops + sun position along its arc. Independently testable.
- One isolated component file per step.

## 3. Visual system — "Terroir vivant"

**The sky is the through-line.** A full-bleed SVG linear-gradient background that
**evolves with the step**, like a day at the farm, cross-fading (reanimated)
between steps:

| Step | Moment | Sky |
|---|---|---|
| 1 Bienvenue | dawn | rose/peach → indigo |
| 2 Ferme | sunrise | warm orange → blue |
| 3 Élevage | morning | amber → light azure |
| 4 Stock | midday | bright luminous blue |
| 5 Commercial | afternoon | golden blue |
| 6 Finance | golden hour | honey/gold → orange |
| 7 C'est prêt | dusk (celebration) | violet/pink + stars |

**The sun is the progress indicator** — an SVG sun (with glow) that rises along an
arc across the top as the 7 steps advance (reanimated shared value). Replaces the
web's numbered timeline.

**Hero illustration:** a layered SVG farm scene (ground, barn, hens) in the upper
band, with light parallax on step change; module-specific elements fade in
(hens→élevage, sacks→stock, etc.).

**Typography:** giant **Outfit 800** display titles, Outfit body, **JetBrains
Mono** numbers (both already loaded via `useFonts`).

**Motion & feel:**
- Step content: slide-up + fade (reanimated) on each transition.
- Orange CTA: scale spring on press.
- **Haptics** (expo-haptics): light tick on each step advance and card selection.
- **Blur** (expo-blur): the footer and form cards sit on a light glass over the
  sky for legibility.

**Footer (fixed):** ghost "Retour" + orange "Continuer" (with glow) on a blurred
bar. Only the middle content scrolls.

## 4. Steps (mobile-native — lists/cards + bottom-sheets, no tables)

1. **Bienvenue** — hero greeting + 4 module chips + "Commencer". No input.
2. **Votre ferme** — glass-card form: name (prefilled), location, capacity,
   **production type** (3 selectable cards Chair/Ponte/Mixte with check). Commits
   via `updateFarm`.
3. **Élevage** — **add lot(s):** a "+ Ajouter un lot" button opens a bottom-sheet
   (breed picker + name + count + start date). Added lots shown as cards.
   **Required** for broiler-only or layer-only farms, optional for mixed (gated).
   Uses new `createBatch` / `createProductionUnit`.
4. **Stock** — **native managed list:** seeded articles as rows/cards (type badge
   + ✕ to remove); "+ Ajouter" opens a sheet (name + type + unit). Then a
   **suppliers** quick-add section (name + phone). Uses catalog + suppliers APIs.
5. **Commercial** — same managed list for **sales channels** + a **clients**
   quick-add section (name + type + phone). Uses catalog + `createClient`.
6. **Finance** — managed list of **expense categories**. Uses catalog.
7. **C'est prêt** — dusk sky + stars, recap ("2 lots · 12 articles · …"), CTA
   "Entrer dans Jawdi" → sets the welcome flag + `router.replace('/(field)')`.

**Catalog semantics (as on web):** removing a platform item disables it, removing
a custom item deletes it, adding creates a custom override.

**Gating:** "Continuer" is disabled on Élevage until at least one lot exists (for
non-mixed farms); other steps are free (config is optional).

## 5. API layer (mobile RTK Query)

Write endpoints to add (same backend routes as web):
- `authApi` → **signup** `{ fullName, email, password, phone? }`.
- `farmsApi` → **createFarm**, **updateFarm** (invalidate `Farm/LIST`).
- `poultryBatchesApi` → **createBatch**; `productionUnitsApi` →
  **createProductionUnit** (layer flocks) (invalidate their LIST tags).
- `clientsApi` → **createClient**.
- **`catalogApi`** (new) → getCatalog / overrideCatalogEntry / deleteCatalogEntry
  (tag `Catalog` per farm+category).
- **`suppliersApi`** (new) → getSuppliers / createSupplier (tag `Supplier`).
- `baseApi.tagTypes` += `Catalog`, `Supplier`.
- Input types defined per file (mobile convention): `SignupRequest`, `FarmInput`,
  `CreateBatchInput`, `ProductionUnitInput`, `ClientInput`, `SupplierInput`.
- New `src/constants/catalogCategories.ts` (subset of web: slugs + fields for
  stock/ventes/comptabilité).
- After `createFarm`, call `refresh` (token → OWNER membership) via the existing
  `useRefreshMutation`.

## 6. Testing & dependencies

- **Native deps:** `expo install react-native-reanimated expo-linear-gradient
  expo-blur expo-haptics` + the reanimated babel plugin + **jest mocks** in
  `jest.setup.ts` (reanimated ships an official mock; the three Expo modules are
  mocked as no-ops). → requires a **dev-client rebuild** locally; **CI = jest
  only**, mocks cover it.
- **Tests** (Jest + RNTL, existing setup):
  - wizard navigation (welcome → ferme),
  - élevage gating (blocked without a lot),
  - signup flow (mutations mocked),
  - catalog managed-list add/remove (mocked),
  - `useOnboardingSky` mapping (pure),
  - supplier/client quick-add.
- Guard: `tsc` + `jest` green before each commit (ADR-003: validate locally).

## 7. Out of scope

- The dashboard/home welcome popup + guided tour on mobile (web-only for now; the
  `welcome_pending` flag is set for a later slice).
- Jawdi IA nav module (deferred, doc PR #145).
- Web parity for other modules.
