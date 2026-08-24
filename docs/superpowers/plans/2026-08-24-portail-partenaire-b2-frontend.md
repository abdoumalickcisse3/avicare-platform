# Portail partenaire B2 (front) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un portail partenaire dans `web/` (section `(partner)`) : login partenaire cloisonné + dashboard réseau **read-only** consommant les endpoints B1 `/api/v1/partner/**`.

**Architecture:** Session partenaire totalement séparée de l'éleveur — un `partnerTokenStorage` (clés localStorage distinctes) et un `partnerApi` RTK Query dédié (propre `createApi` + reauth contre `/api/v1/partner/auth/refresh`), enregistré à côté de `baseApi`. Route-group `(partner)/portal` avec layout dédié (garde de route client-side) : `login` + `page` (dashboard). Caddy route `partner.jawdi.app` → même conteneur `web`.

**Tech Stack:** Next.js 16 (App Router) + MUI v9 + RTK Query, react-hook-form + zod, vitest + Testing Library. Caddy (infra).

**Spec:** `docs/superpowers/specs/2026-08-24-portail-partenaire-b2-design.md`

## Global Constraints

- **Cloisonnement front** : le token partenaire vit dans `partnerTokenStorage` (clés `jawdi_partner_*`), JAMAIS dans `tokenStorage` (éleveur). Le `partnerApi` ne réutilise PAS `baseApi`. Le backend reste l'autorité (un token éleveur → 403 sur `/api/v1/partner/**`).
- **Conventions `web/`** : composants clients `"use client"` ; MUI v9 (passer `justifyContent`/`alignItems` via `sx`, pas en props directes de `Stack` ; `TextField`/`Switch` : `slotProps={{ htmlInput: ... }}` pas `inputProps`) ; couleurs via `@/theme/tokens` ; erreurs via `apiErrorMessage` (`@/lib/apiError`). **Lire `node_modules/next/dist/docs/` si besoin** (cf. `web/AGENTS.md` — Next a changé).
- **RTK Query** : `injectEndpoints` interdit ici (nouvel `createApi`) ; réponses backend wrappées `{ data }` → `transformResponse: (r) => r.data`.
- **Tests** : vitest (`makeStore`/`renderWithProviders`, `vi.stubGlobal("fetch", ...)`) ; gates = `npm run lint && npm test && npm run build`.
- **Commits** : Conventional Commits, scope `feat(web:partner):`. **AUCUNE** mention Claude/IA.
- **Aucune modif de l'app éleveur** (sauf l'ajout du reducer `partnerApi` au store, inoffensif).

---

### Task 1: `partnerTokenStorage`

**Files:**
- Create: `web/src/lib/partnerStorage.ts`
- Create: `web/src/lib/partnerStorage.test.ts`

**Interfaces:**
- Produces: `partnerTokenStorage` with `getAccess(): string | null`, `getRefresh(): string | null`, `set(access, refresh): void`, `clear(): void` (mirror of `tokenStorage` in `web/src/lib/storage.ts`, distinct keys).

- [ ] **Step 1: Write `partnerStorage.ts`**

```ts
/** Partner-portal token store (localStorage, SSR-safe). Distinct keys from the farmer tokenStorage
 * so the two sessions never collide. */
const PARTNER_ACCESS_KEY = "jawdi_partner_access_token";
const PARTNER_REFRESH_KEY = "jawdi_partner_refresh_token";

function read(key: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(key);
}
function write(key: string, value: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, value);
}
function remove(key: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key);
}

export const partnerTokenStorage = {
  getAccess: () => read(PARTNER_ACCESS_KEY),
  getRefresh: () => read(PARTNER_REFRESH_KEY),
  set: (accessToken: string, refreshToken: string) => {
    write(PARTNER_ACCESS_KEY, accessToken);
    write(PARTNER_REFRESH_KEY, refreshToken);
  },
  clear: () => {
    remove(PARTNER_ACCESS_KEY);
    remove(PARTNER_REFRESH_KEY);
  },
};
```

- [ ] **Step 2: Write the test**

