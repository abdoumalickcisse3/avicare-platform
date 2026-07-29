# Mobile Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the web signup + 7-step configuration onboarding to the Expo mobile app, rebuilt natively with an immersive "Terroir vivant" visual direction.

**Architecture:** A new `app/(onboarding)/` expo-router group hosts a single wizard screen driven by an internal `step` state machine and a `WizardContext` (mirrors the web `OnboardingWizard`). A signup screen provisions the account + a default-named farm, refreshes the token for the OWNER membership, then routes into the wizard. New RTK Query write endpoints back the config steps.

**Tech Stack:** Expo SDK 56, expo-router, React Native, RTK Query, react-native-svg, react-native-reanimated, expo-linear-gradient, expo-blur, expo-haptics, Jest + React Native Testing Library.

## Global Constraints

- Expo SDK **56** — read `https://docs.expo.dev/versions/v56.0.0/` before writing Expo code (per `mobile/AGENTS.md`).
- Commits: Conventional Commits, scope `mobile` (e.g. `feat(mobile:onboarding): …`); **no Claude/AI signature or reference** in any commit message.
- No direct push to `main`; work on branch `feat/mobile-onboarding` (already created off `origin/main`).
- Backend wraps payloads in `ApiResponse<T>` → endpoints use `transformResponse: (r) => r.data`.
- Tokens live in `expo-secure-store` (async); use `saveTokens`/`getRefreshToken` from `@/auth/tokens`.
- Typography already loaded (Outfit / JetBrains Mono via `useFonts`); read colors/spacing/radii/typography from `@/theme` `tokens`, never hardcode hex.
- Money `NUMERIC(12,2)`; currency display "12 000 F".
- Validate locally before each commit: `npx tsc --noEmit` + `npm test` green (ADR-003 active).
- Default farm name on signup: `` `Ferme de ${firstName}` `` (fallback `"Ma ferme"`).
- Catalog semantics: removing a **platform** entry disables it, removing a **custom** entry deletes it, adding creates a **custom** override.

---

## File Structure

**New files**
- `mobile/app/(auth)/signup.tsx` — account creation screen.
- `mobile/app/(onboarding)/_layout.tsx` — auth guard + Terroir vivant chassis wrapper.
- `mobile/app/(onboarding)/index.tsx` — wizard screen (step state machine + footer).
- `mobile/src/onboarding/wizardContext.ts` — `WizardContext` + `useWizard`.
- `mobile/src/onboarding/steps.ts` — `ONBOARDING_STEPS`, `OnboardingStepId`, `WELCOME_PENDING_KEY`.
- `mobile/src/onboarding/sky.ts` — `useOnboardingSky` / `skyForStep` pure helper.
- `mobile/src/onboarding/welcomeFlag.ts` — set/read/clear the welcome flag (SecureStore).
- `mobile/src/components/onboarding/SkyBackground.tsx` — animated SVG gradient sky + rising sun.
- `mobile/src/components/onboarding/StepScaffold.tsx` — title/subtitle header used by steps.
- `mobile/src/components/onboarding/ManagedCatalogList.tsx` — keep/remove/add catalog list.
- `mobile/src/components/onboarding/QuickAddList.tsx` — supplier/client quick-add list.
- `mobile/src/components/onboarding/CreateLotSheet.tsx` — bottom-sheet to create a broiler/layer lot.
- `mobile/src/components/onboarding/steps/WelcomeStep.tsx`
- `mobile/src/components/onboarding/steps/FarmStep.tsx`
- `mobile/src/components/onboarding/steps/LivestockStep.tsx`
- `mobile/src/components/onboarding/steps/StockStep.tsx`
- `mobile/src/components/onboarding/steps/CommercialStep.tsx`
- `mobile/src/components/onboarding/steps/FinanceStep.tsx`
- `mobile/src/components/onboarding/steps/DoneStep.tsx`
- `mobile/src/store/api/catalogApi.ts` — new.
- `mobile/src/store/api/suppliersApi.ts` — new.
- `mobile/src/constants/catalogCategories.ts` — subset of web (stock/ventes/comptabilité).

**Modified files**
- `mobile/src/store/api/authApi.ts` — add `signup`.
- `mobile/src/store/api/farmsApi.ts` — add `createFarm`, `updateFarm` + `FarmInput`.
- `mobile/src/store/api/poultryBatchesApi.ts` — add `createBatch` + `CreateBatchInput`.
- `mobile/src/store/api/productionUnitsApi.ts` — add `createProductionUnit` + `ProductionUnitInput`.
- `mobile/src/store/api/clientsApi.ts` — add `createClient` + `ClientInput`.
- `mobile/src/store/api/baseApi.ts` — add `Catalog`, `Supplier` tag types.
- `mobile/app/(auth)/login.tsx` — add "Créer un compte" link to `/(auth)/signup`.
- `mobile/jest.setup.ts` — mock reanimated, expo-linear-gradient, expo-blur, expo-haptics.
- `mobile/babel.config.js` — add `react-native-reanimated/plugin`.
- `mobile/package.json` / lockfile — new deps.

---

## Task 1: Native dependencies + jest mocks

**Files:**
- Modify: `mobile/package.json`, `mobile/babel.config.js`, `mobile/jest.setup.ts`

**Interfaces:**
- Produces: importable `react-native-reanimated`, `expo-linear-gradient`, `expo-blur`, `expo-haptics` — all mocked under Jest so the suite runs headless.

- [ ] **Step 1: Install deps**

```bash
cd mobile && npx expo install react-native-reanimated expo-linear-gradient expo-blur expo-haptics
```

- [ ] **Step 2: Add the reanimated babel plugin**

In `mobile/babel.config.js`, append `'react-native-reanimated/plugin'` as the **last** entry of `plugins` (order matters).

- [ ] **Step 3: Add jest mocks**

Append to `mobile/jest.setup.ts`:

```ts
// Reanimated ships an official Jest mock.
require('react-native-reanimated').setUpTests?.();
jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock'),
);
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));
jest.mock('expo-blur', () => ({
  BlurView: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success' },
}));
```

- [ ] **Step 4: Verify the suite still runs**

Run: `cd mobile && npm test -- --watchAll=false 2>&1 | tail -5`
Expected: existing tests pass (no reanimated/expo errors).

- [ ] **Step 5: Commit**

```bash
git add mobile/package.json mobile/package-lock.json mobile/babel.config.js mobile/jest.setup.ts
git commit -m "build(mobile): add reanimated, linear-gradient, blur, haptics + jest mocks"
```

---

## Task 2: `useOnboardingSky` sky-mapping helper

**Files:**
- Create: `mobile/src/onboarding/sky.ts`
- Test: `mobile/src/onboarding/__tests__/sky.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface Sky { stops: [string, string, string]; sunProgress: number }
  export function skyForStep(index: number, total: number): Sky
  ```
  `sunProgress` ∈ [0,1] (0 at first step, 1 at last). `stops` are 3 gradient colors top→bottom.

