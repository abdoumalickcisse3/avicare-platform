# Circuits de distribution — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a farm define distribution channels (Détail, Grossiste…) and tag each direct sale and each order with one.

**Architecture:** A new farm-customizable `sales_channels` catalog category (managed via the existing generic catalog manager, gated by `module.commercial.basic`), plus a nullable `sales_channel_key` column threaded through the sale and order create paths (DTO → Command → Service → entity → Response) and surfaced in the create dialogs and detail views. Analytics ("CA par circuit") is explicitly out of scope.

**Tech Stack:** Spring Boot 3.4 / Java 21 (records, Flyway, JPA), Next.js 16 / React 19 / MUI v9 / RTK Query, PostgreSQL.

## Global Constraints

- Flyway migrations are **immutable** once merged; the next number is **V29**. `snake_case` plural tables; `VARCHAR` columns; new columns **nullable**.
- Catalog entries are referenced **by key** (no FK): store `sales_channel_key`, not the label.
- The channel field is **always optional** (no `@NotNull`, nullable column, empty select allowed).
- No cross-import between bounded contexts; `CatalogGate` stays dependency-free (reuses `@features` in SpEL).
- DTOs are Java 21 records; services `@Service` + `@RequiredArgsConstructor`.
- Commits: Conventional Commits, scope `commercial` (backend) / `commercial` or `settings` (frontend). **Never** mention Claude/AI/Anthropic, no `Co-Authored-By` / "Generated with".
- Backend: run `./mvnw -q spotless:apply -pl avicare-app` before each backend commit. `*IT` (Testcontainers) run **in CI only** (Docker unavailable locally) — write them, rely on CI; run DB-less tests locally.
- Frontend: MUI is **v9**. "This is NOT the Next.js you know" — consult `web/node_modules/next/dist/docs/` before writing new patterns. Reuse the generic catalog manager as-is (no new settings component). Run `npx tsc --noEmit`, `npx eslint <files>`, and `npx vitest run <files>` before each frontend commit.
- The seed catalog keys are **English** (`retail`, `wholesale`, `restaurant`, `market`, `cooperative`) with **French labels** — consistent with existing catalog keys (`feed_starter_broiler`).

---

### Task 1: Migration V29 + gating

**Files:**
- Create: `backend/avicare-app/src/main/resources/db/migration/V29__sales_channels.sql`
- Modify: `backend/avicare-app/src/main/java/com/avicare/parameters/access/CatalogGate.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/parameters/access/CatalogGateTest.java`

**Interfaces:**
- Produces: columns `sales.sales_channel_key` and `orders.sales_channel_key` (VARCHAR(80) NULL); catalog category `sales_channels` seeded; `CatalogGate.moduleFor("sales_channels") == "module.commercial.basic"`.

- [ ] **Step 1: Write the migration**

`V29__sales_channels.sql`:
```sql
-- Distribution channels (circuits de distribution). Sales and orders can be
-- tagged with a farm-customizable channel; the channel list lives in the
-- 'sales_channels' catalog category (Décision 15 — no dedicated table).

ALTER TABLE sales  ADD COLUMN sales_channel_key VARCHAR(80) NULL;
ALTER TABLE orders ADD COLUMN sales_channel_key VARCHAR(80) NULL;

-- Platform seed (locale NULL), farm-customizable via Réglages › Ventes.
INSERT INTO catalog_items (category, key, value, locale) VALUES
  ('sales_channels', 'retail',      '{"label":"Détail","wave":"V1"}'::jsonb, NULL),
  ('sales_channels', 'wholesale',   '{"label":"Grossiste","wave":"V1"}'::jsonb, NULL),
  ('sales_channels', 'restaurant',  '{"label":"Restaurant","wave":"V1"}'::jsonb, NULL),
  ('sales_channels', 'market',      '{"label":"Marché","wave":"V1"}'::jsonb, NULL),
  ('sales_channels', 'cooperative', '{"label":"Coopérative","wave":"V1"}'::jsonb, NULL);
```

