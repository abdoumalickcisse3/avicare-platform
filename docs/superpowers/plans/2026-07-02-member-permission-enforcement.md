# Application des permissions membre — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate the sidebar menu, the module read endpoints, and the dashboard sections by the logged-in member's granular permissions (`resource:read`), so a FARMER no longer sees or reads modules they lack.

**Architecture:** Frontend decodes the access JWT it already holds (claim `memberships`) to know the current member's permissions and hides nav entries accordingly. Backend flips the shared module `READ` `@PreAuthorize` constants from `hasAccess` to `hasPermission('resource:read')`, and the dashboard aggregation service omits sections the member can't read. Writes are unchanged.

**Tech Stack:** Spring Boot 3.4 / Java 21 (`@PreAuthorize` SpEL via `FarmAccessChecker`), Next.js 16 / TypeScript / MUI v9 / RTK Query / Vitest.

## Global Constraints

- No Flyway migration. No new runtime dependency (decode the JWT payload manually — do NOT add `jwt-decode`).
- Commits: Conventional Commits with bounded-context scope; **NO AI/Claude/Anthropic signature**, no robot emoji, no `Co-Authored-By`.
- Writes stay on their current `hasRole(...)` tiers — only READ endpoints change.
- Backend: run `./mvnw -q spotless:apply -pl avicare-app` before commit; `./mvnw -q -pl avicare-app -am test-compile` (exit 0) is the authoritative local gate. `*IT` (Testcontainers) run in **CI only** (Docker 29.x can't run them locally) — do NOT try to run them.
- Frontend: no hardcoded hex (tokens only); `tsc --noEmit`, `eslint`, `vitest` must be clean on changed files. Full-project tsc/lint/build green is required by the LAST frontend task.
- Permission format & wildcards (from `Membership`): `*` grants everything; `resource:*` grants every verb on a resource; else exact `resource:verb`. OWNER carries `["*"]`.
- The access JWT `memberships` claim serializes each membership as `{ "farmId": <number>, "farmRole": "<ROLE>", "permissions": ["..."] }` (Jackson field names of the Java `Membership` record).

---

## File Structure

**Frontend (new):**
- `web/src/lib/permissions.ts` — pure: `decodeJwtPayload`, `memberHasPermission`, `JwtMembership` type.
- `web/src/hooks/useFarmPermissions.ts` — hook returning `{ can(permission) }` for a farm.

**Frontend (modified):**
- `web/src/components/layout/Sidebar.tsx` — add `requiredPermission` to nav entries + gate.

**Backend (modified):**
- `InventoryAccess.java`, `CommercialAccess.java`, `HealthAccess.java`, `LayerAccess.java` (in `livestock/controller/`) and `PoultryBatchController.java` — flip `READ*` constants to `hasPermission`.
- Parameters read endpoints: `FarmSettingsController`, `FarmCatalogController`, `PriceListController`, `AlertThresholdController` — GET `@PreAuthorize` → `settings:read`.
- `reporting/service/ReportingService.java` — inject `FarmAccessChecker`, gate `commercial`/`livestock` sections by permission.

**Tests (new/modified):**
- `web/src/lib/permissions.test.ts`, `web/src/hooks/useFarmPermissions.test.ts`, `web/src/components/layout/Sidebar.test.tsx` (extend).
- `backend/.../reporting/service/ReportingServiceTest.java` (extend).
- `backend/.../tenancy/ModulePermissionIT.java` (new IT) and audits of existing livestock/parameters ITs.

**Note on dashboard frontend:** no change needed. The backend (Task B3) OMITS unauthorized sections from the payload, and `dashboard/page.tsx` already renders sections only when present (`!!dashboardData?.commercial`). Adding a front-side `can()` gate there would be dead code (the data is already absent) — deliberately out of scope per DRY/YAGNI (refines spec §5: backend omission is the enforcement).

---

### Task F1: `permissions` lib (pure JWT decode + wildcard match)

**Files:**
- Create: `web/src/lib/permissions.ts`
- Test: `web/src/lib/permissions.test.ts`

**Interfaces:**
- Produces:
  - `interface JwtMembership { farmId: number; farmRole: string; permissions: string[] }`
  - `interface JwtPayload { memberships?: JwtMembership[] }`
  - `decodeJwtPayload(token: string | null | undefined): JwtPayload | null`
  - `memberHasPermission(perms: string[], target: string): boolean`

- [ ] **Step 1: Write the failing test** — `web/src/lib/permissions.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { decodeJwtPayload, memberHasPermission } from "./permissions";

// Build a fake JWT (header.payload.signature) with a base64url payload.
function makeJwt(payload: unknown): string {
  const b64 = btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `h.${b64}.s`;
}

describe("memberHasPermission", () => {
  it("matches an exact resource:verb", () => {
    expect(memberHasPermission(["inventory:read"], "inventory:read")).toBe(true);
    expect(memberHasPermission(["inventory:read"], "inventory:write")).toBe(false);
  });
  it("honors resource:* wildcard", () => {
    expect(memberHasPermission(["inventory:*"], "inventory:read")).toBe(true);
    expect(memberHasPermission(["inventory:*"], "commercial:read")).toBe(false);
  });
  it("honors the global * wildcard", () => {
    expect(memberHasPermission(["*"], "commercial:write")).toBe(true);
  });
  it("returns false for an empty permission list", () => {
    expect(memberHasPermission([], "inventory:read")).toBe(false);
  });
});

describe("decodeJwtPayload", () => {
  it("decodes the memberships claim", () => {
    const token = makeJwt({
      sub: "5",
      memberships: [{ farmId: 3, farmRole: "FARMER", permissions: ["poultry:read"] }],
    });
    const payload = decodeJwtPayload(token);
    expect(payload?.memberships?.[0]).toEqual({
      farmId: 3,
      farmRole: "FARMER",
      permissions: ["poultry:read"],
    });
  });
  it("returns null for null/garbage tokens", () => {
    expect(decodeJwtPayload(null)).toBeNull();
    expect(decodeJwtPayload(undefined)).toBeNull();
    expect(decodeJwtPayload("not-a-jwt")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/lib/permissions.test.ts`
Expected: FAIL (module `./permissions` not found).

- [ ] **Step 3: Write the implementation** — `web/src/lib/permissions.ts`

```ts
/** A single farm membership as carried in the access-JWT `memberships` claim. */
export interface JwtMembership {
  farmId: number;
  farmRole: string;
  permissions: string[];
}

export interface JwtPayload {
  memberships?: JwtMembership[];
}

/**
 * Decode the payload segment of a JWT WITHOUT verifying its signature (the
 * backend is the authority; the client reads memberships for UX gating only).
 * Returns null for a missing or malformed token.
 */
export function decodeJwtPayload(token: string | null | undefined): JwtPayload | null {
  if (!token) return null;
  const segment = token.split(".")[1];
  if (!segment) return null;
  try {
    const b64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
    return JSON.parse(atob(b64 + pad)) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Whether `perms` grants `target` (a `resource:verb` string), honoring the
 * `*` and `resource:*` wildcards carried by a membership.
 */
export function memberHasPermission(perms: string[], target: string): boolean {
  if (perms.includes("*")) return true;
  if (perms.includes(target)) return true;
  const resource = target.split(":")[0];
  return perms.includes(`${resource}:*`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run src/lib/permissions.test.ts`
Expected: PASS (all cases). Then `cd web && npx tsc --noEmit 2>&1 | grep permissions` → no errors on these files.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/permissions.ts web/src/lib/permissions.test.ts
git commit -m "feat(web): jwt membership decode + permission wildcard matcher"
```

---

### Task F2: `useFarmPermissions` hook

**Files:**
- Create: `web/src/hooks/useFarmPermissions.ts`
- Test: `web/src/hooks/useFarmPermissions.test.ts`

**Interfaces:**
- Consumes: `decodeJwtPayload`, `memberHasPermission` (F1); `useAppSelector` from `@/store/hooks` (state shape `state.auth.accessToken: string | null`).
- Produces: `useFarmPermissions(farmId: number | undefined): { can: (permission: string) => boolean }`.

- [ ] **Step 1: Write the failing test** — `web/src/hooks/useFarmPermissions.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { Provider } from "react-redux";
import { makeStore } from "@/store/store";
import { setTokens } from "@/store/slices/authSlice";
import { useFarmPermissions } from "./useFarmPermissions";

function makeJwt(payload: unknown): string {
  const b64 = btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `h.${b64}.s`;
}

function wrapperWithToken(token: string | null) {
  const store = makeStore();
  if (token) store.dispatch(setTokens({ accessToken: token, refreshToken: "r" }));
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  };
}