- [ ] **Step 1: Write the failing test**

```ts
import { skyForStep } from '../sky';

describe('skyForStep', () => {
  it('places the sun at the start on step 0 and the end on the last step', () => {
    expect(skyForStep(0, 7).sunProgress).toBe(0);
    expect(skyForStep(6, 7).sunProgress).toBe(1);
  });
  it('returns three gradient stops that differ between dawn and dusk', () => {
    const dawn = skyForStep(0, 7);
    const dusk = skyForStep(6, 7);
    expect(dawn.stops).toHaveLength(3);
    expect(dawn.stops).not.toEqual(dusk.stops);
  });
  it('clamps out-of-range indices', () => {
    expect(skyForStep(-2, 7).sunProgress).toBe(0);
    expect(skyForStep(99, 7).sunProgress).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd mobile && npm test -- sky.test --watchAll=false`
Expected: FAIL ("Cannot find module '../sky'").

- [ ] **Step 3: Implement**

```ts
/** Maps a wizard step to its Terroir vivant sky (3 gradient stops) and the
 *  sun's progress along its arc. Pure — drives SkyBackground. See spec §3. */
export interface Sky {
  stops: [string, string, string];
  sunProgress: number;
}

// Dawn → sunrise → morning → midday → afternoon → golden hour → dusk.
const PALETTE: [string, string, string][] = [
  ['#F9C9B6', '#E88E6B', '#3B3A6B'], // dawn
  ['#FBB871', '#F2864A', '#2E5E8C'], // sunrise
  ['#FFD79A', '#8FC3E8', '#4F9AD1'], // morning
  ['#CFE9FB', '#7FBBE8', '#3E86C4'], // midday
  ['#FFE1A8', '#8FB9E0', '#3D6FA6'], // afternoon
  ['#FFD08A', '#F0975A', '#B65C7A'], // golden hour
  ['#7C5AA6', '#C56C9A', '#241B3A'], // dusk / celebration
];

export function skyForStep(index: number, total: number): Sky {
  const last = Math.max(total - 1, 1);
  const clamped = Math.min(Math.max(index, 0), last);
  const paletteIndex = Math.round((clamped / last) * (PALETTE.length - 1));
  return { stops: PALETTE[paletteIndex], sunProgress: clamped / last };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd mobile && npm test -- sky.test --watchAll=false`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/onboarding/sky.ts mobile/src/onboarding/__tests__/sky.test.ts
git commit -m "feat(mobile:onboarding): sky-mapping helper for the Terroir vivant chassis"
```

---

## Task 3: Catalog category constants (mobile subset)

**Files:**
- Create: `mobile/src/constants/catalogCategories.ts`
- Test: `mobile/src/constants/__tests__/catalogCategories.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface CatalogField { name: string; label: string; kind: 'text' | 'select'; options?: { value: string; label: string }[]; const?: string }
  export interface CategoryConfig { slug: 'stock' | 'ventes' | 'comptabilite'; backendCategory: string; title: string; labelField: string; fields: CatalogField[] }
  export const CATALOG_CATEGORIES: CategoryConfig[]
  export function getCategoryConfig(slug: string): CategoryConfig | undefined
  ```

- [ ] **Step 1: Write the failing test**

```ts
import { getCategoryConfig } from '../catalogCategories';

