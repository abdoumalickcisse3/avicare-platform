# Mobile Commerce — Vente directe + Encaissement (design)

**Date:** 2026-08-02
**Scope:** Add the two commercial *write* actions to the mobile app — a direct
sale ("Vente directe") and a payment collection ("Encaissement") — mirroring the
web exactly, online-only, with no backend changes.

## Context

The mobile app is a field MVP (doc 08). Production entry is rich (mortalité,
pesée, œufs, journalier, vaccination). The three "business" modules are today
**read-only** on mobile: Commerce (carnet clients + encours), Stock, Finance.

This spec makes **Commerce** the first module to gain write actions on mobile,
starting with the two highest-value field operations: selling farm production and
collecting a debtor's payment.

Guiding constraint (user): **"être sur la même longueur d'onde avec le web"** —
replay the same endpoints, DTOs and business rules as the web client.

## Decisions (locked during brainstorming)

- **Online-only.** Like the web and the rest of mobile Commerce. A sale
  decrements stock and touches money; offline reconciliation is out of scope.
  (Contrast: mortality/weighing use `client_ref` offline replay — sales do not,
  per doc 08 §9.)
- **Nav = FAB + fiche client.** A floating "Vente" button on the Commerce tab
  opens the sale full-screen; tapping a client opens their detail with an
  "Encaisser" button.
- **RBAC = OWNER/MANAGER only**, mirroring the backend `WRITE_MANAGER` gate on
  `createSale` / `recordPayment`. A FARMER cannot ring up a direct sale (that
  would be a separate backend change, explicitly out of scope here).
- **No backend changes.** The endpoints, gating and business rules already exist
  and are exercised by the web.

## Backend contract (reused as-is)

All under `/api/v1/farms/{farmId}/commercial`, gated
`@features.isEnabled(#farmId,'module.commercial.basic')`:

| Action | Endpoint | Gate | Body |
|---|---|---|---|
| Create sale | `POST /sales` | `WRITE_MANAGER` (OWNER/MANAGER) | `SaleInput` |
| List invoices | `GET /invoices?clientId=` | `READ` (`commercial:read`) | — |
| Record payment | `POST /payments` | `WRITE_MANAGER` | `PaymentInput` |
| List clients | `GET /clients` | `READ` | — (already on mobile) |

Production availability (for the sale cart) comes from existing mobile slices:
`poultryBatchesApi` (broiler `currentCount`) and `eggProductionApi` (tray-stock
plateaux).

### DTOs (mirror web `@/types`)

```ts
// SaleInput
{ clientId?: number | null; saleDate?: string; paymentMethod?: string;
  salesChannelKey?: string; notes?: string; lines: SaleLineInput[] }
// SaleLineInput
{ articleKey: string; articleSource: ArticleSource; quantity: number;
  unitPriceXof: number; productType?: ProductType; productionUnitId?: number; notes?: string }
// PaymentInput
{ invoiceId: number; amount?: number; method: 'CASH'|'MOBILE_MONEY'|'BANK_TRANSFER'; ... }
```

- A **sale is a single `createSale` call**. It does NOT create an invoice or a
  payment; `paymentMethod` is a tag on the sale (this is the web "Vente directe").
- A **payment is recorded against an invoice** (`invoiceId`) and updates the
  client receivable/encours (D26). This is the "client = compte courant" flow.
- **Oversell is blocked** by the backend (422, D27); the front keeps a soft
  `max` guard and surfaces the 422 as a toast.
- Walk-in sale (`clientId: null`) is allowed.

## Architecture / components

### New RTK Query slices — `mobile/src/store/api/`

- `salesApi.ts` → `createSale` mutation.
  `invalidatesTags: Client, PoultryBatch, ProductionUnit, TrayStock,
  DailyProduction, Dashboard` — so the lots, œufs stock and dashboard refresh
  after a production sale (prodstock↔commercial sync).
- `invoicesApi.ts` → `getInvoices({ farmId, clientId })` query
  (`providesTags: Invoice`).
- `paymentsApi.ts` → `recordPayment` mutation.
  `invalidatesTags: Invoice, Client, Dashboard`.
- Add `'Sale' | 'Invoice' | 'Payment'` to `baseApi` `tagTypes`.

Each endpoint uses `transformResponse: (r) => r.data` (ApiResponse envelope) and
the shared `baseApi` (401-refresh already in place).

### Availability hook — `mobile/src/commerce/useProductionAvailability.ts`

Mobile port of the web hook. Returns:
```ts
{ broilerLots: { unitId: number; label: string; heads: number }[];
  eggsAvailable: number; loading: boolean }
```
- broilerLots: batches with `currentCount > 0`.
- eggsAvailable: tray-stock plateaux from `eggProductionApi`.

### Screens — `mobile/app/(field)/`

1. **FAB "Vente"** on `(tabs)/commerce.tsx` — visible only if the current user's
   role on the farm is OWNER or MANAGER (from decoded JWT memberships). Routes to
   the sale screen.
