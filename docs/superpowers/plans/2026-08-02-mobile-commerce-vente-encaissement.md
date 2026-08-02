# Mobile Commerce — Vente directe + Encaissement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two online-only commercial write actions to the mobile app — a direct sale ("Vente directe") and a debtor payment ("Encaissement") — replaying the exact web endpoints, with a bold, animated UI coherent with the mobile design system.

**Architecture:** New RTK Query slices (`salesApi`, `invoicesApi`, `paymentsApi`) on the shared `baseApi`; a `useProductionAvailability` hook feeding a full-screen sale cart; a client-detail screen with a payment sheet. No backend changes — the endpoints, gating and business rules already exist and are exercised by the web.

**Tech Stack:** Expo (SDK 56) + expo-router, React 19, RTK Query, TypeScript, react-native-reanimated 4, expo-haptics, expo-linear-gradient, expo-blur, lucide-react-native, React Native Testing Library + jest-expo.

## Global Constraints

- **Read the versioned Expo docs** at `https://docs.expo.dev/versions/v56.0.0/` before writing screen/native code (per `mobile/AGENTS.md`). Expo 56 differs from training data.
- **No backend changes.** Reuse endpoints under `/api/v1/farms/{farmId}/commercial`.
- **Web-aligned DTOs.** Mirror `web/src/types` (`SaleInput`, `SaleLineInput`, `PaymentInput`, `Invoice`, `Payment`) verbatim.
- **Online-only.** Plain RTK Query mutations — NO `enqueueFieldMutation`/`client_ref` (that path is only for mortality/weighing).
- **Money:** integer XOF (`*Xof`), rendered with `formatCurrency` from `@/lib/format`, tabular-nums.
- **Design system only:** all colors/spacing from `@/theme` `tokens`. Action language: **`accumulate`** (green `primary[600]`) for repeated/reversible acts (add-to-cart, steppers); **`commit`** (orange `accent[400]`, `earth` text) for the single decisive button per screen (Valider / Encaisser).
- **RBAC:** the sale and payment write endpoints require OWNER/MANAGER (`WRITE_MANAGER`). Entry points (FAB, Encaisser button) render only when `useFarmAccess().farmRole` is `'OWNER'` or `'MANAGER'`.
- **Commits:** Conventional Commits, scope `mobile:commerce`. NO Claude signature/co-author (per repo CLAUDE.md).
- **Test flush:** wrap `fireEvent.press`/`changeText` in `await act(async () => …)` (React 19 + RNTL 14 defers state updates).
- **Lint/type gates before each commit:** `npm run lint` and `npx tsc --noEmit` from `mobile/`.

---

### Task 1: Commercial types, cache tags, and payment labels (foundation)

**Files:**
- Modify: `mobile/src/types/index.ts` (add commercial types near the existing `ArticleSource` at line 205 / `Client` at 264)
- Modify: `mobile/src/store/api/baseApi.ts:69-77` (tagTypes)
- Modify: `mobile/src/lib/commercial.ts` (append payment-method constants)
- Test: `mobile/src/lib/__tests__/commercial.test.ts` (create if absent; else append)

**Interfaces:**
- Produces (types, mirror `web/src/types`):
  - `type PaymentMethod = 'CASH' | 'MOBILE_MONEY' | 'BANK_TRANSFER'`
  - `type ProductType = 'BROILER' | 'EGGS'`
  - `type SaleStatus = 'COMPLETED' | 'CANCELLED'`
  - `interface SaleLineInput { articleKey: string; articleSource: ArticleSource; quantity: number; unitPriceXof: number; productType?: ProductType; productionUnitId?: number; notes?: string }`
  - `interface SaleInput { clientId?: number | null; saleDate?: string; paymentMethod?: string; salesChannelKey?: string; notes?: string; lines: SaleLineInput[] }`
  - `interface Sale { id: number; farmId: number; saleNumber: string; clientId: number | null; status: SaleStatus; saleDate: string; paymentMethod: string | null; salesChannelKey: string | null; totalXof: number; notes: string | null }`
  - `type InvoiceStatus = 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED'`
  - `interface Invoice { id: number; farmId: number; invoiceNumber: string; clientId: number | null; status: InvoiceStatus; issueDate: string; dueDate: string | null; totalXof: number; paidXof: number; balanceXof: number }`
  - `interface Payment { id: number; farmId: number; invoiceId: number; amountXof: number; method: PaymentMethod; paymentDate: string; reference: string | null }`
  - `interface PaymentInput { invoiceId: number; amountXof: number; method: PaymentMethod; paymentDate?: string; reference?: string }`
- Produces (constants): `PAYMENT_METHOD_LABELS: Record<PaymentMethod, string>`, `PAYMENT_METHOD_OPTIONS: PaymentMethod[]`
- Produces (tags): baseApi `tagTypes` gains `'Sale' | 'Invoice' | 'Payment'`

> NOTE for implementer: before writing the `Invoice`/`Payment` field names, open `web/src/types/index.ts` and copy the exact property names for `Invoice` (around line 1040-1075) and `Payment`/`PaymentInput` (around 1158-1180). The names above match the web at spec-writing time; if the web differs, the web wins (backend contract).