describe('getCategoryConfig', () => {
  it('maps slugs to backend categories', () => {
    expect(getCategoryConfig('stock')?.backendCategory).toBe('inventory_items');
    expect(getCategoryConfig('ventes')?.backendCategory).toBe('sales_channels');
    expect(getCategoryConfig('comptabilite')?.backendCategory).toBe('expense_categories');
  });
  it('returns undefined for unknown slugs', () => {
    expect(getCategoryConfig('nope')).toBeUndefined();
  });
  it('stock has a subcategory select', () => {
    const stock = getCategoryConfig('stock')!;
    const sub = stock.fields.find((f) => f.name === 'subcategory');
    expect(sub?.kind).toBe('select');
    expect(sub?.options?.map((o) => o.value)).toEqual(['FEED', 'CONSUMABLE', 'EQUIPMENT', 'PRODUCT']);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd mobile && npm test -- catalogCategories.test --watchAll=false`
Expected: FAIL.

- [ ] **Step 3: Implement** (mirror `web/src/constants/catalogCategories.ts`, RN-simplified)

```ts
export interface CatalogField {
  name: string;
  label: string;
  kind: 'text' | 'select';
  options?: { value: string; label: string }[];
  const?: string;
}
export interface CategoryConfig {
  slug: 'stock' | 'ventes' | 'comptabilite';
  backendCategory: string;
  title: string;
  labelField: string;
  fields: CatalogField[];
}

export const CATALOG_CATEGORIES: CategoryConfig[] = [
  {
    slug: 'stock',
    backendCategory: 'inventory_items',
    title: 'Stock',
    labelField: 'label',
    fields: [
      { name: 'label', label: "Nom de l'article", kind: 'text' },
      {
        name: 'subcategory',
        label: 'Type',
        kind: 'select',
        options: [
          { value: 'FEED', label: 'Aliment' },
          { value: 'CONSUMABLE', label: 'Consommable' },
          { value: 'EQUIPMENT', label: 'Équipement' },
          { value: 'PRODUCT', label: 'Produit' },
        ],
      },
      { name: 'unit', label: 'Unité', kind: 'text' },
    ],
  },
  {
    slug: 'ventes',
    backendCategory: 'sales_channels',
    title: 'Circuits de vente',
    labelField: 'label',
    fields: [{ name: 'label', label: 'Nom du circuit', kind: 'text' }],
  },
  {
    slug: 'comptabilite',
    backendCategory: 'expense_categories',
    title: 'Catégories de dépenses',
    labelField: 'label',
    fields: [{ name: 'label', label: 'Libellé', kind: 'text' }],
  },
];

export function getCategoryConfig(slug: string): CategoryConfig | undefined {
  return CATALOG_CATEGORIES.find((c) => c.slug === slug);
}
```

- [ ] **Step 4: Run to verify it passes** — `npm test -- catalogCategories.test --watchAll=false` → PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/constants/catalogCategories.ts mobile/src/constants/__tests__/catalogCategories.test.ts
git commit -m "feat(mobile:onboarding): catalog category config (stock/ventes/comptabilite)"
```

---

## Task 4: Auth signup + farm write endpoints

**Files:**
- Modify: `mobile/src/store/api/authApi.ts`, `mobile/src/store/api/farmsApi.ts`
- Test: `mobile/src/store/api/__tests__/onboardingWrites.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // authApi
  export type SignupRequest = { fullName: string; email: string; password: string; phone?: string };
  useSignupMutation(): AuthTokens
  // farmsApi
  export interface FarmInput { name: string; description?: string; location?: string; capacity?: number; productionFocus?: string[] }
  useCreateFarmMutation(): Farm            // POST /api/v1/farms
  useUpdateFarmMutation(): Farm            // PUT  /api/v1/farms/{id}   arg { id, body: FarmInput }
  ```

- [ ] **Step 1: Write the failing test** (asserts the endpoints build the right requests)

```ts
import { store } from '@/store';
import { authApi } from '../authApi';
import { farmsApi } from '../farmsApi';

describe('onboarding write endpoints', () => {
  it('signup POSTs to /auth/signup', () => {
    const action = store.dispatch(
      authApi.endpoints.signup.initiate({ fullName: 'Awa Diop', email: 'a@b.c', password: 'password123' }),
    );
    expect(typeof action.unwrap).toBe('function');
    action.unsubscribe?.();
  });
  it('createFarm POSTs and updateFarm PUTs', () => {
    expect(farmsApi.endpoints.createFarm.name).toBe('createFarm');
    expect(farmsApi.endpoints.updateFarm.name).toBe('updateFarm');
  });
});
```

> If `@/store` isn't the store path, use the app's configured store (check `mobile/src/store/index.ts`). The assertion only needs the endpoints to exist and be dispatchable.

- [ ] **Step 2: Run to verify it fails** — `npm test -- onboardingWrites.test --watchAll=false` → FAIL.

- [ ] **Step 3: Implement authApi.signup** — add to the `authApi` endpoints:

```ts
export type SignupRequest = { fullName: string; email: string; password: string; phone?: string };
// inside endpoints:
signup: build.mutation<AuthTokens, SignupRequest>({
  query: (body) => ({ url: '/api/v1/auth/signup', method: 'POST', body }),
  transformResponse: (r: ApiEnvelope<AuthTokens>) => r.data,
}),
// export:
export const { useLoginMutation, useRefreshMutation, useSignupMutation } = authApi;
```

- [ ] **Step 4: Implement farmsApi writes** — add `FarmInput` + endpoints:

```ts
export interface FarmInput {
  name: string;
  description?: string;
  location?: string;
  capacity?: number;
  productionFocus?: string[];
}
// inside endpoints:
createFarm: build.mutation<Farm, FarmInput>({
  query: (body) => ({ url: '/api/v1/farms', method: 'POST', body }),
  transformResponse: (r: ApiEnvelope<Farm>) => r.data,
  invalidatesTags: [{ type: 'Farm', id: 'LIST' }],
}),
updateFarm: build.mutation<Farm, { id: number; body: FarmInput }>({
  query: ({ id, body }) => ({ url: `/api/v1/farms/${id}`, method: 'PUT', body }),
  transformResponse: (r: ApiEnvelope<Farm>) => r.data,
  invalidatesTags: [{ type: 'Farm', id: 'LIST' }],
}),
// export:
export const { useListFarmsQuery, useCreateFarmMutation, useUpdateFarmMutation } = farmsApi;
```

- [ ] **Step 5: Run to verify it passes** — `npm test -- onboardingWrites.test --watchAll=false` → PASS. Then `npx tsc --noEmit`.

- [ ] **Step 6: Commit**

```bash
git add mobile/src/store/api/authApi.ts mobile/src/store/api/farmsApi.ts mobile/src/store/api/__tests__/onboardingWrites.test.ts
git commit -m "feat(mobile:onboarding): signup + farm create/update endpoints"
```

---

## Task 5: Lot creation endpoints (broiler + layer)

**Files:**
- Modify: `mobile/src/store/api/poultryBatchesApi.ts`, `mobile/src/store/api/productionUnitsApi.ts`
- Test: `mobile/src/store/api/__tests__/lotWrites.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface CreateBatchInput { breedId: number; name?: string; startDate?: string; initialCount: number }
  useCreateBatchMutation(): PoultryBatch    // POST /api/v1/farms/{farmId}/poultry-batches  arg { farmId, body }
  export interface ProductionUnitInput { breedId: number; name?: string; startDate: string; initialCount: number }
  useCreateProductionUnitMutation(): ProductionUnit  // POST /api/v1/farms/{farmId}/production-units  arg { farmId, body }
  ```

- [ ] **Step 1: Write the failing test**

```ts
import { poultryBatchesApi } from '../poultryBatchesApi';
import { productionUnitsApi } from '../productionUnitsApi';

it('exposes lot creation endpoints', () => {
  expect(poultryBatchesApi.endpoints.createBatch.name).toBe('createBatch');
  expect(productionUnitsApi.endpoints.createProductionUnit.name).toBe('createProductionUnit');
});
```

- [ ] **Step 2: Run to verify it fails** — `npm test -- lotWrites.test --watchAll=false` → FAIL.

- [ ] **Step 3: Implement createBatch** (add to `poultryBatchesApi`, `base(farmId)` already defined):

```ts
export interface CreateBatchInput { breedId: number; name?: string; startDate?: string; initialCount: number }
// endpoint:
createBatch: build.mutation<PoultryBatch, { farmId: number; body: CreateBatchInput }>({
  query: ({ farmId, body }) => ({ url: base(farmId), method: 'POST', body }),
  transformResponse: (r: ApiEnvelope<PoultryBatch>) => r.data,
  invalidatesTags: [{ type: 'PoultryBatch', id: 'LIST' }, { type: 'ProductionUnit', id: 'LIST' }],
}),
// add useCreateBatchMutation to the exported hooks.
```

- [ ] **Step 4: Implement createProductionUnit** (add to `productionUnitsApi`; confirm its base URL is `/api/v1/farms/${farmId}/production-units`):

```ts
export interface ProductionUnitInput { breedId: number; name?: string; startDate: string; initialCount: number }
// endpoint:
createProductionUnit: build.mutation<ProductionUnit, { farmId: number; body: ProductionUnitInput }>({
  query: ({ farmId, body }) => ({ url: `/api/v1/farms/${farmId}/production-units`, method: 'POST', body }),
  transformResponse: (r: ApiEnvelope<ProductionUnit>) => r.data,
  invalidatesTags: [{ type: 'ProductionUnit', id: 'LIST' }],
}),
// add useCreateProductionUnitMutation to the exported hooks.
```

- [ ] **Step 5: Run to verify it passes** — `npm test -- lotWrites.test --watchAll=false` → PASS. Then `npx tsc --noEmit`.

- [ ] **Step 6: Commit**

```bash
git add mobile/src/store/api/poultryBatchesApi.ts mobile/src/store/api/productionUnitsApi.ts mobile/src/store/api/__tests__/lotWrites.test.ts
git commit -m "feat(mobile:onboarding): broiler + layer lot creation endpoints"
```

---

## Task 6: Catalog + suppliers + client-create endpoints

**Files:**
- Create: `mobile/src/store/api/catalogApi.ts`, `mobile/src/store/api/suppliersApi.ts`
- Modify: `mobile/src/store/api/baseApi.ts` (tag types), `mobile/src/store/api/clientsApi.ts`
- Test: `mobile/src/store/api/__tests__/catalogSupplierClient.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // catalogApi
  export interface CatalogEntry { category: string; key: string; value: Record<string, unknown>; custom: boolean }
  useGetCatalogQuery(arg: { farmId: number; category: string }): CatalogEntry[]
  useOverrideCatalogEntryMutation(): void   // POST /farms/{id}/catalog/{category}  arg { farmId, category, key, value }
  useDeleteCatalogEntryMutation(): void     // DELETE /farms/{id}/catalog/{category}/{key}  arg { farmId, category, key }
  // suppliersApi
  export interface Supplier { id: number; commercialName: string; phone?: string | null }
  export interface SupplierInput { commercialName: string; phone?: string }
  useGetSuppliersQuery(arg: { farmId: number }): Supplier[]
  useCreateSupplierMutation(): Supplier     // POST /farms/{id}/inventory/suppliers  arg { farmId, body }
  // clientsApi
  export interface ClientInput { clientType: 'INDIVIDUAL' | 'BUSINESS' | 'WHOLESALER'; displayName: string; phone?: string }
  useCreateClientMutation(): Client         // POST /farms/{id}/commercial/clients  arg { farmId, body }
  ```

- [ ] **Step 1: Add tag types** — in `baseApi.ts` `tagTypes`, add `'Catalog'` and `'Supplier'`.

- [ ] **Step 2: Write the failing test**

```ts
import { catalogApi } from '../catalogApi';
import { suppliersApi } from '../suppliersApi';
import { clientsApi } from '../clientsApi';

it('exposes catalog, supplier and client-create endpoints', () => {
  expect(catalogApi.endpoints.getCatalog.name).toBe('getCatalog');
  expect(catalogApi.endpoints.overrideCatalogEntry.name).toBe('overrideCatalogEntry');
  expect(catalogApi.endpoints.deleteCatalogEntry.name).toBe('deleteCatalogEntry');
  expect(suppliersApi.endpoints.createSupplier.name).toBe('createSupplier');
  expect(clientsApi.endpoints.createClient.name).toBe('createClient');
});
```

- [ ] **Step 3: Run to verify it fails** — `npm test -- catalogSupplierClient.test --watchAll=false` → FAIL.

- [ ] **Step 4: Implement `catalogApi.ts`** (mirror web `catalogApi`):

```ts
import { baseApi } from './baseApi';
interface ApiEnvelope<T> { data: T }
export interface CatalogEntry { category: string; key: string; value: Record<string, unknown>; custom: boolean }

export const catalogApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getCatalog: build.query<CatalogEntry[], { farmId: number; category: string }>({
      query: ({ farmId, category }) => `/api/v1/farms/${farmId}/catalog/${category}`,
      transformResponse: (r: ApiEnvelope<CatalogEntry[]>) => r.data,
      providesTags: (_r, _e, { farmId, category }) => [{ type: 'Catalog', id: `${farmId}-${category}` }],
    }),
    overrideCatalogEntry: build.mutation<void, { farmId: number; category: string; key: string; value: Record<string, unknown> }>({
      query: ({ farmId, category, key, value }) => ({
        url: `/api/v1/farms/${farmId}/catalog/${category}`,
        method: 'POST',
        body: { key, value },
      }),
      invalidatesTags: (_r, _e, { farmId, category }) => [{ type: 'Catalog', id: `${farmId}-${category}` }],
    }),
    deleteCatalogEntry: build.mutation<void, { farmId: number; category: string; key: string }>({
      query: ({ farmId, category, key }) => ({
        url: `/api/v1/farms/${farmId}/catalog/${category}/${key}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_r, _e, { farmId, category }) => [{ type: 'Catalog', id: `${farmId}-${category}` }],
    }),
  }),
});
export const { useGetCatalogQuery, useOverrideCatalogEntryMutation, useDeleteCatalogEntryMutation } = catalogApi;
```

> Verify the override/delete request shapes against `web/src/store/api/catalogApi.ts` before finalizing (the web version is the source of truth for the backend contract).

- [ ] **Step 5: Implement `suppliersApi.ts`**:

```ts
import { baseApi } from './baseApi';
interface ApiEnvelope<T> { data: T }
export interface Supplier { id: number; commercialName: string; phone?: string | null }
export interface SupplierInput { commercialName: string; phone?: string }
const base = (farmId: number) => `/api/v1/farms/${farmId}/inventory/suppliers`;