`partnerStorage.test.ts`:
```ts
import { afterEach, describe, expect, it } from "vitest";
import { partnerTokenStorage } from "./partnerStorage";
import { tokenStorage } from "./storage";

describe("partnerTokenStorage", () => {
  afterEach(() => {
    partnerTokenStorage.clear();
    tokenStorage.clear();
  });

  it("round-trips tokens under partner-specific keys", () => {
    partnerTokenStorage.set("acc", "ref");
    expect(partnerTokenStorage.getAccess()).toBe("acc");
    expect(partnerTokenStorage.getRefresh()).toBe("ref");
  });

  it("is isolated from the farmer tokenStorage", () => {
    tokenStorage.set("farmer-acc", "farmer-ref");
    partnerTokenStorage.set("partner-acc", "partner-ref");
    expect(partnerTokenStorage.getAccess()).toBe("partner-acc");
    expect(tokenStorage.getAccess()).toBe("farmer-acc");
    partnerTokenStorage.clear();
    expect(tokenStorage.getAccess()).toBe("farmer-acc"); // clearing one leaves the other
  });
});
```

- [ ] **Step 3: Run + commit**

Run: `cd web && npm test -- partnerStorage`
Expected: PASS.
```bash
git add web/src/lib/partnerStorage.ts web/src/lib/partnerStorage.test.ts
git commit -m "feat(web:partner): partner token storage (isolated from farmer session)"
```

---

### Task 2: `partnerApi` slice + store registration + types

**Files:**
- Create: `web/src/store/api/partnerApi.ts`
- Create: `web/src/store/api/partnerApi.test.ts`
- Modify: `web/src/store/store.ts` (register the reducer + middleware)
- Modify: `web/src/types/index.ts` (add `PartnerAuthTokens`, `PartnerProfile`, `NetworkDashboard` — `FarmPartner`/network types)

**Interfaces:**
- Consumes: `partnerTokenStorage` (Task 1).
- Produces hooks: `usePartnerLoginMutation`, `usePartnerLogoutMutation`, `useGetPartnerProfileQuery`, `useGetNetworkDashboardQuery`, `useGetNetworkFarmsQuery`.
- Types: `PartnerAuthTokens`, `PartnerProfile`, `NetworkDashboard`, `NetworkFarmRow`.

- [ ] **Step 1: Add types to `web/src/types/index.ts`**

```ts
// --- Partner portal (B2) ---
export interface PartnerAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}
export interface PartnerProfile {
  partnerId: number;
  name: string;
  type: "FEED_SUPPLIER" | "VET";
  logoUrl: string | null;
  farmCount: number;
}
export interface NetworkDashboard {
  farmCount: number;
  activeFarmCount: number;
  totalFeedKg: number | null;
  avgMortalityRate: number | null;
}
export interface NetworkFarmRow {
  farmId: number;
  farmName: string;
  active: boolean | null;
  feedKg: number | null;
  mortalityRate: number | null;
}
```

- [ ] **Step 2: Write `partnerApi.ts`** (own `createApi` + reauth, mirror of `baseApi.ts` but partner-scoped)

```ts
import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import { partnerTokenStorage } from "@/lib/partnerStorage";
import type {
  NetworkDashboard,
  NetworkFarmRow,
  PartnerAuthTokens,
  PartnerProfile,
} from "@/types";

interface Envelope<T> {
  data: T;
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl:
    process.env.NEXT_PUBLIC_API_URL ||
    (process.env.NODE_ENV === "production" ? "" : "http://localhost:8080"),
  prepareHeaders: (headers) => {
    const token = partnerTokenStorage.getAccess();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return headers;
  },
});

/** On 401, try one refresh against POST /api/v1/partner/auth/refresh and retry; on failure purge
 * the partner token and redirect to the partner login. */
const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  let result = await rawBaseQuery(args, api, extraOptions);

  if (result.error?.status === 401) {
    const refreshToken = partnerTokenStorage.getRefresh();
    if (refreshToken) {
      const refresh = await rawBaseQuery(
        { url: "/api/v1/partner/auth/refresh", method: "POST", body: { refreshToken } },
        api,
        extraOptions,
      );
      const data = (refresh.data as { data?: PartnerAuthTokens })?.data;
      if (data?.accessToken) {
        partnerTokenStorage.set(data.accessToken, data.refreshToken);
        return rawBaseQuery(args, api, extraOptions);
      }
    }
    partnerTokenStorage.clear();
    if (typeof window !== "undefined") window.location.href = "/portal/login";
  }
  return result;
};

export const partnerApi = createApi({
  reducerPath: "partnerApi",
  baseQuery: baseQueryWithReauth,
  tagTypes: ["PartnerProfile", "Network"],
  endpoints: (build) => ({
    partnerLogin: build.mutation<PartnerAuthTokens, { email: string; password: string }>({
      query: (body) => ({ url: "/api/v1/partner/auth/login", method: "POST", body }),
      transformResponse: (r: Envelope<PartnerAuthTokens>) => r.data,
    }),
    partnerLogout: build.mutation<void, { refreshToken: string }>({
      query: (body) => ({ url: "/api/v1/partner/auth/logout", method: "POST", body }),
    }),
    getPartnerProfile: build.query<PartnerProfile, void>({
      query: () => "/api/v1/partner/me",
      transformResponse: (r: Envelope<PartnerProfile>) => r.data,
      providesTags: ["PartnerProfile"],
    }),
    getNetworkDashboard: build.query<NetworkDashboard, void>({
      query: () => "/api/v1/partner/network",
      transformResponse: (r: Envelope<NetworkDashboard>) => r.data,
      providesTags: ["Network"],
    }),
    getNetworkFarms: build.query<NetworkFarmRow[], void>({
      query: () => "/api/v1/partner/network/farms",
      transformResponse: (r: Envelope<NetworkFarmRow[]>) => r.data,
      providesTags: ["Network"],
    }),
  }),
});

export const {
  usePartnerLoginMutation,
  usePartnerLogoutMutation,
  useGetPartnerProfileQuery,
  useGetNetworkDashboardQuery,
  useGetNetworkFarmsQuery,
} = partnerApi;
```