- [ ] **Step 1: Write the failing test**

```ts
// mobile/src/lib/__tests__/commercial.test.ts
import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_OPTIONS } from '@/lib/commercial';

describe('payment method constants', () => {
  it('labels every method in French', () => {
    expect(PAYMENT_METHOD_LABELS.CASH).toBe('Espèces');
    expect(PAYMENT_METHOD_LABELS.MOBILE_MONEY).toBe('Mobile Money');
    expect(PAYMENT_METHOD_LABELS.BANK_TRANSFER).toBe('Virement');
  });
  it('exposes the three methods as options', () => {
    expect(PAYMENT_METHOD_OPTIONS).toEqual(['CASH', 'MOBILE_MONEY', 'BANK_TRANSFER']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mobile && npx jest src/lib/__tests__/commercial.test.ts`
Expected: FAIL — `PAYMENT_METHOD_LABELS` is not exported.

- [ ] **Step 3: Add the types, tags, and constants**

In `mobile/src/types/index.ts`, add the `PaymentMethod`, `ProductType`, `SaleStatus`, `SaleLineInput`, `SaleInput`, `Sale`, `InvoiceStatus`, `Invoice`, `Payment`, `PaymentInput` declarations from the Interfaces block.

In `mobile/src/lib/commercial.ts`, append:

```ts
import type { PaymentMethod } from '@/types';

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Espèces',
  MOBILE_MONEY: 'Mobile Money',
  BANK_TRANSFER: 'Virement',
};

export const PAYMENT_METHOD_OPTIONS: PaymentMethod[] = ['CASH', 'MOBILE_MONEY', 'BANK_TRANSFER'];
```

In `mobile/src/store/api/baseApi.ts`, add `'Sale', 'Invoice', 'Payment'` to the `tagTypes` array (after `'Supplier'`).

- [ ] **Step 4: Run test + typecheck**

Run: `cd mobile && npx jest src/lib/__tests__/commercial.test.ts && npx tsc --noEmit`
Expected: PASS + no type errors.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/types/index.ts mobile/src/store/api/baseApi.ts mobile/src/lib/commercial.ts mobile/src/lib/__tests__/commercial.test.ts
git commit -m "feat(mobile:commerce): commercial write types, cache tags, payment labels"
```

---

### Task 2: `salesApi` slice (createSale)

**Files:**
- Create: `mobile/src/store/api/salesApi.ts`
- Test: `mobile/src/store/api/__tests__/salesApi.test.ts`

**Interfaces:**
- Consumes: `baseApi` (Task 1 tags), `SaleInput`, `Sale` (Task 1)
- Produces: `useCreateSaleMutation`; endpoint `createSale({ farmId, body: SaleInput }) => Sale`

- [ ] **Step 1: Write the failing test**

```ts
// mobile/src/store/api/__tests__/salesApi.test.ts
import { salesApi } from '@/store/api/salesApi';

describe('salesApi', () => {
  it('POSTs to the commercial sales endpoint', () => {
    const endpoint = salesApi.endpoints.createSale;
    const req = endpoint.query!({ farmId: 7, body: { lines: [] } }) as {
      url: string; method: string; body: unknown;
    };
    expect(req).toEqual({ url: '/api/v1/farms/7/commercial/sales', method: 'POST', body: { lines: [] } });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mobile && npx jest src/store/api/__tests__/salesApi.test.ts`
Expected: FAIL — cannot find module `@/store/api/salesApi`.

- [ ] **Step 3: Implement the slice**

```ts
// mobile/src/store/api/salesApi.ts
/**
 * Commercial sales — mirrors web/src/store/api/salesApi.ts (same backend,
 * WRITE_MANAGER). A "Vente directe" is a single createSale; it decrements
 * production stock, so we invalidate the production + dashboard caches too.
 */
import { baseApi } from './baseApi';
import type { Sale, SaleInput } from '@/types';

interface ApiEnvelope<T> {
  data: T;
}

const base = (farmId: number) => `/api/v1/farms/${farmId}/commercial/sales`;

export const salesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    createSale: build.mutation<Sale, { farmId: number; body: SaleInput }>({
      query: ({ farmId, body }) => ({ url: base(farmId), method: 'POST', body }),
      transformResponse: (r: ApiEnvelope<Sale>) => r.data,
      invalidatesTags: [
        { type: 'Sale', id: 'list' },
        { type: 'Client', id: 'list' },
        { type: 'PoultryBatch', id: 'LIST' },
        { type: 'ProductionUnit', id: 'LIST' },
        { type: 'TrayStock', id: 'CURRENT' },
        { type: 'DailyProduction', id: 'LIST' },
        { type: 'Dashboard', id: 'SUMMARY' },
      ],
    }),
  }),
});