export const suppliersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getSuppliers: build.query<Supplier[], { farmId: number }>({
      query: ({ farmId }) => base(farmId),
      transformResponse: (r: ApiEnvelope<Supplier[]>) => r.data,
      providesTags: [{ type: 'Supplier', id: 'LIST' }],
    }),
    createSupplier: build.mutation<Supplier, { farmId: number; body: SupplierInput }>({
      query: ({ farmId, body }) => ({ url: base(farmId), method: 'POST', body }),
      transformResponse: (r: ApiEnvelope<Supplier>) => r.data,
      invalidatesTags: [{ type: 'Supplier', id: 'LIST' }],
    }),
  }),
});
export const { useGetSuppliersQuery, useCreateSupplierMutation } = suppliersApi;
```

- [ ] **Step 6: Implement clientsApi.createClient** — add `ClientInput` + endpoint to `clientsApi`:

```ts
export interface ClientInput { clientType: 'INDIVIDUAL' | 'BUSINESS' | 'WHOLESALER'; displayName: string; phone?: string }
// endpoint:
createClient: build.mutation<Client, { farmId: number; body: ClientInput }>({
  query: ({ farmId, body }) => ({ url: base(farmId), method: 'POST', body }),
  transformResponse: (r: ApiEnvelope<Client>) => r.data,
  invalidatesTags: [{ type: 'Client', id: 'list' }],
}),
// export useCreateClientMutation alongside useGetClientsQuery.
```

- [ ] **Step 7: Run to verify it passes** — `npm test -- catalogSupplierClient.test --watchAll=false` → PASS. Then `npx tsc --noEmit`.

- [ ] **Step 8: Commit**

```bash
git add mobile/src/store/api/catalogApi.ts mobile/src/store/api/suppliersApi.ts mobile/src/store/api/baseApi.ts mobile/src/store/api/clientsApi.ts mobile/src/store/api/__tests__/catalogSupplierClient.test.ts
git commit -m "feat(mobile:onboarding): catalog, suppliers and client-create endpoints"
```

---

## Task 7: Wizard context, steps metadata, welcome flag

**Files:**
- Create: `mobile/src/onboarding/wizardContext.ts`, `mobile/src/onboarding/steps.ts`, `mobile/src/onboarding/welcomeFlag.ts`
- Test: `mobile/src/onboarding/__tests__/steps.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // steps.ts
  export const ONBOARDING_STEPS: readonly { id: string; label: string }[]   // 7 entries
  export type OnboardingStepId = 'welcome'|'farm'|'livestock'|'stock'|'commercial'|'finance'|'done'
  export const WELCOME_PENDING_KEY = 'jawdi.welcomePending'
  // wizardContext.ts
  export type NextHandler = () => Promise<boolean> | boolean;
  export interface WizardContextValue { farmId?: number; registerNext: (h: NextHandler | null) => void; setCanAdvance: (b: boolean) => void }
  export const WizardContext: React.Context<WizardContextValue | null>
  export function useWizard(): WizardContextValue
  // welcomeFlag.ts
  export function setWelcomePending(): Promise<void>
  export function readAndClearWelcomePending(): Promise<boolean>
  ```

- [ ] **Step 1: Write the failing test**

```ts
import { ONBOARDING_STEPS } from '../steps';