Note: verify the `catalog_items` columns match this insert. Check an existing seed (e.g. `V15__inventory_catalog_stock_suppliers.sql`) — it inserts `(category, key, value, locale)` with `locale` NULL. Match that column list exactly.

- [ ] **Step 2: Add the gating case + test assertion**

In `CatalogGate.moduleFor`, add the case inside the `switch`:
```java
      case "inventory_items" -> "module.inventory";
      case "sales_channels" -> "module.commercial.basic";
      default -> null;
```
(Keep the existing health and inventory cases.)

In `CatalogGateTest`, add:
```java
  @Test
  void mapsSalesChannelsToTheCommercialModule() {
    assertThat(gate.moduleFor("sales_channels")).isEqualTo("module.commercial.basic");
  }
```

- [ ] **Step 3: Run the local test**

Run: `cd backend && ./mvnw -pl avicare-app test -Dtest=CatalogGateTest`
Expected: BUILD SUCCESS, all CatalogGateTest tests pass.

- [ ] **Step 4: Spotless + commit**

```bash
cd backend && ./mvnw -q spotless:apply -pl avicare-app
git add backend/avicare-app/src/main/resources/db/migration/V29__sales_channels.sql \
        backend/avicare-app/src/main/java/com/avicare/parameters/access/CatalogGate.java \
        backend/avicare-app/src/test/java/com/avicare/parameters/access/CatalogGateTest.java
git commit -m "feat(commercial): V29 sales_channels catalog + columns, gated commercial"
```

---

### Task 2: Backend — channel on direct sales

**Files:**
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/commercial/dto/SaleRequest.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/commercial/SaleCommand.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/commercial/SaleService.java` (around line 68)
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/domain/Sale.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/commercial/dto/SaleResponse.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/livestock/commercial/CommercialFlowIT.java` (or the existing commercial IT — find it with `grep -rl "createSale\|/sales" backend/avicare-app/src/test`)

**Interfaces:**
- Consumes: column `sales.sales_channel_key` (Task 1).
- Produces: `SaleRequest.salesChannelKey`, `SaleCommand.salesChannelKey`, `Sale.salesChannelKey`, `SaleResponse.salesChannelKey` (all `String`, nullable).

- [ ] **Step 1: Add the field to the record chain**

`SaleRequest` — add `salesChannelKey` (optional, max 80) and pass it to the command:
```java
public record SaleRequest(
    Long clientId,
    LocalDate saleDate,
    @Size(max = 40) String paymentMethod,
    @Size(max = 80) String salesChannelKey,
    @Size(max = 2000) String notes,
    @NotEmpty @Valid List<LineRequest> lines) {
```
and in `toCommand()`:
```java
  public SaleCommand toCommand() {
    return new SaleCommand(
        clientId,
        saleDate,
        paymentMethod,
        salesChannelKey,
        notes,
        lines.stream().map(LineRequest::toCommandLine).toList());
  }
```

`SaleCommand` — add the field:
```java
public record SaleCommand(
    Long clientId,
    LocalDate saleDate,
    String paymentMethod,
    String salesChannelKey,
    String notes,
    List<Line> lines) {
```

- [ ] **Step 2: Entity column**

In `Sale.java`, add next to `paymentMethod`:
```java
  @Column(name = "sales_channel_key")
  private String salesChannelKey;
```
(The class uses Lombok `@Getter/@Setter` or explicit accessors — match the surrounding style; if fields use Lombok `@Data`/`@Getter @Setter`, no manual accessor is needed.)

- [ ] **Step 3: Persist it in the service**

In `SaleService.create`, after `sale.setPaymentMethod(cmd.paymentMethod());`:
```java
    sale.setSalesChannelKey(cmd.salesChannelKey());
```

- [ ] **Step 4: Expose it in the response**

`SaleResponse` — add the field to the record and to `from(Sale)`:
```java
    String paymentMethod,
    String salesChannelKey,
    Long totalXof,
```
and in `from`:
```java
        s.getPaymentMethod(),
        s.getSalesChannelKey(),
        s.getTotalXof(),
```