- [ ] **Step 3: Register in `store.ts`**

Modify `web/src/store/store.ts` to add the reducer + middleware next to `baseApi`:
```ts
import { partnerApi } from "./api/partnerApi";
// ...
    reducer: {
      [baseApi.reducerPath]: baseApi.reducer,
      [partnerApi.reducerPath]: partnerApi.reducer,
    },
    middleware: (getDefault) => getDefault().concat(baseApi.middleware, partnerApi.middleware),
```

- [ ] **Step 4: Write the slice test**

`partnerApi.test.ts` (mirror `partnersApi.test.ts` structure — `makeStore`, `vi.stubGlobal("fetch", ...)`):
```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeStore } from "@/store/store";
import { partnerApi } from "./partnerApi";
import { partnerTokenStorage } from "@/lib/partnerStorage";

function called(arg: unknown): { url: string; method: string } {
  if (arg instanceof Request) return { url: arg.url, method: arg.method };
  if (typeof arg === "string") return { url: arg, method: "GET" };
  return { url: String(arg), method: "GET" };
}
function mockFetchOnce(body: unknown) {
  const m = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
  vi.stubGlobal("fetch", m);
  return m;
}

describe("partnerApi", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    partnerTokenStorage.clear();
  });

  it("dashboard hits /api/v1/partner/network with the partner token", async () => {
    partnerTokenStorage.set("ptoken", "pref");
    const m = mockFetchOnce({ data: { farmCount: 0, activeFarmCount: 0, totalFeedKg: null, avgMortalityRate: null } });
    const store = makeStore();
    await store.dispatch(partnerApi.endpoints.getNetworkDashboard.initiate());
    expect(called(m.mock.calls[0]?.[0]).url).toContain("/api/v1/partner/network");
  });

  it("login posts to /partner/auth/login and unwraps tokens", async () => {
    const m = mockFetchOnce({ data: { accessToken: "a", refreshToken: "r", expiresIn: 900 } });
    const store = makeStore();
    const res = await store.dispatch(
      partnerApi.endpoints.partnerLogin.initiate({ email: "p@x.io", password: "secret" }),
    );
    expect(called(m.mock.calls[0]?.[0]).url).toContain("/api/v1/partner/auth/login");
    expect((res as { data?: { accessToken: string } }).data?.accessToken).toBe("a");
  });
});
```

- [ ] **Step 5: Run + commit**

Run: `cd web && npm test -- partnerApi`
Expected: PASS.
```bash
git add web/src/store/api/partnerApi.ts web/src/store/api/partnerApi.test.ts web/src/store/store.ts web/src/types/index.ts
git commit -m "feat(web:partner): partnerApi slice (isolated createApi + reauth) + store"
```

---

### Task 3: Partner layout (route guard) + login page

**Files:**
- Create: `web/src/app/(partner)/portal/layout.tsx`
- Create: `web/src/app/(partner)/portal/login/page.tsx`
- Create: `web/src/app/(partner)/portal/login/page.test.tsx`