2. **`commerce/vente.tsx`** — Vente directe (full-screen):
   - production picker cards (broiler lots + œufs) → tap adds a line;
   - cart: qty steppers (+/−) + prix unitaire input + line total; soft over-`max`
     warning;
   - client selector (default "Client de passage" = `null`);
   - payment method chips (Espèces / Mobile Money / Virement);
   - optional circuit (sales_channels catalog);
   - sticky footer: Total + "Valider la vente" → `createSale`.
   - Empty-state when no production to sell (mirror web copy).
   - On 422 oversell → toast; on success → toast + close.
3. **`commerce/client/[clientId].tsx`** — fiche client:
   - header: name, client type, encours (colored by `currentBalanceXof`);
   - open invoices list (`getInvoices`);
   - "Encaisser" button (OWNER/MANAGER) → payment sheet: choose invoice →
     montant (default = invoice balance) + method → `recordPayment`.
   - Client cards in the Commerce tab become tappable → this screen.

### Shared lib — `mobile/src/lib/commercial.ts` (exists)

Add `PAYMENT_METHOD_LABELS` / `PAYMENT_METHOD_OPTIONS`
(`CASH`→Espèces, `MOBILE_MONEY`→Mobile Money, `BANK_TRANSFER`→Virement) if not
already present. Reuse existing `creditColor`, `CLIENT_TYPE_LABELS`, `initials`.

## Design direction (bold & modern — non-negotiable)

The user insists on a "design de folie et moderne". These screens must feel
premium and tactile, not utilitarian — while staying **coherent with the existing
mobile design system** (`src/theme/tokens.ts`, "Terroir vivant"). No one-off
colors: everything derives from tokens.

**Action language (already in the design system — use it literally):**
- **`accumulate`** (green `primary[600]`, white text) = repeated, reversible acts
  → production picker cards, qty `+/−` steppers, add-to-cart.
- **`commit`** (orange `accent[400]`, `earth` text, once per screen) = the single
  decisive act → **"Valider la vente"** and **"Encaisser"**. Exactly one commit
  button per screen.

**Palette / typography:** `primary` (green), `accent` (orange), `earth` deep
green; bold display weights for headers and the running total; **tabular-nums**
mono for every money value.

**Motion (react-native-reanimated 4):**
- Production cards + cart lines enter with `FadeInDown` stagger.
- Add-to-cart / qty change: spring scale-bounce on the line; the **running total
  animates** (count-up / slide) on every change.
- Validate: button morph → success **checkmark draw** + brief celebratory pulse,
  then dismiss.

**Haptics (expo-haptics):** light impact on each stepper/add; success
notification on a completed sale/payment; warning on over-max.

**Depth & texture:**
- `expo-linear-gradient` hero: the client **encours** header and the production
  picker cards use subtle token-derived gradients.
- `expo-blur` for the sticky footer (Total + Valider) and the payment sheet
  backdrop — content scrolls under a frosted bar.
- `lucide-react-native` iconography (Egg, Drumstick, Wallet, Banknote…) matching
  the web's visual language.

**Layout feel:** generous rounded cards (radius from tokens), large thumb-reach
touch targets, a **sticky frosted footer** carrying the animated Total and the
single orange commit button — the "hero" of each screen.

This direction applies to both `vente.tsx` and `client/[clientId].tsx` (+ payment
sheet). The plan must include explicit polish/animation tasks, not treat design
as an afterthought.

## RBAC & visibility

- The FAB and the "Encaisser" button render only when the user is OWNER or
  MANAGER on the current farm (role from JWT memberships), mirroring the backend
  `WRITE_MANAGER`. Other roles keep today's read-only Commerce (unchanged).
- Reads (clients, invoices) require `commercial:read` — already how the tab is
  gated.

## Error handling

- Backend 422 (oversell D27, validation) → user-friendly toast via the shared
  `apiErrorMessage` helper; the cart is preserved for correction.
- 403 (role/gating) should not normally be reachable because the entry points are
  hidden, but the API layer still surfaces it cleanly (no crash).
- Network error (online-only) → toast asking to retry with connection.

## Testing

React Native Testing Library, following mobile patterns (`act()` flush after
`fireEvent.press`, `jest` mocked API):

- **vente**: add a broiler lot → set qty/price → Valider → asserts `createSale`
  called with the expected `SaleInput` (lines, clientId null for walk-in,
  paymentMethod); over-max shows a warning and blocks submit.
- **encaissement**: open a client with an invoice → Encaisser → pick invoice →
  submit → asserts `recordPayment` called with `{ invoiceId, amount, method }`.
- role gating: FAB hidden for FARMER, shown for OWNER.

## Staging

Two tranches, one spec:

- **Tranche A — Vente directe**: slices (`salesApi`), availability hook, the
  `vente.tsx` screen + FAB, tests. Ships first (highest field value,
  self-contained).
- **Tranche B — Encaissement**: `invoicesApi` + `paymentsApi`, the client detail
  screen + payment sheet, tests.

## Out of scope (YAGNI)

- Offline queue / `client_ref` for sales/payments.
- Client CRUD on mobile (stays web), cancel-sale / void-payment.
- Letting FARMER create direct sales (backend `WRITE_MANAGER` change).
- Orders/deliveries pipeline, purchase orders, sales-stats.