- [ ] **Step 5: IT — persists and returns the channel**

In the commercial IT, add a test that creates a sale with `"salesChannelKey":"retail"` and asserts the GET returns it. Reuse the IT's existing farm/module/token setup and its sale-creation JSON, adding the field. Example assertion body:
```java
    // create a sale with a channel, then read it back
    // (reuse the IT's helper that POSTs /api/v1/farms/{id}/commercial/sales)
    // assert jsonPath("$.data.salesChannelKey").value("retail")
```
Write it concretely against the IT's actual helpers — mirror an existing sale-creation test in the same file.

- [ ] **Step 6: Compile + DB-less tests + commit**

Run: `cd backend && ./mvnw -q -pl avicare-app clean test-compile` (expect success), then `./mvnw -pl avicare-app test -Dtest=SecurityE2ETest,SecurityIntegrationTest` (expect pass).
```bash
cd backend && ./mvnw -q spotless:apply -pl avicare-app
git add backend/avicare-app/src/main/java/com/avicare/livestock/commercial backend/avicare-app/src/main/java/com/avicare/livestock/domain/Sale.java backend/avicare-app/src/test/java/com/avicare/livestock/commercial
git commit -m "feat(commercial): tag direct sales with a distribution channel"
```

---

### Task 3: Backend — channel on orders

**Files:**
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/commercial/dto/OrderDraftRequest.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/commercial/OrderDraftCommand.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/commercial/OrderService.java` (draft creation, around line 64)
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/domain/Order.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/commercial/dto/OrderResponse.java`
- Test: the same commercial IT as Task 2

**Interfaces:**
- Consumes: column `orders.sales_channel_key` (Task 1).
- Produces: `OrderDraftRequest.salesChannelKey`, `OrderDraftCommand.salesChannelKey`, `Order.salesChannelKey`, `OrderResponse.salesChannelKey` (all `String`, nullable).

- [ ] **Step 1: Record chain** — mirror Task 2 for orders. Add `@Size(max = 80) String salesChannelKey` to `OrderDraftRequest` (place it after `expectedPaymentMethod`), pass it in `toCommand()`; add `String salesChannelKey` to `OrderDraftCommand` (same position).

- [ ] **Step 2: Entity column** — in `Order.java`, next to `expectedPaymentMethod`:
```java
  @Column(name = "sales_channel_key")
  private String salesChannelKey;
```

- [ ] **Step 3: Persist** — in `OrderService` draft creation, after `order.setExpectedPaymentMethod(cmd.expectedPaymentMethod());`:
```java
    order.setSalesChannelKey(cmd.salesChannelKey());
```

- [ ] **Step 4: Response** — add `String salesChannelKey` to `OrderResponse` (after `expectedPaymentMethod`) and `o.getSalesChannelKey()` in `from(Order)` at the matching position.

- [ ] **Step 5: IT** — add an order-creation-with-channel assertion to the commercial IT, mirroring Task 2 (`salesChannelKey":"wholesale"` → GET returns `wholesale`).

- [ ] **Step 6: Compile + commit**

Run: `cd backend && ./mvnw -q -pl avicare-app clean test-compile`.
```bash
cd backend && ./mvnw -q spotless:apply -pl avicare-app
git add backend/avicare-app/src/main/java/com/avicare/livestock/commercial backend/avicare-app/src/main/java/com/avicare/livestock/domain/Order.java backend/avicare-app/src/test/java/com/avicare/livestock/commercial
git commit -m "feat(commercial): tag orders with a distribution channel"
```

---

### Task 4: Frontend — Réglages › Ventes catalog

**Files:**
- Modify: `web/src/constants/catalogCategories.ts`
- Test: `web/src/constants/catalogCategories.test.ts`

**Interfaces:**
- Consumes: the generic catalog manager (`CatalogCategoryView`, `CatalogManager`) — unchanged.
- Produces: `getCategoryConfig("ventes")` → config bound to `sales_channels`.