describe("useFarmPermissions", () => {
  it("grants permissions from the membership of the given farm", () => {
    const token = makeJwt({
      memberships: [{ farmId: 3, farmRole: "FARMER", permissions: ["poultry:read", "health:read"] }],
    });
    const { result } = renderHook(() => useFarmPermissions(3), { wrapper: wrapperWithToken(token) });
    expect(result.current.can("poultry:read")).toBe(true);
    expect(result.current.can("inventory:read")).toBe(false);
  });

  it("denies everything when there is no membership for the farm", () => {
    const token = makeJwt({ memberships: [{ farmId: 99, farmRole: "OWNER", permissions: ["*"] }] });
    const { result } = renderHook(() => useFarmPermissions(3), { wrapper: wrapperWithToken(token) });
    expect(result.current.can("poultry:read")).toBe(false);
  });

  it("denies everything with no token", () => {
    const { result } = renderHook(() => useFarmPermissions(3), { wrapper: wrapperWithToken(null) });
    expect(result.current.can("poultry:read")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/hooks/useFarmPermissions.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write the implementation** — `web/src/hooks/useFarmPermissions.ts`

```ts
import { useMemo } from "react";
import { useAppSelector } from "@/store/hooks";
import { decodeJwtPayload, memberHasPermission } from "@/lib/permissions";

/**
 * Permissions the current user holds on `farmId`, read from the access JWT the
 * client already holds. `can` honors `*` / `resource:*` wildcards. Fail-closed:
 * no token, no membership, or an undefined farm → `can` is always false.
 */
export function useFarmPermissions(farmId: number | undefined): {
  can: (permission: string) => boolean;
} {
  const token = useAppSelector((s) => s.auth.accessToken);
  return useMemo(() => {
    const membership = decodeJwtPayload(token)?.memberships?.find((m) => m.farmId === farmId);
    const perms = membership?.permissions ?? [];
    return { can: (permission: string) => memberHasPermission(perms, permission) };
  }, [token, farmId]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run src/hooks/useFarmPermissions.test.ts`
Expected: PASS. Then `cd web && npx tsc --noEmit 2>&1 | grep useFarmPermissions` → no errors on these files.

- [ ] **Step 5: Commit**

```bash
git add web/src/hooks/useFarmPermissions.ts web/src/hooks/useFarmPermissions.test.ts
git commit -m "feat(web): useFarmPermissions hook (per-farm can() from JWT)"
```

---

### Task F3: gate the sidebar by member permissions

**Files:**
- Modify: `web/src/components/layout/Sidebar.tsx`
- Test: `web/src/components/layout/Sidebar.test.tsx` (extend)

**Interfaces:**
- Consumes: `useFarmPermissions` (F2). `useActiveModules()` already returns `{ farmId, hasFarm, isLoading, isModuleActive }`.

- [ ] **Step 1: Write the failing test** — add to `web/src/components/layout/Sidebar.test.tsx`

First, add a mock for the new hook near the other `vi.mock` calls at the top of the file:

```ts
const permsMock = vi.fn();
vi.mock("@/hooks/useFarmPermissions", () => ({
  useFarmPermissions: () => permsMock(),
}));

function mockPerms(perms: string[]) {
  permsMock.mockReturnValue({
    can: (p: string) =>
      perms.includes("*") ||
      perms.includes(p) ||
      perms.includes(`${p.split(":")[0]}:*`),
  });
}
```

In the `beforeEach`, add `permsMock.mockReset(); mockPerms(["*"]);` (default: OWNER-like, sees everything — keeps existing tests green).

Then add a new describe block:

```ts
describe("Sidebar permission gating", () => {
  beforeEach(() => {
    activeModulesMock.mockReset();
    focusMock.mockReset();
    permsMock.mockReset();
    mockFocus([]);
  });

  it("hides Stocks, Commercial and Réglages from a FARMER (poultry+health only)", () => {
    mockModules(["module.poultry.broiler", "module.inventory", "module.commercial.basic"]);
    mockPerms(["poultry:read", "poultry:write", "health:read", "health:write"]);
    renderWithProviders(<Sidebar />);
    expect(screen.queryByText("Stocks")).not.toBeInTheDocument();
    expect(screen.queryByText("Commercial")).not.toBeInTheDocument();
    expect(screen.queryByText("Réglages")).not.toBeInTheDocument();
    expect(screen.getByText("Élevage")).toBeInTheDocument();
  });

  it("shows every module to an OWNER (wildcard)", () => {
    mockModules(["module.poultry.broiler", "module.inventory", "module.commercial.basic"]);
    mockPerms(["*"]);
    renderWithProviders(<Sidebar />);
    expect(screen.getByText("Stocks")).toBeInTheDocument();
    expect(screen.getByText("Commercial")).toBeInTheDocument();
    expect(screen.getByText("Réglages")).toBeInTheDocument();
  });

  it("still hides a module the farm has not subscribed to, even with the permission", () => {
    mockModules(["module.poultry.broiler"]); // inventory NOT subscribed
    mockPerms(["*"]);
    renderWithProviders(<Sidebar />);
    expect(screen.queryByText("Stocks")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/components/layout/Sidebar.test.tsx`
Expected: FAIL (Sidebar does not yet gate by permission; Stocks/Commercial/Réglages still render for a FARMER).

- [ ] **Step 3: Implement the gating** — edit `web/src/components/layout/Sidebar.tsx`

1. Add the import near the other hooks imports:

```ts
import { useFarmPermissions } from "@/hooks/useFarmPermissions";
```

2. Extend the `Leaf` and `Group` interfaces with an optional `requiredPermission`:

In `interface Leaf { ... }` add: `requiredPermission?: string;`
In `interface Group { ... }` add: `requiredPermission?: string;`

3. Add `requiredPermission` to the relevant NAV entries:
- Élevage children: `Poulets de chair` → `requiredPermission: "poultry:read"`; `Œufs` → `requiredPermission: "poultry:read"`; `Sanitaire` → `requiredPermission: "health:read"`.
- `Stocks` group → add `requiredPermission: "inventory:read"`.
- `Commercial` group → add `requiredPermission: "commercial:read"`.
- `Réglages` leaf → add `requiredPermission: "settings:read"`.
(Leave `Tableau de bord`, `Fermes`, `Abonnement` ungated.)

4. In the `Sidebar` component body, read the hook (farmId comes from `useActiveModules`):

```ts
  const { isModuleActive, isLoading, farmId, hasFarm } = useActiveModules();
  const { can } = useFarmPermissions(farmId);
```

5. Gate the child visibility — extend `childVisible`:

```ts
  const childVisible = (c: Leaf) =>
    (!c.requiredModule || isModuleActive(c.requiredModule)) &&
    (!c.requiredModuleAny || c.requiredModuleAny.some(isModuleActive)) &&
    (!c.requiredPermission || can(c.requiredPermission)) &&
    (!c.focusToken || focus.length === 0 || focus.includes(c.focusToken));
```

6. Gate the group — at the top of `renderGroup`, after the existing module check:

```ts
  const renderGroup = (group: Group) => {
    if (group.requiredModule && !isModuleActive(group.requiredModule)) return null;
    if (group.requiredPermission && !can(group.requiredPermission)) return null;
    // ...unchanged...
```

7. Gate top-level leaves (for Réglages) — in the section render, replace the leaf branch:

Find:
```ts
                {section.entries.map((entry) =>
                  entry.kind === "group" ? renderGroup(entry) : leafButton(entry, false),
                )}
```
Replace with:
```ts
                {section.entries.map((entry) =>
                  entry.kind === "group"
                    ? renderGroup(entry)
                    : entry.requiredPermission && !can(entry.requiredPermission)
                      ? null
                      : leafButton(entry, false),
                )}
```

- [ ] **Step 4: Run tests + full frontend gate**

```bash
cd web
npx vitest run src/components/layout/Sidebar.test.tsx   # all pass (new + existing)
npx tsc --noEmit                                         # exit 0
npm run lint                                             # 0 errors
npx vitest run                                           # whole suite green
npx next build                                           # Compiled successfully
```
Expected: all green. (This is the last frontend task — the whole app must build.)

- [ ] **Step 5: Commit**

```bash
git add web/src/components/layout/Sidebar.tsx web/src/components/layout/Sidebar.test.tsx
git commit -m "feat(web): gate sidebar modules by member permissions"
```

---

### Task B3: gate dashboard sections by permission (backend)

**Files:**
- Modify: `backend/avicare-app/src/main/java/com/avicare/reporting/service/ReportingService.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/reporting/service/ReportingServiceTest.java` (extend)

**Interfaces:**
- Consumes: `FarmAccessChecker` (`@Component("farmAccess")` in `common-security`): `boolean hasPermission(Long, String)`, `boolean hasAnyPermission(Long, String...)`.
- Produces: `ReportingService.buildDashboard` now omits `commercial` unless the caller holds `commercial:read` or `finance:read`, and omits `livestock` unless the caller holds `poultry:read`.

- [ ] **Step 1: Write the failing test** — extend `ReportingServiceTest.java`

Read the existing test first to mirror its setup (it mocks `SubscriptionFacade`, `CommercialFacade`, `LivestockFacade` and constructs `ReportingService`). Add a mocked `FarmAccessChecker` to the constructor and one new test:

```java
  @Test
  void buildDashboard_omitsCommercialWhenMemberLacksReadPermission() {
    // subscription enables commercial, but the member has neither commercial:read nor finance:read
    when(subscriptionFacade.isModuleEnabled(1L, "module.commercial.basic")).thenReturn(true);
    when(farmAccess.hasAnyPermission(1L, "commercial:read", "finance:read")).thenReturn(false);
    when(farmAccess.hasPermission(1L, "poultry:read")).thenReturn(false);

    DashboardResponse res =
        reportingService.buildDashboard(1L, DashboardPeriod.resolve("30d", null, null, LocalDate.now()));

    assertThat(res.commercial()).isNull();
  }
```
(Adjust `farmAccess` field name / constructor arg order to match how you wire it in Step 3. Keep the pre-existing tests compiling by stubbing `farmAccess.hasAnyPermission(...)`/`hasPermission(...)` to `true` in their arrange sections where a section is expected to be present.)

- [ ] **Step 2: Compile the test to verify it fails**

Run: `cd backend && ./mvnw -q -pl avicare-app -am test-compile`
Expected: FAIL — `ReportingService` constructor does not yet take a `FarmAccessChecker`, and/or the field `farmAccess` does not exist. (The `*IT` suite is CI-only; this unit test compiles/runs locally.)

- [ ] **Step 3: Implement** — edit `ReportingService.java`

Add the dependency and gate each section with an additional permission check:

```java
import com.avicare.common.security.access.FarmAccessChecker;
// ...
  private final SubscriptionFacade subscriptionFacade;
  private final CommercialFacade commercialFacade;
  private final LivestockFacade livestockFacade;
  private final FarmAccessChecker farmAccess;

  public DashboardResponse buildDashboard(Long farmId, DashboardPeriod period) {
    CommercialSection commercial = null;
    if (subscriptionFacade.isModuleEnabled(farmId, "module.commercial.basic")
        && farmAccess.hasAnyPermission(farmId, "commercial:read", "finance:read")) {
      CommercialStats stats = commercialFacade.commercialStats(farmId, period.from(), period.to());
      commercial =
          new CommercialSection(
              stats.revenueXof(), stats.revenueSeries(), stats.outstandingXof(),
              stats.overdueXof(), stats.topClients(), stats.topDebtors(),
              stats.ordersToDeliver(), stats.invoicesToCollect());
    }
    boolean livestockActive =
        subscriptionFacade.isModuleEnabled(farmId, "module.poultry.broiler")
            || subscriptionFacade.isModuleEnabled(farmId, "module.poultry.layer");
    LivestockSection livestock = null;
    if (livestockActive && farmAccess.hasPermission(farmId, "poultry:read")) {
      LivestockStats ls = livestockFacade.livestockStats(farmId, period.from(), period.to());
      livestock =
          new LivestockSection(
              ls.activeBatches(), ls.totalHeadcount(), ls.deaths(), ls.mortalityRate(),
              ls.mortalitySeries(), ls.avgDailyGainG(), ls.layingRate(), ls.layingSeries(),
              ls.vaccinationsCount(), ls.treatmentsCount());
    }
    InventorySection inventory =
        subscriptionFacade.isModuleEnabled(farmId, "module.inventory")
                && farmAccess.hasPermission(farmId, "inventory:read")
            ? new InventorySection()
            : null;
    return new DashboardResponse(
        new PeriodInfo(period.kind(), period.value(), period.from().toString(), period.to().toString()),
        commercial, livestock, inventory);
  }
```

- [ ] **Step 4: Verify** — test-compile + run the unit test + spotless

```bash
cd backend
./mvnw -q -pl avicare-app -am test-compile          # exit 0
./mvnw -pl avicare-app test -Dtest=ReportingServiceTest   # BUILD SUCCESS, all pass
./mvnw -q spotless:apply -pl avicare-app
```
Expected: test-compile exit 0; `ReportingServiceTest` all green. (`FarmAccessChecker` is a real bean already in the app context — any DB-less `@SpringBootTest` that boots keeps working without a `@MockitoBean`.)

- [ ] **Step 5: Commit**

```bash
git add backend/avicare-app/src/main/java/com/avicare/reporting/service/ReportingService.java \
        backend/avicare-app/src/test/java/com/avicare/reporting/service/ReportingServiceTest.java
git commit -m "feat(reporting): gate dashboard sections by member read permissions"
```

---

### Task B1: gate livestock module reads by permission

**Files:**
- Modify (in `backend/avicare-app/src/main/java/com/avicare/livestock/controller/`): `InventoryAccess.java`, `CommercialAccess.java`, `HealthAccess.java`, `LayerAccess.java`, `PoultryBatchController.java`.
- Test: create `backend/avicare-app/src/test/java/com/avicare/tenancy/ModulePermissionIT.java`; audit/fix existing livestock ITs.

**Interfaces:**
- Consumes: `FarmAccessChecker.hasPermission` (SpEL `@farmAccess.hasPermission(#farmId, 'resource:read')`).
- Member-provisioning helpers exist in the commercial ITs (`onboardOwner`, `addMember(ownerToken, farmId, fullName, email, role)` returning the temp password, `loginWith(email, password)`) — copy the same pattern for the new IT.

- [ ] **Step 1: Write the failing IT** — `ModulePermissionIT.java`

Mirror the bootstrap of an existing `*ApiIT` in `com.avicare.livestock.commercial` (`@SpringBootTest`, `@AutoConfigureMockMvc`, `@Testcontainers` Postgres via `@DynamicPropertySource`, `MockMvc` + `ObjectMapper`, and the `onboardOwner`/`addMember`/`loginWith`/`createFarm`/`enableModule` helpers — copy them verbatim). Then:

```java
// Owner onboards, creates a farm, enables the inventory module.
// Owner provisions a FARMER member (default perms: poultry+health, NO inventory:read).
// FARMER GET /api/v1/farms/{farmId}/stocks  -> 403 (isForbidden)
// OWNER  GET /api/v1/farms/{farmId}/stocks  -> 200 (isOk)
// Same shape for a commercial read (enable module.commercial.basic; FARMER GET /commercial/clients -> 403; OWNER -> 200).
```

Write the concrete cases with `status().isForbidden()` / `status().isOk()` assertions. Use the FARMER token from `loginWith(email, tempPassword)` (a real provisioned member, so `hasAccess` passes but `hasPermission('inventory:read')` fails → 403, proving the new gate rather than a membership error).

- [ ] **Step 2: Compile the IT**

Run: `cd backend && ./mvnw -q -pl avicare-app -am test-compile`
Expected: exit 0 (the IT compiles; it runs in CI only).

- [ ] **Step 3: Flip the READ constants**

- `InventoryAccess.java` — `READ`:
  `static final String READ = "@farmAccess.hasPermission(#farmId, 'inventory:read') and " + FEATURE;`
- `CommercialAccess.java` — `READ`:
  `static final String READ = "@farmAccess.hasPermission(#farmId, 'commercial:read') and " + FEATURE;`
- `HealthAccess.java` — `READ_BASIC` and `READ_ADVANCED`:
  `static final String READ_BASIC = "@farmAccess.hasPermission(#farmId, 'health:read') and " + BASIC;`
  `static final String READ_ADVANCED = "@farmAccess.hasPermission(#farmId, 'health:read') and " + ADVANCED;`
- `LayerAccess.java` — `READ`:
  `static final String READ = "@farmAccess.hasPermission(#farmId, 'poultry:read') and " + FEATURE;`
- `PoultryBatchController.java` — `READ`:
  `static final String READ = "@farmAccess.hasPermission(#farmId, 'poultry:read') and " + FEATURE;`

Leave every `WRITE_*` constant untouched.

- [ ] **Step 4: Audit & fix existing ITs broken by the change**

The change turns a non-owner **GET** on inventory/commercial into a 403 when that member lacks the read permission. FARMER keeps `poultry:read`/`health:read`, so poultry/health reads are unaffected; the risk is inventory/commercial reads by a FARMER (or VET/BUYER).

Run the audit:
```bash
cd backend/avicare-app/src/test/java/com/avicare
grep -rn "farmer\|vet\b\|buyer" livestock/ | grep -iE "get\(|getOk"
```
For each hit where a non-OWNER token performs a GET on `/stocks`, `/commercial/...`, `/inventory` (or reads that resolve to those controllers): fix by EITHER
- provisioning that test member WITH the needed read permission (pass `permissions` including e.g. `"inventory:read"` in the `CreateMemberRequest` body of the `addMember` helper), OR
- using the OWNER token for the read assertions (the OWNER has `*`).
Prefer the OWNER-token fix for pure read assertions; use custom permissions only when the test's intent is specifically a non-owner reading.

- [ ] **Step 5: Verify compile + spotless**

```bash
cd backend
./mvnw -q -pl avicare-app -am test-compile   # exit 0
./mvnw -q spotless:apply -pl avicare-app
```
Expected: exit 0. (The IT assertions themselves run in CI — green CI confirms both the new 403/200 behavior and that no existing IT regressed.)

- [ ] **Step 6: Commit**

```bash
git add backend/avicare-app/src/main/java/com/avicare/livestock/controller/InventoryAccess.java \
        backend/avicare-app/src/main/java/com/avicare/livestock/controller/CommercialAccess.java \
        backend/avicare-app/src/main/java/com/avicare/livestock/controller/HealthAccess.java \
        backend/avicare-app/src/main/java/com/avicare/livestock/controller/LayerAccess.java \
        backend/avicare-app/src/main/java/com/avicare/livestock/controller/PoultryBatchController.java \
        backend/avicare-app/src/test/java/com/avicare/tenancy/ModulePermissionIT.java
# plus any existing IT files you had to adjust in Step 4
git commit -m "feat(livestock): gate module reads by resource:read permission"
```

---

### Task B2: gate parameters (farm settings) reads by `settings:read`

**Files:**
- Modify (in `backend/avicare-app/src/main/java/com/avicare/parameters/controller/`): `FarmSettingsController.java`, `FarmCatalogController.java`, `PriceListController.java`, `AlertThresholdController.java`.
- Test: audit/fix any parameters IT.

**Interfaces:**
- Consumes: `@farmAccess.hasPermission(#farmId, 'settings:read')`.

- [ ] **Step 1: Flip the read (`@GetMapping`) authorizations**

In each controller, change the `@GetMapping` methods' `@PreAuthorize` from `"@farmAccess.hasAccess(#farmId)"` to `"@farmAccess.hasPermission(#farmId, 'settings:read')"`:
- `FarmSettingsController` — the `GET /settings` method.
- `FarmCatalogController` — the `GET /catalog/{category}` method.
- `PriceListController` — the `GET /price-lists` method AND the `GET /{priceListId}/items` method.
- `AlertThresholdController` — the `GET /thresholds` method.

Leave every write (`@PostMapping`/`@PutMapping`/`@DeleteMapping`) `@PreAuthorize` untouched. Do NOT touch `UserSettingsController` (`/api/v1/account/settings`) — those are account-level, not farm-gated.

- [ ] **Step 2: Audit & fix parameters ITs**

```bash
cd backend/avicare-app/src/test/java/com/avicare
grep -rln "settings\|price-lists\|thresholds\|catalog" . | xargs grep -ln "farmer\|vet\b\|buyer" 2>/dev/null
```
Any test where a non-OWNER member GETs farm settings/price-lists/thresholds/catalog and lacks `settings:read` will now get 403 — fix by using the OWNER token for those reads (OWNER has `*`; MANAGER also has `settings:read`), or provision the member with `settings:read`.

- [ ] **Step 3: Verify compile + spotless**

```bash
cd backend
./mvnw -q -pl avicare-app -am test-compile   # exit 0
./mvnw -q spotless:apply -pl avicare-app
```
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add backend/avicare-app/src/main/java/com/avicare/parameters/controller/FarmSettingsController.java \
        backend/avicare-app/src/main/java/com/avicare/parameters/controller/FarmCatalogController.java \
        backend/avicare-app/src/main/java/com/avicare/parameters/controller/PriceListController.java \
        backend/avicare-app/src/main/java/com/avicare/parameters/controller/AlertThresholdController.java
# plus any adjusted IT files
git commit -m "feat(parameters): gate farm settings reads by settings:read permission"
```

---

## Self-Review (couverture spec)

- §2 Enforcement lectures → hasPermission : Tasks B1 (livestock) + B2 (parameters). ✓
- §2 Écritures inchangées : aucune tâche ne touche `WRITE_*`. ✓
- §2 Source front = JWT décodé : Task F1 (`decodeJwtPayload`) + F2 (`useFarmPermissions`). ✓
- §3 Mapping : poultry:read (F3 Poulets/Œufs, B1 PoultryBatch/Layer), health:read (F3 Sanitaire, B1 Health), inventory:read (F3 Stocks, B1 Inventory), commercial:read (F3 Commercial, B1 Commercial), settings:read (F3 Réglages, B2), dashboard commercial=commercial:read|finance:read + livestock=poultry:read (B3). ✓
- §4 Dashboard service gating : Task B3. ✓
- §5 Front menu gating : Task F3. Front dashboard gating : intentionally omitted (backend omission + existing null-guard; documented above). ✓
- §7 Tests : F1/F2/F3 (Vitest), B3 (unit), B1 (`ModulePermissionIT`), B1/B2 IT audits. ✓
- Aucune migration ; aucune nouvelle dépendance (JWT décodé à la main). ✓

**Type consistency:** `decodeJwtPayload`/`memberHasPermission` (F1) consumed unchanged by F2; `useFarmPermissions(farmId): {can}` (F2) consumed by F3; `FarmAccessChecker.hasPermission/hasAnyPermission` (existing) consumed by B3. NAV `requiredPermission?: string` added and read in `childVisible`/`renderGroup`/leaf branch consistently.

**Ordering:** F1 → F2 → F3 (frontend, fully local, F3 = whole-frontend green gate) → B3 → B1 → B2 (backend; B3 has a local unit test, B1/B2 rely on CI for ITs).