export const { useCreateSaleMutation } = salesApi;
```

> NOTE: confirm the exact tag ids used by `poultryBatchesApi`/`eggProductionApi`/`dashboardApi` `providesTags` (e.g. `PoultryBatch`/`LIST`, `TrayStock`/`CURRENT`) and match them so invalidation actually refetches. `TrayStock`/`CURRENT` is confirmed in `eggProductionApi.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd mobile && npx jest src/store/api/__tests__/salesApi.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/store/api/salesApi.ts mobile/src/store/api/__tests__/salesApi.test.ts
git commit -m "feat(mobile:commerce): salesApi createSale with production+client cache sync"
```

---

### Task 3: `useProductionAvailability` hook

**Files:**
- Create: `mobile/src/commerce/useProductionAvailability.ts`
- Test: `mobile/src/commerce/__tests__/useProductionAvailability.test.tsx`

**Interfaces:**
- Consumes: `useGetBatchesQuery` (`poultryBatchesApi`), `useGetTrayStockQuery` (`eggProductionApi`), `PoultryBatch`, `TrayStock`
- Produces: `useProductionAvailability(farmId: number | null) => { broilerLots: { unitId: number; label: string; heads: number }[]; eggsAvailable: number; loading: boolean }`

- [ ] **Step 1: Write the failing test**

```tsx
// mobile/src/commerce/__tests__/useProductionAvailability.test.tsx
import { renderHook } from '@testing-library/react-native';

jest.mock('@/store/api/poultryBatchesApi', () => ({
  useGetBatchesQuery: jest.fn(() => ({
    data: [
      { id: 1, name: 'Lot A', currentCount: 480, status: 'ACTIVE' },
      { id: 2, name: null, currentCount: 0, status: 'ACTIVE' },
    ],
    isLoading: false,
  })),
}));
jest.mock('@/store/api/eggProductionApi', () => ({
  useGetTrayStockQuery: jest.fn(() => ({ data: { fullTraysCount: 12 }, isLoading: false })),
}));

import { useProductionAvailability } from '@/commerce/useProductionAvailability';