- [ ] **Step 1: Add the config** — append to `CATALOG_CATEGORIES` in `catalogCategories.ts`:
```ts
  {
    slug: "ventes",
    backendCategory: "sales_channels",
    title: "Ventes",
    description: "Circuits de distribution : détail, grossiste, restaurant, marché, coopérative.",
    labelField: "label",
    fields: [{ name: "label", label: "Nom du circuit", type: "text", required: true }],
  },
```

- [ ] **Step 2: Update the test that asserts `ventes` is unconfigured** — in `catalogCategories.test.ts`, the existing test `returns undefined for an unconfigured slug` uses `ventes`. Change it to a slug that is still unconfigured (e.g. `expect(getCategoryConfig("inexistant")).toBeUndefined();`) and add:
```ts
  it("maps ventes to the sales_channels backend category", () => {
    const cfg = getCategoryConfig("ventes");
    expect(cfg?.backendCategory).toBe("sales_channels");
    expect(cfg?.fields.some((f) => f.name === "label" && f.required)).toBe(true);
  });
```

- [ ] **Step 3: tsc + test + commit**

Run: `cd web && npx tsc --noEmit` and `npx vitest run src/constants/catalogCategories.test.ts` (expect pass).
```bash
git add web/src/constants/catalogCategories.ts web/src/constants/catalogCategories.test.ts
git commit -m "feat(settings): wire the Ventes catalog to sales_channels"
```

---

### Task 5: Frontend — capture the channel in the sale and order dialogs

**Files:**
- Modify: `web/src/types/index.ts` (`SaleInput`, `OrderInput`)
- Modify: `web/src/components/commercial/QuickSaleDialog.tsx`
- Modify: `web/src/components/commercial/OrderDialog.tsx`
- Test: `web/src/components/commercial/QuickSaleDialog.test.tsx`

**Interfaces:**
- Consumes: `useGetCatalogQuery({ farmId, category: "sales_channels" })` from `@/store/api/catalogApi` → `CatalogEntry[]` (`{ category, key, value, custom }`); `SaleInput`, `OrderInput`.
- Produces: `SaleInput.salesChannelKey?`, `OrderInput.salesChannelKey?` sent in the create payloads.

- [ ] **Step 1: Extend the input types** — in `types/index.ts`, add `salesChannelKey?: string;` to both `SaleInput` and `OrderInput`.