**Interfaces:**
- Consumes: `partnerTokenStorage` (Task 1), `usePartnerLoginMutation` (Task 2), `apiErrorMessage` (`@/lib/apiError`).

- [ ] **Step 1: Write the partner layout (client route guard)**

`(partner)/portal/layout.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Box } from "@mui/material";
import { partnerTokenStorage } from "@/lib/partnerStorage";
import { colors } from "@/theme/tokens";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const isLogin = pathname === "/portal/login";
    const hasToken = partnerTokenStorage.getAccess() !== null;
    if (!isLogin && !hasToken) {
      router.replace("/portal/login");
      return;
    }
    setChecked(true);
  }, [pathname, router]);

  if (!checked && pathname !== "/portal/login") return null; // avoid flashing protected content

  return <Box sx={{ minHeight: "100dvh", bgcolor: colors.neutral[50] }}>{children}</Box>;
}
```
> Keep the guard client-side (tokens live in localStorage, like the farmer app).

- [ ] **Step 2: Write the login test (failing)**

`login/page.test.tsx` — mirror an existing auth/page test: render inside `renderWithProviders`, mock `fetch` for `/partner/auth/login`, fill email+password, submit, assert `partnerTokenStorage.getAccess()` is set (happy path) and that a 401 renders an error. Minimal:
```tsx
it("stores partner tokens on successful login", async () => {
  // stub fetch → { data: { accessToken, refreshToken, expiresIn } }
  // renderWithProviders(<PartnerLoginPage />), type email+password, click submit
  // await waitFor(() => expect(partnerTokenStorage.getAccess()).toBe("a"))
});
```

- [ ] **Step 3: Write the login page**

`(partner)/portal/login/page.tsx` — mirror `web/src/app/(auth)/login/page.tsx` (react-hook-form + zod + MUI), but:
- `const [login, { isLoading }] = usePartnerLoginMutation();`
- On submit: `const tokens = await login(values).unwrap(); partnerTokenStorage.set(tokens.accessToken, tokens.refreshToken); router.replace("/portal");`
- On error: `setServerError(apiErrorMessage(err))` (message « Identifiants invalides ou compte inactif » for 401 — map via apiError or a fallback).
- Heading: « Portail partenaire » / « Connectez-vous pour suivre votre réseau. »
- No signup/forgot links (partner accounts are ADMIN-provisioned).

- [ ] **Step 4: Run gates + commit**

Run: `cd web && npm test -- "portal/login" && npm run lint`
Expected: PASS / clean.
```bash
git add "web/src/app/(partner)"
git commit -m "feat(web:partner): partner portal login + route guard layout"
```

---

### Task 4: Dashboard page (KPIs + farms table)

**Files:**
- Create: `web/src/app/(partner)/portal/page.tsx`
- Create: `web/src/components/partner/NetworkDashboard.tsx`
- Create: `web/src/components/partner/NetworkDashboard.test.tsx`

**Interfaces:**
- Consumes: `useGetPartnerProfileQuery`, `useGetNetworkDashboardQuery`, `useGetNetworkFarmsQuery`, `usePartnerLogoutMutation` (Task 2), `partnerTokenStorage`.

- [ ] **Step 1: Write the component test (failing)**

`NetworkDashboard.test.tsx` — render `<NetworkDashboard />` in `renderWithProviders`, mock `fetch` to answer the three GETs (`/me`, `/network`, `/network/farms`). Assert: the partner name renders; a KPI shows the farm count; a farm row shows "—" for a null metric; empty farms → empty-state text.
```tsx
it("renders KPIs and masks unshared metrics with a dash", async () => {
  // fetch mock routes by url: /me → {data:{name:"Provende du Sahel",type:"FEED_SUPPLIER",farmCount:1,...}}
  //   /network → {data:{farmCount:1,activeFarmCount:1,totalFeedKg:500,avgMortalityRate:null}}
  //   /network/farms → {data:[{farmId:1,farmName:"Ferme A",active:true,feedKg:500,mortalityRate:null}]}
  // renderWithProviders(<NetworkDashboard />)
  // expect(await screen.findByText("Provende du Sahel")).toBeInTheDocument();
  // expect(screen.getByText("Ferme A")).toBeInTheDocument();
  // mortalityRate null → a "—" cell is present
});
```

- [ ] **Step 2: Write `NetworkDashboard.tsx`**