describe('useProductionAvailability', () => {
  it('keeps only broiler lots with heads and exposes egg trays', () => {
    const { result } = renderHook(() => useProductionAvailability(7));
    expect(result.current.broilerLots).toEqual([{ unitId: 1, label: 'Lot A', heads: 480 }]);
    expect(result.current.eggsAvailable).toBe(12);
    expect(result.current.loading).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mobile && npx jest src/commerce/__tests__/useProductionAvailability.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the hook**

```ts
// mobile/src/commerce/useProductionAvailability.ts
import { skipToken } from '@reduxjs/toolkit/query/react';
import { useGetBatchesQuery } from '@/store/api/poultryBatchesApi';
import { useGetTrayStockQuery } from '@/store/api/eggProductionApi';

export interface BroilerLotOption {
  unitId: number;
  label: string;
  heads: number;
}

export function useProductionAvailability(farmId: number | null) {
  const arg = farmId === null ? skipToken : { farmId };
  const { data: batches, isLoading: lb } = useGetBatchesQuery(arg);
  const { data: trays, isLoading: lt } = useGetTrayStockQuery(arg);

  const broilerLots: BroilerLotOption[] = (batches ?? [])
    .filter((b) => b.currentCount > 0)
    .map((b) => ({ unitId: b.id, label: b.name ?? `Lot #${b.id}`, heads: b.currentCount }));

  return {
    broilerLots,
    eggsAvailable: trays?.fullTraysCount ?? 0,
    loading: lb || lt,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd mobile && npx jest src/commerce/__tests__/useProductionAvailability.test.tsx && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/commerce/useProductionAvailability.ts mobile/src/commerce/__tests__/useProductionAvailability.test.tsx
git commit -m "feat(mobile:commerce): production availability hook (lots + egg trays)"
```

---

### Task 4: Vente directe screen (logic + createSale)

**Files:**
- Create: `mobile/app/(field)/commerce/vente.tsx`
- Test: `mobile/app/(field)/commerce/__tests__/vente.test.tsx`

**Interfaces:**
- Consumes: `useProductionAvailability` (Task 3), `useCreateSaleMutation` (Task 2), `useGetClientsQuery`, `useGetCatalogQuery({ category: 'sales_channels' })`, `PAYMENT_METHOD_OPTIONS`/`PAYMENT_METHOD_LABELS` (Task 1), `useFarmAccess`, `selectSelectedFarmId`, `useRouter`.
- Produces: default-export `VenteScreen`; internal `Line` cart model `{ key, articleKey, articleSource, productType?, productionUnitId?, label, unit, quantity, unitPriceXof, max? }`; `buildSaleInput(lines, clientId, method, channel): SaleInput` (exported for the test).

Reference: `web/src/components/commercial/QuickSaleDialog.tsx` (port its state model + `submit` mapping verbatim; native components instead of MUI). Presentation stays minimal here — Task 6 adds the bold polish.

- [ ] **Step 1: Write the failing test**

```tsx
// mobile/app/(field)/commerce/__tests__/vente.test.tsx
import { act, fireEvent, render, screen } from '@testing-library/react-native';

const press = (el: Parameters<typeof fireEvent.press>[0]) =>
  act(async () => { fireEvent.press(el); });

const mockCreateSale = jest.fn(() => ({ unwrap: () => Promise.resolve({ id: 1, totalXof: 3500 }) }));

jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({ back: jest.fn(), push: jest.fn() })),
  Redirect: () => null,
}));
jest.mock('react-redux', () => ({
  useSelector: jest.fn(() => 7),
  useDispatch: jest.fn(() => jest.fn()),
  useStore: jest.fn(() => ({})),
}));
jest.mock('@/auth/useSession', () => ({
  useFarmAccess: jest.fn(() => ({ farmRole: 'OWNER', can: () => true, isAdmin: true, session: null })),
}));
jest.mock('@/commerce/useProductionAvailability', () => ({
  useProductionAvailability: jest.fn(() => ({
    broilerLots: [{ unitId: 5, label: 'Lot A', heads: 100 }],
    eggsAvailable: 0,
    loading: false,
  })),
}));
jest.mock('@/store/api/clientsApi', () => ({ useGetClientsQuery: jest.fn(() => ({ data: [] })) }));
jest.mock('@/store/api/catalogApi', () => ({ useGetCatalogQuery: jest.fn(() => ({ data: [] })) }));
jest.mock('@/store/api/salesApi', () => ({
  useCreateSaleMutation: jest.fn(() => [mockCreateSale, { isLoading: false }]),
}));

import VenteScreen from '@/app/(field)/commerce/vente';

describe('Vente directe', () => {
  beforeEach(() => mockCreateSale.mockClear());

  it('adds a broiler lot and submits a walk-in sale', async () => {
    render(<VenteScreen />);
    await press(screen.getByText('Lot A'));            // add lot -> qty 1
    await press(screen.getByLabelText('Prix +1000'));  // bump unit price by 1000 (stepper) x? -> see impl
    await press(screen.getByText('Valider la vente'));
    expect(mockCreateSale).toHaveBeenCalledWith({
      farmId: 7,
      body: expect.objectContaining({
        clientId: null,
        paymentMethod: 'CASH',
        lines: [expect.objectContaining({
          articleKey: 'BROILER', articleSource: 'PRODUCTION',
          productType: 'BROILER', productionUnitId: 5, quantity: 1,
        })],
      }),
    });
  });
});
```

> NOTE: adapt the price-entry interaction to whatever control the impl ships (a numeric `TextInput` with `changeText`, or `+/‑` steppers with `accessibilityLabel`). Keep the assertion on the `createSale` body shape stable.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mobile && npx jest "app/(field)/commerce/__tests__/vente.test.tsx"`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the screen**

Create `mobile/app/(field)/commerce/vente.tsx`. Port the web `QuickSaleBody` logic exactly, as a native screen:

- State: `lines: Line[]`, `clientId: string` (default sentinel `'__walk_in__'`), `method: PaymentMethod` (default `'CASH'`), `channel: string`.
- `addBroilerLot(unitId, label, heads)` and `addEggs()` — identical merge-or-increment logic to the web (line keys `prod:BROILER:{unitId}` / `prod:EGGS`, `unitPriceXof: 0`, `max` from heads/eggsAvailable).
- `setQty(key, qty)` (remove when `<= 0`), `setPrice(key, price)`.
- `total = Σ quantity*unitPriceXof`; `hasOverMax`.
- Export a pure helper for the test:

```ts
export function buildSaleInput(
  lines: Line[], clientId: string, method: PaymentMethod, channel: string,
): SaleInput {
  return {
    clientId: clientId === '__walk_in__' ? null : Number(clientId),
    paymentMethod: method,
    salesChannelKey: channel || undefined,
    lines: lines.map((l) => ({
      articleKey: l.articleKey,
      articleSource: l.articleSource,
      quantity: l.quantity,
      unitPriceXof: l.unitPriceXof,
      ...(l.articleSource === 'PRODUCTION'
        ? { productType: l.productType, productionUnitId: l.productionUnitId }
        : {}),
    })),
  };
}
```

- `submit()`: guard `lines.length > 0`, `await createSale({ farmId, body: buildSaleInput(...) }).unwrap()`, then `router.back()`; on error show a toast (`apiErrorMessage`).
- Guard the screen: `if (farmRole !== 'OWNER' && farmRole !== 'MANAGER') return <Redirect href="/(field)/(tabs)/commerce" />;` and if `selectedFarmId === null` likewise.
- Structure (plain `View`/`Pressable`/`TextInput`/`ScrollView` + tokens, polish comes in Task 6): header with client selector; production picker cards calling `addBroilerLot`/`addEggs`; cart rows with qty steppers + price input + line total + remove; sticky footer with payment-method buttons, channel selector, animated Total, and the single **"Valider la vente"** commit button (`tokens` `commit`), disabled when `lines.length === 0 || saving || hasOverMax`.

Register the route: expo-router auto-registers files under `app/`. Add a `Stack.Screen` option in `app/(field)/_layout.tsx` if the group uses an explicit `<Stack>` (match how `lots/[unitId]/mortalite` is presented — likely `presentation: 'modal'`). Verify by reading `app/(field)/_layout.tsx`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd mobile && npx jest "app/(field)/commerce/__tests__/vente.test.tsx" && npx tsc --noEmit && npm run lint`
Expected: PASS + clean.

- [ ] **Step 5: Commit**

```bash
git add "mobile/app/(field)/commerce/vente.tsx" "mobile/app/(field)/commerce/__tests__/vente.test.tsx" "mobile/app/(field)/_layout.tsx"
git commit -m "feat(mobile:commerce): vente directe screen (production cart -> createSale)"
```

---

### Task 5: "Vente" FAB on the Commerce tab (OWNER/MANAGER)

**Files:**
- Modify: `mobile/app/(field)/(tabs)/commerce.tsx` (add FAB + make client cards navigate)
- Test: `mobile/app/(field)/(tabs)/__tests__/commerce.test.tsx` (create)

**Interfaces:**
- Consumes: `useFarmAccess` (`farmRole`), `useRouter`.
- Produces: a floating "Vente" button routed to `/(field)/commerce/vente`, shown only for OWNER/MANAGER; client cards route to `/(field)/commerce/client/[clientId]`.

- [ ] **Step 1: Write the failing test**

```tsx
// mobile/app/(field)/(tabs)/__tests__/commerce.test.tsx
import { render, screen } from '@testing-library/react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({ push: mockPush })),
  Redirect: () => null,
}));
jest.mock('react-redux', () => ({ useSelector: jest.fn(() => 7), useDispatch: jest.fn(() => jest.fn()), useStore: jest.fn(() => ({})) }));
jest.mock('@/store/api/clientsApi', () => ({ useGetClientsQuery: jest.fn(() => ({ data: [], isLoading: false })) }));
const mockAccess = { farmRole: 'OWNER', can: () => true, isAdmin: true, session: null };
jest.mock('@/auth/useSession', () => ({ useFarmAccess: jest.fn(() => mockAccess) }));