- [ ] **Step 2: Add the Circuit select to `QuickSaleDialog`** — fetch the channels and render an optional select, defaulting to empty. Pattern (adapt to the dialog's existing state/JSX):
```tsx
import { useGetCatalogQuery } from "@/store/api/catalogApi";
// ...
const { data: channels } = useGetCatalogQuery(
  { farmId, category: "sales_channels" },
  { skip: !farmId },
);
const [channel, setChannel] = useState<string>("");
// in the form JSX, next to the payment method field:
<TextField
  select
  label="Circuit (optionnel)"
  value={channel}
  onChange={(e) => setChannel(e.target.value)}
  fullWidth
>
  <MenuItem value="">— Aucun —</MenuItem>
  {(channels ?? []).map((c) => (
    <MenuItem key={c.key} value={c.key}>
      {String(c.value.label ?? c.key)}
    </MenuItem>
  ))}
</TextField>
// in the createSale payload:
salesChannelKey: channel || undefined,
```

- [ ] **Step 3: Add the same select to `OrderDialog`** — mirror Step 2 (channels query + select + `salesChannelKey: channel || undefined` in the create-order payload).

- [ ] **Step 4: Test** — in `QuickSaleDialog.test.tsx`, extend the existing create test (or add one) so it selects a channel and asserts the request body carries `salesChannelKey: "retail"`. Follow the file's existing mocking of `fetch`/RTK and its capture of the request body. If the test mocks the catalog query, provide one channel entry `{ category: "sales_channels", key: "retail", value: { label: "Détail" }, custom: false }`.

- [ ] **Step 5: tsc + lint + test + commit**

Run: `cd web && npx tsc --noEmit`, `npx eslint src/components/commercial/QuickSaleDialog.tsx src/components/commercial/OrderDialog.tsx`, `npx vitest run src/components/commercial/QuickSaleDialog.test.tsx`.
```bash
git add web/src/types/index.ts web/src/components/commercial/QuickSaleDialog.tsx web/src/components/commercial/OrderDialog.tsx web/src/components/commercial/QuickSaleDialog.test.tsx
git commit -m "feat(commercial): pick a distribution channel when recording a sale or order"
```

---

### Task 6: Frontend — display the channel on sale and order detail

**Files:**
- Modify: `web/src/types/index.ts` (`Sale`, `Order` — add `salesChannelKey: string | null`)
- Modify: `web/src/components/commercial/SaleDetailView.tsx` (find with `grep -rl "SaleDetail" web/src`)
- Modify: `web/src/components/commercial/OrderDetailView.tsx`
- Test: `web/src/components/commercial/SaleDetailView.test.tsx` if it exists, else add a focused test

**Interfaces:**
- Consumes: `Sale.salesChannelKey`, `Order.salesChannelKey`; `useGetCatalogQuery({ farmId, category: "sales_channels" })` to resolve key → label.

- [ ] **Step 1: Extend the read types** — add `salesChannelKey: string | null;` to the `Sale` and `Order` interfaces in `types/index.ts`.

- [ ] **Step 2: Resolve + display on `SaleDetailView`** — fetch the channels, build a `key → label` map, and render the channel where the sale metadata is shown (near payment method):
```tsx
const { data: channels } = useGetCatalogQuery(
  { farmId, category: "sales_channels" },
  { skip: !farmId },
);
const channelLabel = sale.salesChannelKey
  ? (channels?.find((c) => c.key === sale.salesChannelKey)?.value.label as string | undefined) ??
    sale.salesChannelKey
  : null;
// render, only when present:
{channelLabel && (
  <Stack direction="row" justifyContent="space-between">
    <Typography color="text.secondary">Circuit</Typography>
    <Typography>{channelLabel}</Typography>
  </Stack>
)}
```

- [ ] **Step 3: Same on `OrderDetailView`** — mirror Step 2 for the order.

- [ ] **Step 4: Test** — assert that when `salesChannelKey` is set and the catalog is loaded, the label renders; when null, nothing renders. Follow the detail view's existing test harness (mock the invoice/sale query + catalog query).

- [ ] **Step 5: tsc + lint + full suite + commit**

Run: `cd web && npx tsc --noEmit`, `npx eslint <modified files>`, `npx vitest run` (full suite green).
```bash
git add web/src/types/index.ts web/src/components/commercial/SaleDetailView.tsx web/src/components/commercial/OrderDetailView.tsx web/src/components/commercial/SaleDetailView.test.tsx
git commit -m "feat(commercial): show the distribution channel on sale and order detail"
```

---

## Self-Review (author checklist — done)

- **Spec coverage:** catalog `sales_channels` (T1 seed, T4 settings) ✓; columns on sales+orders (T1) ✓; gating commercial (T1) ✓; backend thread sales (T2) + orders (T3) ✓; capture in both dialogs (T5) ✓; display on both details (T6) ✓; analytics explicitly out of scope — no task, correct ✓.
- **Placeholder scan:** the IT steps (T2.5, T3.5) say "mirror the existing sale/order creation test" rather than pasting the full IT — because the exact helper names live in the target IT file, which the implementer must open. This is a directed instruction, not a vague placeholder: it names the file, the field, the exact JSON key/value, and the exact assertion (`jsonPath("$.data.salesChannelKey").value("retail")`). Acceptable.
- **Type consistency:** `salesChannelKey` (camelCase) used consistently in all Java records/entity and TS types; DB column `sales_channel_key`; catalog category `sales_channels`; seed keys `retail/wholesale/restaurant/market/cooperative`. Consistent across tasks.