it('has the seven ordered steps', () => {
  expect(ONBOARDING_STEPS.map((s) => s.id)).toEqual([
    'welcome', 'farm', 'livestock', 'stock', 'commercial', 'finance', 'done',
  ]);
});
```

- [ ] **Step 2: Run to verify it fails** — `npm test -- steps.test --watchAll=false` → FAIL.

- [ ] **Step 3: Implement `steps.ts`**

```ts
export const ONBOARDING_STEPS = [
  { id: 'welcome', label: 'Bienvenue' },
  { id: 'farm', label: 'Votre ferme' },
  { id: 'livestock', label: 'Élevage' },
  { id: 'stock', label: 'Stock' },
  { id: 'commercial', label: 'Commercial' },
  { id: 'finance', label: 'Finance' },
  { id: 'done', label: "C'est prêt" },
] as const;
export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]['id'];
export const WELCOME_PENDING_KEY = 'jawdi.welcomePending';
```

- [ ] **Step 4: Implement `wizardContext.ts`** (RN port of the web context)

```ts
import { createContext, useContext } from 'react';
export type NextHandler = () => Promise<boolean> | boolean;
export interface WizardContextValue {
  farmId?: number;
  registerNext: (handler: NextHandler | null) => void;
  setCanAdvance: (can: boolean) => void;
}
export const WizardContext = createContext<WizardContextValue | null>(null);
export function useWizard(): WizardContextValue {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error('useWizard must be used inside the onboarding wizard');
  return ctx;
}
```

- [ ] **Step 5: Implement `welcomeFlag.ts`** (SecureStore)

```ts
import * as SecureStore from 'expo-secure-store';
import { WELCOME_PENDING_KEY } from './steps';
export async function setWelcomePending(): Promise<void> {
  await SecureStore.setItemAsync(WELCOME_PENDING_KEY, '1');
}
export async function readAndClearWelcomePending(): Promise<boolean> {
  const v = await SecureStore.getItemAsync(WELCOME_PENDING_KEY);
  if (v === '1') await SecureStore.deleteItemAsync(WELCOME_PENDING_KEY);
  return v === '1';
}
```

- [ ] **Step 6: Run to verify it passes** — `npm test -- steps.test --watchAll=false` → PASS. `npx tsc --noEmit`.

- [ ] **Step 7: Commit**

```bash
git add mobile/src/onboarding/wizardContext.ts mobile/src/onboarding/steps.ts mobile/src/onboarding/welcomeFlag.ts mobile/src/onboarding/__tests__/steps.test.ts
git commit -m "feat(mobile:onboarding): wizard context, step metadata, welcome flag"
```

---

## Task 8: SkyBackground component

**Files:**
- Create: `mobile/src/components/onboarding/SkyBackground.tsx`
- Test: `mobile/src/components/onboarding/__tests__/SkyBackground.test.tsx`

**Interfaces:**
- Consumes: `skyForStep` (Task 2).
- Produces: `export function SkyBackground({ stepIndex, total, children }: { stepIndex: number; total: number; children?: React.ReactNode }): JSX.Element` — full-bleed SVG linear-gradient sky + a sun positioned by `sunProgress`. Renders `children` above the sky.

- [ ] **Step 1: Write the failing test**

```tsx
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SkyBackground } from '../SkyBackground';

it('renders its children over the sky', () => {
  const { getByText } = render(
    <SkyBackground stepIndex={0} total={7}><Text>hello</Text></SkyBackground>,
  );
  expect(getByText('hello')).toBeTruthy();
});
```

- [ ] **Step 2: Run to verify it fails** — `npm test -- SkyBackground.test --watchAll=false` → FAIL.

- [ ] **Step 3: Implement** — full-bleed `Svg` with a vertical `LinearGradient` (three stops from `skyForStep`), an absolutely-positioned sun (`Circle` + soft glow) whose `cx/cy` follow `sunProgress` along an arc, and `children` layered on top via an absolute `View`. Use reanimated for the cross-fade of gradient stops between renders (a `useSharedValue` per stop is optional for v1 — a plain re-render with the new stops is acceptable and keeps the component testable). Reference spec §3 for the arc and colors. Read layout sizing from `useWindowDimensions()`.

Key structure:

```tsx
import { View, useWindowDimensions, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect, Circle } from 'react-native-svg';
import { skyForStep } from '@/onboarding/sky';

export function SkyBackground({ stepIndex, total, children }: {
  stepIndex: number; total: number; children?: React.ReactNode;
}) {
  const { width, height } = useWindowDimensions();
  const { stops, sunProgress } = skyForStep(stepIndex, total);
  const sunX = width * (0.15 + 0.7 * sunProgress);
  const sunY = height * (0.28 - 0.14 * Math.sin(Math.PI * sunProgress));
  return (
    <View style={StyleSheet.absoluteFill}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={stops[0]} />
            <Stop offset="0.5" stopColor={stops[1]} />
            <Stop offset="1" stopColor={stops[2]} />
          </LinearGradient>
        </Defs>
        <Rect width={width} height={height} fill="url(#sky)" />
        <Circle cx={sunX} cy={sunY} r={46} fill="#FFE7B0" opacity={0.35} />
        <Circle cx={sunX} cy={sunY} r={30} fill="#FFD27A" />
      </Svg>
      <View style={StyleSheet.absoluteFill}>{children}</View>
    </View>
  );
}
```

- [ ] **Step 4: Run to verify it passes** — `npm test -- SkyBackground.test --watchAll=false` → PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/components/onboarding/SkyBackground.tsx mobile/src/components/onboarding/__tests__/SkyBackground.test.tsx
git commit -m "feat(mobile:onboarding): animated Terroir vivant sky background"
```

---

## Task 9: Wizard chassis (layout + screen)

**Files:**
- Create: `mobile/app/(onboarding)/_layout.tsx`, `mobile/app/(onboarding)/index.tsx`, `mobile/src/components/onboarding/StepScaffold.tsx`
- Test: `mobile/app/(onboarding)/__tests__/wizard.test.tsx`

**Interfaces:**
- Consumes: `SkyBackground`, `WizardContext`, `ONBOARDING_STEPS`, step components (stubbed until their tasks land — see note).
- Produces: the wizard screen with a fixed footer (Retour ghost + orange Continuer), `step` state, `registerNext`/`setCanAdvance` wired, haptic tick on advance, reanimated slide-up+fade of the content on step change. `StepScaffold({ title, subtitle, children })` renders the header used by every step.