import CommerceScreen from '@/app/(field)/(tabs)/commerce';

describe('Commerce tab FAB', () => {
  it('shows the Vente FAB for an OWNER', () => {
    render(<CommerceScreen />);
    expect(screen.getByLabelText('Nouvelle vente')).toBeTruthy();
  });
});
```

Add a second test asserting the FAB is absent for `farmRole: 'FARMER'` (mutate `mockAccess.farmRole` in a nested `it`).

- [ ] **Step 2: Run to verify it fails**

Run: `cd mobile && npx jest "app/(field)/(tabs)/__tests__/commerce.test.tsx"`
Expected: FAIL — no element labelled "Nouvelle vente".

- [ ] **Step 3: Implement**

In `commerce.tsx`: import `useRouter` and `useFarmAccess`; compute `const canSell = farmRole === 'OWNER' || farmRole === 'MANAGER';`. Wrap each client card in a `Pressable` → `router.push(\`/(field)/commerce/client/${c.id}\`)`. Add, after the `ScrollView`, a `Pressable` FAB (absolute, bottom-right, `tokens.colors.accent[400]`, `ShoppingCart` icon, `accessibilityLabel="Nouvelle vente"`) rendered only `{canSell && …}` → `router.push('/(field)/commerce/vente')`.

- [ ] **Step 4: Run to verify it passes**

Run: `cd mobile && npx jest "app/(field)/(tabs)/__tests__/commerce.test.tsx" && npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "mobile/app/(field)/(tabs)/commerce.tsx" "mobile/app/(field)/(tabs)/__tests__/commerce.test.tsx"
git commit -m "feat(mobile:commerce): Vente FAB + tappable client cards (OWNER/MANAGER)"
```

---

### Task 6: Vente directe — bold design polish (de folie)

**Files:**
- Modify: `mobile/app/(field)/commerce/vente.tsx`
- Modify (if needed): `mobile/app/(field)/commerce/__tests__/vente.test.tsx` (keep passing; mock `expo-haptics`)

**Interfaces:** unchanged behavior; this task is presentation + motion only. The `createSale` body assertion from Task 4 MUST still pass.

- [ ] **Step 1: Extend the test to lock the interaction under animation**

Add to the vente test a `jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), notificationAsync: jest.fn(), ImpactFeedbackStyle: {}, NotificationFeedbackType: {} }))` and assert the screen still renders + submits after wrapping cards in animated containers (the existing submit test must stay green).

- [ ] **Step 2: Run to verify current test passes pre-change**

Run: `cd mobile && npx jest "app/(field)/commerce/__tests__/vente.test.tsx"`
Expected: PASS (baseline before restyle).

- [ ] **Step 3: Apply the design system polish**

Per the spec "Design direction":
- Production picker cards: `expo-linear-gradient` subtle token gradient, rounded (radius from tokens), `lucide-react-native` `Drumstick`/`Egg`, enter with reanimated `FadeInDown` stagger.
- Cart lines: `FadeInDown` on insert; qty steppers are green `accumulate` (`tokens.action.accumulate`); spring scale-bounce on quantity change (reanimated `withSpring`).
- Running **Total** animates on change (reanimated `useAnimatedProps`/count-up or a slide+fade).
- Sticky footer uses `expo-blur` (`BlurView`) frosted bar; the **"Valider la vente"** button uses the orange `commit` tokens (`bg accent[400]`, `fg earth`) — the single commit per screen.
- Haptics: `Haptics.impactAsync(Light)` on each add/stepper; `Haptics.notificationAsync(Success)` after a successful sale; `Warning` when `hasOverMax`.
- Success: on submit success, play a brief checkmark/pulse animation before `router.back()`.

Guard all haptics/animations so tests (jest-expo mocks) don't crash.

- [ ] **Step 4: Run tests + typecheck + lint; manual visual check**

Run: `cd mobile && npx jest "app/(field)/commerce/__tests__/vente.test.tsx" && npx tsc --noEmit && npm run lint`
Expected: PASS. Then run the app (`npx expo start`) and verify on device: staggered cards, animated total, haptics, frosted footer, success animation.

- [ ] **Step 5: Commit**

```bash
git add "mobile/app/(field)/commerce/vente.tsx" "mobile/app/(field)/commerce/__tests__/vente.test.tsx"
git commit -m "feat(mobile:commerce): bold animated vente UI (gradient cards, animated total, haptics, frosted footer)"
```

---

### Task 7: `invoicesApi` + `paymentsApi` slices

**Files:**
- Create: `mobile/src/store/api/invoicesApi.ts`
- Create: `mobile/src/store/api/paymentsApi.ts`
- Test: `mobile/src/store/api/__tests__/paymentsApi.test.ts`

**Interfaces:**
- Produces: `useGetInvoicesQuery({ farmId, clientId }) => Invoice[]`; `useRecordPaymentMutation({ farmId, body: PaymentInput }) => Payment`.

- [ ] **Step 1: Write the failing test**

```ts
// mobile/src/store/api/__tests__/paymentsApi.test.ts
import { invoicesApi } from '@/store/api/invoicesApi';
import { paymentsApi } from '@/store/api/paymentsApi';

describe('invoices + payments api', () => {
  it('lists invoices filtered by client', () => {
    expect(invoicesApi.endpoints.getInvoices.query!({ farmId: 7, clientId: 3 }))
      .toBe('/api/v1/farms/7/commercial/invoices?clientId=3');
  });
  it('POSTs a payment', () => {
    const body = { invoiceId: 9, amountXof: 5000, method: 'CASH' as const };
    expect(paymentsApi.endpoints.recordPayment.query!({ farmId: 7, body }))
      .toEqual({ url: '/api/v1/farms/7/commercial/payments', method: 'POST', body });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd mobile && npx jest src/store/api/__tests__/paymentsApi.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement both slices**

```ts
// mobile/src/store/api/invoicesApi.ts
import { baseApi } from './baseApi';
import type { Invoice } from '@/types';
interface ApiEnvelope<T> { data: T; }
const base = (farmId: number) => `/api/v1/farms/${farmId}/commercial/invoices`;

export const invoicesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getInvoices: build.query<Invoice[], { farmId: number; clientId?: number }>({
      query: ({ farmId, clientId }) =>
        clientId != null ? `${base(farmId)}?clientId=${clientId}` : base(farmId),
      transformResponse: (r: ApiEnvelope<Invoice[]>) => r.data,
      providesTags: [{ type: 'Invoice', id: 'list' }],
    }),
  }),
});
export const { useGetInvoicesQuery } = invoicesApi;
```

```ts
// mobile/src/store/api/paymentsApi.ts
import { baseApi } from './baseApi';
import type { Payment, PaymentInput } from '@/types';
interface ApiEnvelope<T> { data: T; }
const base = (farmId: number) => `/api/v1/farms/${farmId}/commercial/payments`;