Client component:
- `const { data: me } = useGetPartnerProfileQuery();`
- `const { data: dash } = useGetNetworkDashboardQuery();`
- `const { data: farms = [] } = useGetNetworkFarmsQuery();`
- Header: `me?.name` + a type chip (Provendier/Vétérinaire) + a **Déconnexion** button: `await logout({ refreshToken: partnerTokenStorage.getRefresh() ?? "" }).catch(()=>{}); partnerTokenStorage.clear(); router.replace("/portal/login");`
- KPI cards (MUI `Card` grid): « Fermes » = `dash?.farmCount`, « Actives » = `dash?.activeFarmCount`, « Aliment (kg) » = `fmt(dash?.totalFeedKg)`, « Mortalité moy. » = `fmtPct(dash?.avgMortalityRate)`. Helper `fmt(n?: number | null) => n == null ? "—" : n.toLocaleString("fr-FR")`, `fmtPct(n) => n == null ? "—" : n.toFixed(1) + " %"`.
- Farms table (MUI `Table`, wrapped in `overflow-x:auto`): columns Nom · Statut (`active===true` → Actif chip, `active===false` → Inactif, `null` → « — ») · Aliment (`fmt(feedKg)`) · Mortalité (`fmtPct(mortalityRate)`). Empty → « Aucune ferme dans votre réseau. »
- MUI v9: layout props via `sx`; wrap the table in a scroll container.

- [ ] **Step 3: Write the route page**

`(partner)/portal/page.tsx`:
```tsx
import NetworkDashboard from "@/components/partner/NetworkDashboard";
export default function PortalDashboardPage() {
  return <NetworkDashboard />;
}
```

- [ ] **Step 4: Run gates + commit**

Run: `cd web && npm test -- NetworkDashboard && npm run lint && npm run build`
Expected: PASS / clean / build OK (the `/portal` + `/portal/login` routes appear).
```bash
git add "web/src/app/(partner)/portal/page.tsx" web/src/components/partner
git commit -m "feat(web:partner): partner network dashboard (KPIs + farms table, scope-masked)"
```

---

### Task 5: Caddy route + full validation + PR

**Files:**
- Modify: `infra/Caddyfile`

- [ ] **Step 1: Add the `partner.{$DOMAIN}` block to `infra/Caddyfile`**

Mirror the `app.{$DOMAIN}` block (backend handles + web fallback):
```
partner.{$DOMAIN} {
	handle @backend {
		reverse_proxy backend:8080
	}
	handle {
		reverse_proxy web:3000
	}
}
```
Copy the exact `@backend` matcher used by the `app.` block (the `/api*`,`/actuator*` matcher) so the partner subdomain proxies API calls to the backend and everything else to the Next app.

- [ ] **Step 2: Web gates**

Run: `cd web && npm run lint && npm test && npm run build`
Expected: all green; `/portal` and `/portal/login` in the build output.

- [ ] **Step 3: Push + PR**

```bash
git add infra/Caddyfile
git commit -m "chore(infra): route partner.jawdi.app to the web container (B2 portal)"
git push -u origin feat/partner-portal-b2-frontend
gh pr create --fill --base main
gh pr checks --watch
```
Expected: CI green (Web build + lint-and-test). **PR body : aucune mention Claude/IA.** Merge : `gh pr merge --rebase --delete-branch`.

---

## Notes d'exécution

- **Branche** : `feat/partner-portal-b2-frontend` (déjà créée ; spec committé dessus).
- **Ordre** : 1→5 strict (storage → api → login/guard → dashboard → infra/PR).
- **Cloisonnement** : ne jamais toucher `tokenStorage`/`baseApi` (éleveur). Le seul point de contact est le store (2ᵉ reducer).
- **MUI v9 footguns** (cf. mémoire) : `Stack` sans `justifyContent`/`alignItems` en props (via `sx`) ; `TextField` `slotProps={{ htmlInput }}` (pas `inputProps`).
- **Next a changé** (`web/AGENTS.md`) : répliquer les pages sœurs existantes (`(auth)/login`, `(dashboard)/…`), ne pas inventer d'API Next.
- **Smoke local** (optionnel) : provisionner un partner-user via l'ADMIN (`POST /api/v1/admin/partners/{id}/users`), puis se connecter sur `/portal/login` et vérifier le dashboard.
- **B2 est le dernier cycle du plan « b »** ; ensuite plan « c » (Garder/Développer).