> **Ordering note:** to keep this task self-contained, first create **placeholder** step components that render their title (`<Text>{id}</Text>`). Tasks 10–17 replace each placeholder with the real step. The nav test only needs Welcome→Farm titles present.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import OnboardingWizard from '../index';
// mock expo-router useRouter + the farm hook so farmId resolves
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn() }) }));

it('advances from welcome to the farm step', () => {
  const { getByText, queryByText } = render(<OnboardingWizard />);
  expect(getByText(/Bienvenue|Commencer/i)).toBeTruthy();
  fireEvent.press(getByText(/Continuer|Commencer/i));
  expect(queryByText(/Votre ferme|Parlez-nous/i)).toBeTruthy();
});
```

- [ ] **Step 2: Run to verify it fails** — `npm test -- wizard.test --watchAll=false` → FAIL.

- [ ] **Step 3: Implement `StepScaffold.tsx`** — a `View` with an Outfit-800 title and muted subtitle (styles from `tokens.typography`), then `children`. (See spec §3 typography.)

- [ ] **Step 4: Implement placeholder step components** — create the 7 files under `src/components/onboarding/steps/` each exporting `export function XxxStep() { return <Text>…</Text> }` with recognizable copy (Welcome → "Commencer", Farm → "Votre ferme"). These are replaced in Tasks 10–17.

- [ ] **Step 5: Implement `index.tsx`** — the wizard:
  - resolve `farmId` from `useListFarmsQuery` (first farm) — mirror web `useSelectedFarm`.
  - `useState` for `index`, `canAdvance`, `busy`; `useRef` for the registered `NextHandler`.
  - `advance()`: on last step → `setWelcomePending()` + `router.replace('/(field)')`; else run the handler (await; stay if it returns false), `Haptics.selectionAsync()`, reset per-step footer state, `setIndex(i+1)`.
  - render `<SkyBackground stepIndex={index} total={7}>` wrapping: rising content (reanimated `Animated.View` keyed on `index` with entering `FadeInDown`), a scrollable content area (only this scrolls), and a fixed footer (`BlurView` + Retour + orange Continuer with a spring press).
  - provide `WizardContext` value `{ farmId, registerNext, setCanAdvance }`.
  - switch on `ONBOARDING_STEPS[index].id` to render the step component.

- [ ] **Step 6: Implement `_layout.tsx`** — auth guard (redirect to `/(auth)/login` if no token, mirroring `(field)/_layout.tsx`) wrapping a `Stack` with headers hidden.

- [ ] **Step 7: Run to verify it passes** — `npm test -- wizard.test --watchAll=false` → PASS. `npx tsc --noEmit`.

- [ ] **Step 8: Commit**

```bash
git add mobile/app/\(onboarding\) mobile/src/components/onboarding/StepScaffold.tsx mobile/src/components/onboarding/steps
git commit -m "feat(mobile:onboarding): Terroir vivant wizard chassis + step nav"
```

---

## Task 10: Welcome step

**Files:**
- Modify: `mobile/src/components/onboarding/steps/WelcomeStep.tsx`
- Test: `mobile/src/components/onboarding/steps/__tests__/WelcomeStep.test.tsx`

**Interfaces:**
- Consumes: `StepScaffold`.
- Produces: `export function WelcomeStep()` — greeting + 4 module chips (Élevage/Stock/Commercial/Finance) + intro copy. No commit; footer CTA reads "Commencer" via wizard default. (The CTA label itself stays "Continuer"; copy inside the panel says Commencer.)

- [ ] **Step 1: Write the failing test**

```tsx
import { render } from '@testing-library/react-native';
import { WelcomeStep } from '../WelcomeStep';
it('shows the four modules', () => {
  const { getByText } = render(<WelcomeStep />);
  ['Élevage', 'Stock', 'Commercial', 'Finance'].forEach((m) => expect(getByText(m)).toBeTruthy());
});
```

- [ ] **Step 2: Run to verify it fails** — FAIL.
- [ ] **Step 3: Implement** — `StepScaffold` title "On configure votre ferme ensemble" + 4 glass chips with lucide icons (`Bird`, `Boxes`, `LineChart`, `Wallet` from `lucide-react-native`). Styling per spec §3.
- [ ] **Step 4: Run to verify it passes** — PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(mobile:onboarding): welcome step"`

---

## Task 11: Farm step

**Files:**
- Modify: `mobile/src/components/onboarding/steps/FarmStep.tsx`
- Test: `mobile/src/components/onboarding/steps/__tests__/FarmStep.test.tsx`

**Interfaces:**
- Consumes: `useWizard`, `useListFarmsQuery`, `useUpdateFarmMutation`, `StepScaffold`.
- Produces: `export function FarmStep()` — glass form (name prefilled, location, capacity numeric, 3 production-type cards Chair/Ponte/Mixte with a check). On mount registers a `NextHandler` that calls `updateFarm({ id: farmId, body: { name, location, capacity, productionFocus } })`; gates `setCanAdvance(name.trim().length > 0)`. Focus tokens: Chair→`['broiler']`, Ponte→`['layer']`, Mixte→`['broiler','layer']`.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { renderWithStore } from '@/test/renderWithStore'; // if present; else wrap in Provider + WizardContext
import { FarmStep } from '../FarmStep';