export const paymentsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    recordPayment: build.mutation<Payment, { farmId: number; body: PaymentInput }>({
      query: ({ farmId, body }) => ({ url: base(farmId), method: 'POST', body }),
      transformResponse: (r: ApiEnvelope<Payment>) => r.data,
      invalidatesTags: [
        { type: 'Payment', id: 'list' },
        { type: 'Invoice', id: 'list' },
        { type: 'Client', id: 'list' },
        { type: 'Dashboard', id: 'SUMMARY' },
      ],
    }),
  }),
});
export const { useRecordPaymentMutation } = paymentsApi;
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd mobile && npx jest src/store/api/__tests__/paymentsApi.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/store/api/invoicesApi.ts mobile/src/store/api/paymentsApi.ts mobile/src/store/api/__tests__/paymentsApi.test.ts
git commit -m "feat(mobile:commerce): invoicesApi + paymentsApi (list open invoices, record payment)"
```

---

### Task 8: Client detail screen + open invoices

**Files:**
- Create: `mobile/app/(field)/commerce/client/[clientId].tsx`
- Test: `mobile/app/(field)/commerce/client/__tests__/clientDetail.test.tsx`

**Interfaces:**
- Consumes: `useGetClientsQuery` (find the client by id), `useGetInvoicesQuery` (Task 7), `useFarmAccess` (`farmRole`), `useLocalSearchParams<{ clientId }>`, `creditColor`/`CLIENT_TYPE_LABELS`/`initials`, `formatCurrency`.
- Produces: default-export `ClientDetailScreen`; renders header (name, type, `currentBalanceXof`), open-invoice rows, and an **"Encaisser"** button (OWNER/MANAGER only) that opens the payment sheet (Task 9).

- [ ] **Step 1: Write the failing test**

```tsx
// mobile/app/(field)/commerce/client/__tests__/clientDetail.test.tsx
import { render, screen } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(() => ({ clientId: '3' })),
  useRouter: jest.fn(() => ({ back: jest.fn() })),
  Redirect: () => null,
}));
jest.mock('react-redux', () => ({ useSelector: jest.fn(() => 7), useDispatch: jest.fn(() => jest.fn()), useStore: jest.fn(() => ({})) }));
jest.mock('@/auth/useSession', () => ({ useFarmAccess: jest.fn(() => ({ farmRole: 'OWNER', can: () => true, isAdmin: true, session: null })) }));
jest.mock('@/store/api/clientsApi', () => ({
  useGetClientsQuery: jest.fn(() => ({ data: [{ id: 3, displayName: 'Awa Diop', clientType: 'INDIVIDUAL', currentBalanceXof: 12000, creditLimitXof: null }] })),
}));
jest.mock('@/store/api/invoicesApi', () => ({
  useGetInvoicesQuery: jest.fn(() => ({ data: [{ id: 9, invoiceNumber: 'F-001', status: 'ISSUED', balanceXof: 12000, totalXof: 12000, paidXof: 0, dueDate: null }], isLoading: false })),
}));