it('lets the user pick a production type', () => {
  const { getByText } = render(/* FarmStep inside Provider + a stub WizardContext */);
  fireEvent.press(getByText('Ponte'));
  expect(getByText('Ponte')).toBeTruthy();
});
```

> Provide a small test wrapper supplying a `WizardContext` value `{ farmId: 1, registerNext: () => {}, setCanAdvance: () => {} }` and the Redux `Provider`. Check `mobile/src/test/` for an existing helper; if none, create `renderWithStore` under `mobile/src/test/`.

- [ ] **Step 2: Run to verify it fails** — FAIL.
- [ ] **Step 3: Implement** — prefill from the farm (render-body guarded pattern: track `prefilledId`, set once). Production-type cards mirror the web redesign (icon tile + radio/check), styled per spec. Register the `updateFarm` handler in an effect. Haptic `selectionAsync` on card tap.
- [ ] **Step 4: Run to verify it passes** — PASS. `npx tsc --noEmit`.
- [ ] **Step 5: Commit** — `git commit -m "feat(mobile:onboarding): farm step (name/location/capacity/focus)"`

---

## Task 12: Livestock step + CreateLotSheet

**Files:**
- Modify: `mobile/src/components/onboarding/steps/LivestockStep.tsx`
- Create: `mobile/src/components/onboarding/CreateLotSheet.tsx`
- Test: `mobile/src/components/onboarding/steps/__tests__/LivestockStep.test.tsx`

**Interfaces:**
- Consumes: `useWizard`, `useListFarmsQuery`, `useGetBreedsQuery`, `useGetBatchesQuery`, `useGetProductionUnitsQuery`, `useCreateBatchMutation`, `useCreateProductionUnitMutation`.
- Produces:
  - `CreateLotSheet({ visible, kind, farmId, onClose }: { visible: boolean; kind: 'broiler' | 'layer'; farmId: number; onClose: () => void })` — a `Modal` bottom-sheet: breed picker (breeds filtered by `kind` via `Breed.type`), name, count, start date; on submit calls `createBatch` (broiler) or `createProductionUnit` (layer), then `onClose`.
  - `LivestockStep()` — shows lot cards per focus + "+ Ajouter" opening the sheet; gates `setCanAdvance` (non-mixed farms need ≥1 lot of their kind; mixed → always true). Layer flocks identified by `Breed.type === 'layer'` among production units (broiler batches come from the batches list).

- [ ] **Step 1: Write the failing test** — with a stub WizardContext (`farmId: 1`) and mocked hooks returning empty lists + a mixed focus, assert "Continuer" is not gated and both "+ Ajouter" buttons render; with a broiler-only focus and no batches, assert the "Ajoutez au moins un lot" hint appears.

```tsx
it('gates non-mixed farms until a lot exists', () => {
  // mock useListFarmsQuery -> productionFocus ['broiler'], useGetBatchesQuery -> []
  const setCanAdvance = jest.fn();
  render(/* LivestockStep with WizardContext { farmId:1, registerNext(){}, setCanAdvance } */);
  expect(setCanAdvance).toHaveBeenCalledWith(false);
});
```

- [ ] **Step 2: Run to verify it fails** — FAIL.
- [ ] **Step 3: Implement `CreateLotSheet.tsx`** — RN `Modal` (`animationType="slide"`), form with breed picker (map `useGetBreedsQuery({ species: 'POULTRY' })` filtered by `type === kind`), numeric count, date default today; submit → the matching create mutation `.unwrap()`, haptic success, `onClose`.
- [ ] **Step 4: Implement `LivestockStep.tsx`** — mirror the web `LivestockStep` gating logic; render per-focus sections with lot cards and the "+ Ajouter" buttons opening `CreateLotSheet` with the right `kind`.
- [ ] **Step 5: Run to verify it passes** — PASS. `npx tsc --noEmit`.
- [ ] **Step 6: Commit** — `git commit -m "feat(mobile:onboarding): livestock step + create-lot sheet"`

---

## Task 13: ManagedCatalogList + QuickAddList primitives

**Files:**
- Create: `mobile/src/components/onboarding/ManagedCatalogList.tsx`, `mobile/src/components/onboarding/QuickAddList.tsx`
- Test: `mobile/src/components/onboarding/__tests__/ManagedCatalogList.test.tsx`

**Interfaces:**
- Consumes: `useGetCatalogQuery`, `useOverrideCatalogEntryMutation`, `useDeleteCatalogEntryMutation`, `CategoryConfig`.
- Produces:
  - `ManagedCatalogList({ farmId, config }: { farmId: number; config: CategoryConfig })` — lists entries as rows (label + optional type badge + ✕ remove), a "+ Ajouter" that opens an inline sheet built from `config.fields` (text inputs + selects), calling override with a slugified `key`. Remove calls delete.
  - `QuickAddList<T>({ title, items, renderPrimaryText, fields, onAdd, adding }: …)` — generic list + inline add row; used by supplier/client sections. Keep the generic minimal: `fields` is an ordered array of `{ name; placeholder; kind: 'text' | 'select'; options? }`, `onAdd(values: Record<string,string>)`.

- [ ] **Step 1: Write the failing test** — mock `useGetCatalogQuery` to return two entries (one platform, one custom); assert both labels render and pressing the custom entry's remove button calls the delete mutation.

```tsx
it('renders catalog entries and removes one', () => {
  // mock useGetCatalogQuery -> [{key:'a',value:{label:'Maïs'},custom:false}, {key:'b',value:{label:'Mix',},custom:true}]
  const del = jest.fn(() => ({ unwrap: () => Promise.resolve() }));
  // mock useDeleteCatalogEntryMutation -> [del,{}]
  const { getByText, getByLabelText } = render(<ManagedCatalogList farmId={1} config={getCategoryConfig('stock')!} />);
  expect(getByText('Maïs')).toBeTruthy();
  fireEvent.press(getByLabelText('Retirer Mix'));
  expect(del).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run to verify it fails** — FAIL.
- [ ] **Step 3: Implement `ManagedCatalogList.tsx`** — rows with label + `custom ? 'Personnalisé' : 'Plateforme'` badge + a remove pressable (`accessibilityLabel={`Retirer ${label}`}`). "+ Ajouter" toggles an inline form from `config.fields`; on submit build `value` from field values, `key = slug(label)`, call override; clear form.
- [ ] **Step 4: Implement `QuickAddList.tsx`** — generic list + inline add row per the interface above.
- [ ] **Step 5: Run to verify it passes** — PASS. `npx tsc --noEmit`.
- [ ] **Step 6: Commit** — `git commit -m "feat(mobile:onboarding): managed catalog list + quick-add primitives"`

---

## Task 14: Stock step

**Files:**
- Modify: `mobile/src/components/onboarding/steps/StockStep.tsx`
- Test: `mobile/src/components/onboarding/steps/__tests__/StockStep.test.tsx`

**Interfaces:**
- Consumes: `useWizard`, `ManagedCatalogList`, `QuickAddList`, `getCategoryConfig('stock')`, `useGetSuppliersQuery`, `useCreateSupplierMutation`.
- Produces: `export function StockStep()` — `ManagedCatalogList` for `inventory_items` + a suppliers `QuickAddList` (fields: name, phone) calling `createSupplier({ farmId, body: { commercialName, phone } })`. No gating.

- [ ] **Step 1: Write the failing test** — with `farmId:1` and mocked hooks, assert the section titles "Vos articles" and "Vos fournisseurs" render.
- [ ] **Step 2: Run to verify it fails** — FAIL.
- [ ] **Step 3: Implement** — compose `StepScaffold` + `ManagedCatalogList` + supplier `QuickAddList`.
- [ ] **Step 4: Run to verify it passes** — PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(mobile:onboarding): stock step (articles + suppliers)"`

---

## Task 15: Commercial step

**Files:**
- Modify: `mobile/src/components/onboarding/steps/CommercialStep.tsx`
- Test: `mobile/src/components/onboarding/steps/__tests__/CommercialStep.test.tsx`

**Interfaces:**
- Consumes: `useWizard`, `ManagedCatalogList`, `QuickAddList`, `getCategoryConfig('ventes')`, `useGetClientsQuery`, `useCreateClientMutation`.
- Produces: `export function CommercialStep()` — `ManagedCatalogList` for `sales_channels` + a clients `QuickAddList` (fields: name, type select Particulier/Entreprise/Grossiste, phone) calling `createClient({ farmId, body: { displayName, clientType, phone } })`.

- [ ] **Step 1: Write the failing test** — assert "Vos circuits de vente" and "Vos clients" render.
- [ ] **Step 2: Run to verify it fails** — FAIL.
- [ ] **Step 3: Implement** — compose per interface; client type options map `INDIVIDUAL/BUSINESS/WHOLESALER`.
- [ ] **Step 4: Run to verify it passes** — PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(mobile:onboarding): commercial step (channels + clients)"`

---

## Task 16: Finance step

**Files:**
- Modify: `mobile/src/components/onboarding/steps/FinanceStep.tsx`
- Test: `mobile/src/components/onboarding/steps/__tests__/FinanceStep.test.tsx`

**Interfaces:**
- Consumes: `useWizard`, `ManagedCatalogList`, `getCategoryConfig('comptabilite')`.
- Produces: `export function FinanceStep()` — `ManagedCatalogList` for `expense_categories`.

- [ ] **Step 1: Write the failing test** — assert the "Catégories de dépenses" title renders (mock catalog hook empty).
- [ ] **Step 2: Run to verify it fails** — FAIL.
- [ ] **Step 3: Implement** — `StepScaffold` + `ManagedCatalogList`.
- [ ] **Step 4: Run to verify it passes** — PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(mobile:onboarding): finance step (expense categories)"`

---

## Task 17: Done step

**Files:**
- Modify: `mobile/src/components/onboarding/steps/DoneStep.tsx`
- Test: `mobile/src/components/onboarding/steps/__tests__/DoneStep.test.tsx`

**Interfaces:**
- Consumes: `StepScaffold`.
- Produces: `export function DoneStep()` — celebratory panel (recap copy). The actual navigation + flag are handled by the wizard's footer on the last step (Task 9). Renders "Votre ferme est prête".

- [ ] **Step 1: Write the failing test** — assert "prête" copy renders.
- [ ] **Step 2: Run to verify it fails** — FAIL.
- [ ] **Step 3: Implement** — success panel; the dusk sky (from `skyForStep(6,7)`) + stars come from `SkyBackground` automatically at step 6.
- [ ] **Step 4: Run to verify it passes** — PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(mobile:onboarding): done step"`

---

## Task 18: Signup screen + login link

**Files:**
- Create: `mobile/app/(auth)/signup.tsx`
- Modify: `mobile/app/(auth)/login.tsx` (add "Créer un compte" link)
- Test: `mobile/app/(auth)/__tests__/signup.test.tsx`

**Interfaces:**
- Consumes: `useSignupMutation`, `useCreateFarmMutation`, `useRefreshMutation`, `saveTokens`, `getRefreshToken`.
- Produces: `signup.tsx` default export — identity form (firstName, lastName, email, phone?, password, confirm). Submit orchestration (retry-safe, mirror web): signup → `saveTokens` → createFarm(`Ferme de {firstName}`) → refresh with stored refresh token → `saveTokens` → `router.replace('/(onboarding)')`.

- [ ] **Step 1: Write the failing test**

```tsx
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }), Link: ({ children }: any) => children }));
// mock useSignupMutation/useCreateFarmMutation/useRefreshMutation to resolve
it('creates the account then routes to onboarding', async () => {
  const { getByLabelText, getByText } = render(<SignupScreen />);
  fireEvent.changeText(getByLabelText('Prénom'), 'Awa');
  // fill the rest…
  fireEvent.press(getByText(/Créer mon compte/i));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(onboarding)'));
});
```

- [ ] **Step 2: Run to verify it fails** — FAIL.
- [ ] **Step 3: Implement `signup.tsx`** — form with validation (email format, password ≥8, confirm match); orchestration with a `useRef` guard so re-taps don't re-signup/re-create. Default farm name `` `Ferme de ${firstName.trim()}` `` (fallback `"Ma ferme"`). After createFarm, read the stored refresh token and call `refresh({ refreshToken })`, `saveTokens`. Style consistent with `login.tsx`.
- [ ] **Step 4: Add the login link** — in `login.tsx`, add a pressable "Pas de compte ? Créer un compte" → `router.push('/(auth)/signup')`.
- [ ] **Step 5: Run to verify it passes** — PASS. `npx tsc --noEmit`.
- [ ] **Step 6: Commit** — `git commit -m "feat(mobile:onboarding): signup screen + login link"`

---

## Task 19: Integration pass

**Files:**
- Modify: any step file where the real hooks weren't fully wired; `mobile/app/(onboarding)/index.tsx` (swap placeholder step imports for the real components if not already).

- [ ] **Step 1: Wire real steps** — confirm `index.tsx` imports the real `WelcomeStep`…`DoneStep` (not placeholders) and the switch renders them.
- [ ] **Step 2: Full type check** — `cd mobile && npx tsc --noEmit` → clean.
- [ ] **Step 3: Full test suite** — `cd mobile && npm test -- --watchAll=false` → all green.
- [ ] **Step 4: Manual smoke (optional, needs a dev-client rebuild)** — `npx expo run:android` (or the project's run script), sign up, walk the 7 steps, confirm landing in `(field)`.
- [ ] **Step 5: Commit** — `git commit -m "feat(mobile:onboarding): wire real steps + integration pass"`

---

## Self-Review

**Spec coverage:**
- §2 architecture (routes, flow, WizardContext, useOnboardingSky) → Tasks 2, 7, 9, 18. ✓
- §3 visual system (sky, sun, motion, haptics, blur) → Tasks 2, 8, 9 (+ per-step styling). ✓
- §4 steps 1–7 → Tasks 10–17. ✓
- §5 API layer (signup, farm, batch/unit, client, catalog, suppliers, tags, constants) → Tasks 3, 4, 5, 6. ✓
- §6 deps + jest mocks + tests → Task 1 + per-task tests + Task 19. ✓
- Welcome flag → Task 7 (helper) + Task 9 (set on finish). ✓

**Placeholder scan:** Styling detail is delegated to spec §3 rather than repeated per file — intentional (the visual system is fully specified in the spec; repeating StyleSheet blocks would bloat the plan and drift from the tokens). All API contracts, test code, and component interfaces are concrete. No "TBD"/"handle edge cases".

**Type consistency:** `FarmInput`, `CreateBatchInput`, `ProductionUnitInput`, `ClientInput`, `SupplierInput`, `CatalogEntry`, `CategoryConfig`, `NextHandler`, `WizardContextValue`, `skyForStep`, `WELCOME_PENDING_KEY` are defined once (Tasks 2–7) and referenced consistently downstream. Hook names (`useSignupMutation`, `useCreateFarmMutation`, `useUpdateFarmMutation`, `useCreateBatchMutation`, `useCreateProductionUnitMutation`, `useCreateSupplierMutation`, `useCreateClientMutation`, `useGetCatalogQuery`, `useOverrideCatalogEntryMutation`, `useDeleteCatalogEntryMutation`) match between producer and consumer tasks.

**Note for implementers:** verify each new endpoint's request/response shape against its web counterpart (`web/src/store/api/*`) before finalizing — the web APIs are the source of truth for the backend contract.