import ClientDetailScreen from '@/app/(field)/commerce/client/[clientId]';

describe('Client detail', () => {
  it('shows the client, encours and an Encaisser action for OWNER', () => {
    render(<ClientDetailScreen />);
    expect(screen.getByText('Awa Diop')).toBeTruthy();
    expect(screen.getByText('F-001')).toBeTruthy();
    expect(screen.getByLabelText('Encaisser')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd mobile && npx jest "app/(field)/commerce/client/__tests__/clientDetail.test.tsx"`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the screen**

- Parse `clientId` via `useLocalSearchParams`; read `selectedFarmId`; `client = clients?.find((c) => c.id === Number(clientId))`.
- `openInvoices = (invoices ?? []).filter((i) => i.status !== 'PAID' && i.status !== 'CANCELLED')`.
- Header: `initials`, `displayName`, `CLIENT_TYPE_LABELS[clientType]`, encours = `formatCurrency(currentBalanceXof)` colored via `creditColor(client)`.
- Invoice rows: `invoiceNumber`, status chip, `formatCurrency(balanceXof)`.
- `Encaisser` button (`accessibilityLabel="Encaisser"`, orange `commit`) rendered only when `farmRole` is OWNER/MANAGER and `openInvoices.length > 0`; opens the payment sheet with `openInvoices` (Task 9 wires it). For this task, the button can set local `sheetOpen` state; the sheet component lands in Task 9.
- Empty/loading states.

- [ ] **Step 4: Run to verify it passes**

Run: `cd mobile && npx jest "app/(field)/commerce/client/__tests__/clientDetail.test.tsx" && npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "mobile/app/(field)/commerce/client/[clientId].tsx" "mobile/app/(field)/commerce/client/__tests__/clientDetail.test.tsx"
git commit -m "feat(mobile:commerce): client detail with encours + open invoices"
```

---

### Task 9: Payment sheet (recordPayment)

**Files:**
- Create: `mobile/src/commerce/PaymentSheet.tsx`
- Modify: `mobile/app/(field)/commerce/client/[clientId].tsx` (wire the sheet to the Encaisser button)
- Test: `mobile/src/commerce/__tests__/PaymentSheet.test.tsx`

**Interfaces:**
- Consumes: `useRecordPaymentMutation` (Task 7), `Invoice`, `PAYMENT_METHOD_OPTIONS`/`PAYMENT_METHOD_LABELS`, `formatCurrency`.
- Produces: `PaymentSheet({ farmId, invoices, open, onClose, onDone })` — pick an invoice (preselect the first), amount (default = invoice `balanceXof`), method (default `CASH`) → `recordPayment`.

- [ ] **Step 1: Write the failing test**

```tsx
// mobile/src/commerce/__tests__/PaymentSheet.test.tsx
import { act, fireEvent, render, screen } from '@testing-library/react-native';
const press = (el: Parameters<typeof fireEvent.press>[0]) => act(async () => { fireEvent.press(el); });

const mockRecord = jest.fn(() => ({ unwrap: () => Promise.resolve({ id: 1 }) }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), notificationAsync: jest.fn(), ImpactFeedbackStyle: {}, NotificationFeedbackType: {} }));
jest.mock('@/store/api/paymentsApi', () => ({ useRecordPaymentMutation: jest.fn(() => [mockRecord, { isLoading: false }]) }));

import { PaymentSheet } from '@/commerce/PaymentSheet';

const invoices = [{ id: 9, invoiceNumber: 'F-001', status: 'ISSUED', balanceXof: 12000, totalXof: 12000, paidXof: 0, dueDate: null, farmId: 7, clientId: 3 }];

describe('PaymentSheet', () => {
  beforeEach(() => mockRecord.mockClear());
  it('records a payment for the selected invoice at its balance', async () => {
    render(<PaymentSheet farmId={7} invoices={invoices as never} open onClose={jest.fn()} onDone={jest.fn()} />);
    await press(screen.getByText('Encaisser 12 000 FCFA')); // confirm button shows defaulted amount
    expect(mockRecord).toHaveBeenCalledWith({
      farmId: 7,
      body: expect.objectContaining({ invoiceId: 9, amountXof: 12000, method: 'CASH' }),
    });
  });
});
```

> NOTE: match the confirm-button label to what the impl renders (`Encaisser {formatCurrency(amount)}`); if `formatCurrency` uses a non-breaking thin space, keep the test string in sync or assert via `getByLabelText('Confirmer l\'encaissement')` instead.

- [ ] **Step 2: Run to verify it fails**

Run: `cd mobile && npx jest src/commerce/__tests__/PaymentSheet.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the sheet**

- Modal/bottom-sheet (`Modal` from react-native or a `View` overlay) shown when `open`.
- State: `invoiceId` (default `invoices[0]?.id`), `amount` (default selected invoice `balanceXof`), `method` (`CASH`).
- Invoice selector (rows/chips) when `invoices.length > 1`; amount `TextInput` (numeric, prefilled); method chips (`PAYMENT_METHOD_OPTIONS`).
- Confirm button: `Encaisser {formatCurrency(amount)}` → `await recordPayment({ farmId, body: { invoiceId, amountXof: amount, method } }).unwrap()`, `Haptics.notificationAsync(Success)`, `onDone()`; on error toast + keep open.
- Wire into `[clientId].tsx`: render `<PaymentSheet farmId={selectedFarmId} invoices={openInvoices} open={sheetOpen} onClose={() => setSheetOpen(false)} onDone={() => setSheetOpen(false)} />`.

- [ ] **Step 4: Run to verify it passes**

Run: `cd mobile && npx jest src/commerce/__tests__/PaymentSheet.test.tsx && npx jest "app/(field)/commerce/client" && npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/commerce/PaymentSheet.tsx "mobile/app/(field)/commerce/client/[clientId].tsx" mobile/src/commerce/__tests__/PaymentSheet.test.tsx
git commit -m "feat(mobile:commerce): payment sheet -> recordPayment (encaissement)"
```

---

### Task 10: Encaissement — bold design polish + tranche wrap-up

**Files:**
- Modify: `mobile/app/(field)/commerce/client/[clientId].tsx`, `mobile/src/commerce/PaymentSheet.tsx`
- Test: keep existing tests green.

**Interfaces:** presentation/motion only; the `recordPayment` assertion (Task 9) must still pass.

- [ ] **Step 1: Confirm baseline tests pass**

Run: `cd mobile && npx jest src/commerce "app/(field)/commerce"`
Expected: PASS (baseline before restyle).

- [ ] **Step 2: Apply polish**

- Client-detail header: `expo-linear-gradient` **encours hero** (token gradient by `creditColor` bucket), bold display number (tabular-nums), `initials` avatar.
- Invoice rows: `FadeInDown` stagger; status chips colored from tokens.
- PaymentSheet: `expo-blur` frosted backdrop; slide-up spring entrance (reanimated); method chips as pills (green `accumulate` selection); the confirm button is the orange `commit`.
- Haptics: light impact on chip/invoice selection; success notification on a completed encaissement; a success checkmark pulse before `onDone`.

- [ ] **Step 3: Run tests + typecheck + lint; manual visual check**

Run: `cd mobile && npx jest src/commerce "app/(field)/commerce" && npx tsc --noEmit && npm run lint`
Expected: PASS. Device check: gradient encours hero, frosted sheet, animated chips, success pulse.

- [ ] **Step 4: Full mobile suite**

Run: `cd mobile && npm test`
Expected: entire suite green.

- [ ] **Step 5: Commit**

```bash
git add "mobile/app/(field)/commerce/client/[clientId].tsx" mobile/src/commerce/PaymentSheet.tsx
git commit -m "feat(mobile:commerce): bold animated encaissement UI (gradient encours hero, frosted sheet, haptics)"
```

---

## Delivery / PRs

- **Tranche A (Tasks 1–6)** → PR `feat(mobile:commerce): vente directe`.
- **Tranche B (Tasks 7–10)** → PR `feat(mobile:commerce): encaissement`.
- Branch off `main` for each (or stack B on A and merge A first — avoid the stacked-merge-order trap). CI must be green before merge (per repo CLAUDE.md).

## Self-Review (done)

- **Spec coverage:** endpoints (T2/T7), availability hook (T3), vente screen+FAB (T4/T5), client detail+payment sheet (T8/T9), RBAC OWNER/MANAGER (T4/T5/T8), stock-sync invalidation (T2), design direction (T6/T10), tests throughout, two tranches (delivery). ✓
- **Placeholders:** none — every step has concrete code or an explicit, named action. Two `NOTE`s flag facts to confirm against the live web/backend (Invoice field names; exact provider tag ids), not deferred work.
- **Type consistency:** `SaleInput`/`SaleLineInput`/`Sale` (T1) used by T2/T4; `Invoice`/`Payment`/`PaymentInput` (T1) used by T7/T8/T9; `useProductionAvailability` return shape (T3) consumed by T4; `PaymentSheet` prop signature (T9) matches its wiring in T8/T9. ✓
