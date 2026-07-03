# Generic Catalog Manager (settings) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill the placeholder `/reglages/[category]` pages with a reusable catalog manager, wired first to Lots (`breeds`) and Comptabilité (`expense_categories`), driven by a declarative per-category config.

**Architecture:** Frontend-only. A generic `CatalogManager` component lists/adds/edits/disables catalog entries via the existing generic backend endpoints (`GET/POST/DELETE /api/v1/farms/{farmId}/catalog/{category}`). Each category is described by a declarative `CategoryConfig` (backend category + field descriptors for the free-form JSONB `value`). Write actions gate on the farm role (OWNER/MANAGER) read from the JWT.

**Tech Stack:** Next.js 16 / TypeScript / MUI v9 / RTK Query / react-hook-form + zod / Vitest.

## Global Constraints

- **No backend change, no migration, no new dependency.** The backend catalog CRUD already exists (reads gated `settings:read`, writes gated OWNER/MANAGER).
- Commits: Conventional Commits, scope `web`. **NO AI/Claude/Anthropic signature**, no robot emoji, no `Co-Authored-By`.
- French user-facing copy. No hardcoded hex — colors from `@/theme/tokens` only.
- Each frontend task: `npx tsc --noEmit` clean on its files + its Vitest tests green. The LAST task requires whole-project `tsc` 0 / `lint` 0 errors / `vitest` all green / `next build` OK.
- Backend contract (unchanged): `GET .../catalog/{category}` → `{data: CatalogEntry[]}` where `CatalogEntry = {category, key, value: object, custom: boolean}`; `POST .../catalog/{category}` body `{key, value}` → `{data: CatalogEntry}`; `DELETE .../catalog/{category}/{key}` → 204.
- Write gating is by **farm role** (OWNER/MANAGER), NOT `settings:write` (MANAGER lacks it). The JWT membership carries `farmRole`.

---

## File Structure

- `web/src/lib/slug.ts` — `slugify` (pure).
- `web/src/constants/catalogCategories.ts` — `FieldDescriptor`, `CategoryConfig`, `CATALOG_CATEGORIES`, `getCategoryConfig`.
- `web/src/store/api/catalogApi.ts` — generic RTK slice + `CatalogEntry` type.
- `web/src/hooks/useFarmRole.ts` — `useFarmRole` + `canManageCatalog`.
- `web/src/components/settings/CatalogEntryDialog.tsx` — generic add/edit form from a config.
- `web/src/components/settings/CatalogManager.tsx` — the manager (table + actions).
- `web/src/components/settings/CatalogCategoryView.tsx` — thin client wrapper (resolves farmId).
- `web/src/app/(dashboard)/reglages/[category]/page.tsx` — wire manager or keep placeholder.

---

### Task 1: slug helper + category config registry

**Files:**
- Create: `web/src/lib/slug.ts`, `web/src/constants/catalogCategories.ts`
- Test: `web/src/lib/slug.test.ts`, `web/src/constants/catalogCategories.test.ts`

**Interfaces:**
- Produces:
  - `slugify(input: string): string`
  - `interface FieldDescriptor { name: string; label: string; type: "text" | "select"; required?: boolean; options?: { value: string; label: string }[]; const?: string }`
  - `interface CategoryConfig { slug: string; backendCategory: string; title: string; description: string; labelField: string; fields: FieldDescriptor[] }`
  - `CATALOG_CATEGORIES: CategoryConfig[]`
  - `getCategoryConfig(slug: string): CategoryConfig | undefined`

- [ ] **Step 1: Write the failing test** — `web/src/lib/slug.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Cobb 500")).toBe("cobb-500");
  });
  it("strips accents", () => {
    expect(slugify("Aliment Démarrage")).toBe("aliment-demarrage");
  });
  it("collapses non-alphanumerics and trims hyphens", () => {
    expect(slugify("  Poulet / Chair!! ")).toBe("poulet-chair");
  });
  it("returns empty string for empty input", () => {
    expect(slugify("")).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/lib/slug.test.ts`
Expected: FAIL (module `./slug` not found).

- [ ] **Step 3: Implement `slugify`** — `web/src/lib/slug.ts`

```ts
/** URL/key-safe slug: lowercase, accent-stripped, non-alphanumerics collapsed to single hyphens. */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
```

- [ ] **Step 4: Write the config test** — `web/src/constants/catalogCategories.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { getCategoryConfig, CATALOG_CATEGORIES } from "./catalogCategories";

describe("catalogCategories", () => {
  it("maps lots to the breeds backend category", () => {
    const cfg = getCategoryConfig("lots");
    expect(cfg?.backendCategory).toBe("breeds");
    expect(cfg?.fields.some((f) => f.name === "type" && f.type === "select")).toBe(true);
    expect(cfg?.fields.some((f) => f.name === "species" && f.const === "poultry")).toBe(true);
  });
  it("maps comptabilite to expense_categories", () => {
    expect(getCategoryConfig("comptabilite")?.backendCategory).toBe("expense_categories");
  });
  it("returns undefined for an unconfigured slug", () => {
    expect(getCategoryConfig("ventes")).toBeUndefined();
  });
  it("every config has a labelField present in its fields", () => {
    for (const c of CATALOG_CATEGORIES) {
      expect(c.fields.some((f) => f.name === c.labelField)).toBe(true);
    }
  });
});
```

- [ ] **Step 5: Run it to verify it fails**

Run: `cd web && npx vitest run src/constants/catalogCategories.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 6: Implement the registry** — `web/src/constants/catalogCategories.ts`

```ts
export interface FieldDescriptor {
  name: string;
  label: string;
  type: "text" | "select";
  required?: boolean;
  options?: { value: string; label: string }[];
  /** Fixed value injected into the entry value, not shown in the form. */
  const?: string;
}

export interface CategoryConfig {
  slug: string;
  backendCategory: string;
  title: string;
  description: string;
  labelField: string;
  fields: FieldDescriptor[];
}

export const CATALOG_CATEGORIES: CategoryConfig[] = [
  {
    slug: "lots",
    backendCategory: "breeds",
    title: "Lots",
    description: "Souches et races de volaille (chair, ponte).",
    labelField: "label",
    fields: [
      { name: "label", label: "Nom", type: "text", required: true },
      {
        name: "type",
        label: "Type",
        type: "select",
        required: true,
        options: [
          { value: "broiler", label: "Chair" },
          { value: "layer", label: "Ponte" },
        ],
      },
      { name: "species", label: "Espèce", type: "text", const: "poultry" },
    ],
  },
  {
    slug: "comptabilite",
    backendCategory: "expense_categories",
    title: "Comptabilité",
    description: "Catégories de dépenses.",
    labelField: "label",
    fields: [{ name: "label", label: "Libellé", type: "text", required: true }],
  },
];

export function getCategoryConfig(slug: string): CategoryConfig | undefined {
  return CATALOG_CATEGORIES.find((c) => c.slug === slug);
}
```

- [ ] **Step 7: Run both tests to verify they pass**

Run: `cd web && npx vitest run src/lib/slug.test.ts src/constants/catalogCategories.test.ts`
Expected: PASS. Then `cd web && npx tsc --noEmit 2>&1 | grep -E "slug|catalogCategories"` → no errors on these files.

- [ ] **Step 8: Commit**

```bash
git add web/src/lib/slug.ts web/src/lib/slug.test.ts web/src/constants/catalogCategories.ts web/src/constants/catalogCategories.test.ts
git commit -m "feat(web): slugify helper + catalog category config registry"
```

---

### Task 2: generic catalog RTK Query slice

**Files:**
- Create: `web/src/store/api/catalogApi.ts`
- Test: `web/src/store/api/catalogApi.test.ts`

**Interfaces:**
- Consumes: `baseApi` (`@/store/api/baseApi`), tag `"Catalog"` (already in `tagTypes`).
- Produces:
  - `interface CatalogEntry { category: string; key: string; value: Record<string, unknown>; custom: boolean }`
  - hooks `useGetCatalogQuery`, `useOverrideCatalogEntryMutation`, `useDeleteCatalogEntryMutation`.

- [ ] **Step 1: Write the failing test** — `web/src/store/api/catalogApi.test.ts`

```ts
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { makeStore } from "@/store/store";
import { catalogApi } from "./catalogApi";

function respond(data: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify({ data }), { status: 200, headers: { "Content-Type": "application/json" } }),
  );
}
let lastUrl = "";
beforeEach(() => {
  lastUrl = "";
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    lastUrl = input instanceof Request ? input.url : String(input);
    return respond([{ category: "breeds", key: "cobb_500", value: { label: "Cobb 500" }, custom: false }]);
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe("catalogApi.getCatalog", () => {
  it("unwraps the data envelope and hits the category URL", async () => {
    const store = makeStore();
    const res = await store.dispatch(
      catalogApi.endpoints.getCatalog.initiate({ farmId: 1, category: "breeds" }),
    );
    expect(res.data).toEqual([
      { category: "breeds", key: "cobb_500", value: { label: "Cobb 500" }, custom: false },
    ]);
    expect(lastUrl).toContain("/api/v1/farms/1/catalog/breeds");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/store/api/catalogApi.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the slice** — `web/src/store/api/catalogApi.ts`

```ts
import { baseApi } from "./baseApi";

export interface CatalogEntry {
  category: string;
  key: string;
  value: Record<string, unknown>;
  custom: boolean;
}

interface ApiEnvelope<T> {
  data: T;
}

export const catalogApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getCatalog: build.query<CatalogEntry[], { farmId: number; category: string }>({
      query: ({ farmId, category }) => `/api/v1/farms/${farmId}/catalog/${category}`,
      transformResponse: (r: ApiEnvelope<CatalogEntry[]>) => r.data,
      providesTags: (_r, _e, { farmId, category }) => [{ type: "Catalog", id: `${farmId}-${category}` }],
    }),
    overrideCatalogEntry: build.mutation<
      CatalogEntry,
      { farmId: number; category: string; key: string; value: Record<string, unknown> }
    >({
      query: ({ farmId, category, key, value }) => ({
        url: `/api/v1/farms/${farmId}/catalog/${category}`,
        method: "POST",
        body: { key, value },
      }),
      transformResponse: (r: ApiEnvelope<CatalogEntry>) => r.data,
      invalidatesTags: (_r, _e, { farmId, category }) => [{ type: "Catalog", id: `${farmId}-${category}` }],
    }),
    deleteCatalogEntry: build.mutation<void, { farmId: number; category: string; key: string }>({
      query: ({ farmId, category, key }) => ({
        url: `/api/v1/farms/${farmId}/catalog/${category}/${key}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { farmId, category }) => [{ type: "Catalog", id: `${farmId}-${category}` }],
    }),
  }),
});

export const {
  useGetCatalogQuery,
  useOverrideCatalogEntryMutation,
  useDeleteCatalogEntryMutation,
} = catalogApi;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run src/store/api/catalogApi.test.ts`
Expected: PASS. Then `cd web && npx tsc --noEmit 2>&1 | grep catalogApi` → no errors on these files.

- [ ] **Step 5: Commit**

```bash
git add web/src/store/api/catalogApi.ts web/src/store/api/catalogApi.test.ts
git commit -m "feat(web): generic catalog RTK Query slice"
```

---

### Task 3: `useFarmRole` hook + `canManageCatalog`

**Files:**
- Create: `web/src/hooks/useFarmRole.ts`
- Test: `web/src/hooks/useFarmRole.test.tsx`

**Interfaces:**
- Consumes: `decodeJwtPayload` (`@/lib/permissions`), `useAppSelector` (`@/store/hooks`, `state.auth.accessToken`), `FarmRole` (`@/types`).
- Produces: `useFarmRole(farmId: number | undefined): FarmRole | null`; `canManageCatalog(role: FarmRole | null): boolean`.

- [ ] **Step 1: Write the failing test** — `web/src/hooks/useFarmRole.test.tsx`

```tsx
import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { Provider } from "react-redux";
import { makeStore } from "@/store/store";
import { setTokens } from "@/store/slices/authSlice";
import { useFarmRole, canManageCatalog } from "./useFarmRole";

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

describe("useFarmRole", () => {
  it("returns the farm role from the membership", () => {
    const token = makeJwt({ memberships: [{ farmId: 3, farmRole: "MANAGER", permissions: [] }] });
    const { result } = renderHook(() => useFarmRole(3), { wrapper: wrapperWithToken(token) });
    expect(result.current).toBe("MANAGER");
  });
  it("returns null when there is no membership / no token", () => {
    const { result } = renderHook(() => useFarmRole(3), { wrapper: wrapperWithToken(null) });
    expect(result.current).toBeNull();
  });
});

describe("canManageCatalog", () => {
  it("allows OWNER and MANAGER only", () => {
    expect(canManageCatalog("OWNER")).toBe(true);
    expect(canManageCatalog("MANAGER")).toBe(true);
    expect(canManageCatalog("FARMER")).toBe(false);
    expect(canManageCatalog(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/hooks/useFarmRole.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the hook** — `web/src/hooks/useFarmRole.ts`

```ts
import { useAppSelector } from "@/store/hooks";
import { decodeJwtPayload } from "@/lib/permissions";
import type { FarmRole } from "@/types";

/** The current user's role on `farmId`, read from the access JWT. Null if no membership/token. */
export function useFarmRole(farmId: number | undefined): FarmRole | null {
  const token = useAppSelector((s) => s.auth.accessToken);
  const membership = decodeJwtPayload(token)?.memberships?.find((m) => m.farmId === farmId);
  return (membership?.farmRole as FarmRole) ?? null;
}

/** Whether a role may add/edit/disable catalog entries (mirrors the backend OWNER/MANAGER gate). */
export function canManageCatalog(role: FarmRole | null): boolean {
  return role === "OWNER" || role === "MANAGER";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run src/hooks/useFarmRole.test.tsx`
Expected: PASS. Then `cd web && npx tsc --noEmit 2>&1 | grep useFarmRole` → no errors on these files.

- [ ] **Step 5: Commit**

```bash
git add web/src/hooks/useFarmRole.ts web/src/hooks/useFarmRole.test.tsx
git commit -m "feat(web): useFarmRole hook + canManageCatalog guard"
```

---

### Task 4: `CatalogEntryDialog` (generic form from config)

**Files:**
- Create: `web/src/components/settings/CatalogEntryDialog.tsx`
- Test: `web/src/components/settings/CatalogEntryDialog.test.tsx`

**Interfaces:**
- Consumes: `CategoryConfig`/`FieldDescriptor` (`@/constants/catalogCategories`), `CatalogEntry` (`@/store/api/catalogApi`), `useOverrideCatalogEntryMutation` (`@/store/api/catalogApi`), `slugify` (`@/lib/slug`), `useToast` (`@/components/feedback/ToastProvider`), `apiErrorMessage` (`@/lib/apiError`).
- Produces: `CatalogEntryDialog({ open, onClose, config, farmId, entry }: { open: boolean; onClose: () => void; config: CategoryConfig; farmId: number; entry?: CatalogEntry })`.

- [ ] **Step 1: Write the failing test** — `web/src/components/settings/CatalogEntryDialog.test.tsx`

```tsx
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { CatalogEntryDialog } from "./CatalogEntryDialog";
import { getCategoryConfig } from "@/constants/catalogCategories";

const LOTS = getCategoryConfig("lots")!;

function respond(data: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify({ data }), { status: 200, headers: { "Content-Type": "application/json" } }),
  );
}
let lastBody: Record<string, unknown> | null = null;
beforeEach(() => {
  lastBody = null;
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    if (input instanceof Request) {
      try { lastBody = await input.clone().json(); } catch { /* */ }
    }
    return respond({ category: "breeds", key: "x", value: {}, custom: true });
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe("CatalogEntryDialog", () => {
  it("creates a custom entry: derives the key from the label and injects const fields", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <CatalogEntryDialog open onClose={vi.fn()} config={LOTS} farmId={1} />,
    );
    await user.type(screen.getByLabelText("Nom"), "Cobb 500");
    // MUI select for "Type"
    await user.click(screen.getByLabelText("Type"));
    await user.click(await screen.findByRole("option", { name: "Chair" }));
    await user.click(screen.getByRole("button", { name: /Enregistrer/i }));

    await waitFor(() => expect(lastBody).not.toBeNull());
    expect(lastBody).toMatchObject({
      key: "cobb-500",
      value: { label: "Cobb 500", type: "broiler", species: "poultry" },
    });
  });

  it("edits an existing entry: keeps the key and preserves unknown value fields", async () => {
    const user = userEvent.setup();
    const entry = {
      category: "breeds",
      key: "ross_308",
      value: { label: "Ross 308", type: "broiler", species: "poultry", extra: "keepme" },
      custom: false,
    };
    renderWithProviders(
      <CatalogEntryDialog open onClose={vi.fn()} config={LOTS} farmId={1} entry={entry} />,
    );
    const nom = screen.getByLabelText("Nom");
    await user.clear(nom);
    await user.type(nom, "Ross 308 Plus");
    await user.click(screen.getByRole("button", { name: /Enregistrer/i }));

    await waitFor(() => expect(lastBody).not.toBeNull());
    expect(lastBody).toMatchObject({
      key: "ross_308",
      value: { label: "Ross 308 Plus", type: "broiler", species: "poultry", extra: "keepme" },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/components/settings/CatalogEntryDialog.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the dialog** — `web/src/components/settings/CatalogEntryDialog.tsx`

```tsx
"use client";

import { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { X } from "lucide-react";
import type { CategoryConfig } from "@/constants/catalogCategories";
import type { CatalogEntry } from "@/store/api/catalogApi";
import { useOverrideCatalogEntryMutation } from "@/store/api/catalogApi";
import { slugify } from "@/lib/slug";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";

interface Props {
  open: boolean;
  onClose: () => void;
  config: CategoryConfig;
  farmId: number;
  entry?: CatalogEntry;
}

export function CatalogEntryDialog({ open, onClose, config, farmId, entry }: Props) {
  const { showToast } = useToast();
  const [override, { isLoading }] = useOverrideCatalogEntryMutation();

  // Editable fields = those without a const value.
  const editable = useMemo(() => config.fields.filter((f) => !f.const), [config.fields]);

  const schema = useMemo(
    () =>
      z.object(
        Object.fromEntries(
          editable.map((f) => [
            f.name,
            f.required ? z.string().min(1, "Ce champ est requis") : z.string().optional(),
          ]),
        ),
      ),
    [editable],
  );
  type FormValues = Record<string, string>;

  const defaults: FormValues = useMemo(() => {
    const out: FormValues = {};
    for (const f of editable) out[f.name] = (entry?.value?.[f.name] as string | undefined) ?? "";
    return out;
  }, [editable, entry]);

  const { control, handleSubmit, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });

  useEffect(() => {
    if (open) reset(defaults);
  }, [open, defaults, reset]);

  const onSubmit = async (values: FormValues) => {
    const consts = Object.fromEntries(
      config.fields.filter((f) => f.const !== undefined).map((f) => [f.name, f.const as string]),
    );
    const value = { ...(entry?.value ?? {}), ...values, ...consts };
    const key = entry?.key ?? slugify(String(values[config.labelField] ?? ""));
    try {
      await override({ farmId, category: config.backendCategory, key, value }).unwrap();
      showToast(entry ? "Entrée mise à jour." : "Entrée ajoutée.", "success");
      onClose();
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <DialogTitle component="div" sx={{ pr: 6 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {entry ? "Modifier l'entrée" : `Ajouter — ${config.title}`}
          </Typography>
          <IconButton
            onClick={onClose}
            aria-label="Fermer"
            sx={{ position: "absolute", top: 12, right: 12 }}
          >
            <X size={20} />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            {editable.map((f) => (
              <Controller
                key={f.name}
                name={f.name}
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    select={f.type === "select"}
                    label={f.label}
                    fullWidth
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  >
                    {f.type === "select" &&
                      (f.options ?? []).map((o) => (
                        <MenuItem key={o.value} value={o.value}>
                          {o.label}
                        </MenuItem>
                      ))}
                  </TextField>
                )}
              />
            ))}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onClose} color="inherit">
            Annuler
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={isLoading}
            startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : null}
          >
            Enregistrer
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run src/components/settings/CatalogEntryDialog.test.tsx`
Expected: PASS. Then `cd web && npx tsc --noEmit 2>&1 | grep CatalogEntryDialog` → no errors on these files.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/settings/CatalogEntryDialog.tsx web/src/components/settings/CatalogEntryDialog.test.tsx
git commit -m "feat(web): generic catalog entry dialog driven by category config"
```

---

### Task 5: `CatalogManager` (table + add/edit/disable)

**Files:**
- Create: `web/src/components/settings/CatalogManager.tsx`
- Test: `web/src/components/settings/CatalogManager.test.tsx`

**Interfaces:**
- Consumes: `CategoryConfig` (`@/constants/catalogCategories`), `CatalogEntry`/`useGetCatalogQuery`/`useDeleteCatalogEntryMutation` (`@/store/api/catalogApi`), `useFarmRole`/`canManageCatalog` (`@/hooks/useFarmRole`), `CatalogEntryDialog` (Task 4), `ConfirmDialog` (`@/components/shared/ConfirmDialog`; props `{ open, title, message, confirmLabel?, cancelLabel?, danger?, loading?, onConfirm, onClose }`), `useToast`, `apiErrorMessage`, `colors` (`@/theme/tokens`).
- Produces: `CatalogManager({ config, farmId }: { config: CategoryConfig; farmId: number })`.

- [ ] **Step 1: Write the failing test** — `web/src/components/settings/CatalogManager.test.tsx`

```tsx
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { setTokens } from "@/store/slices/authSlice";
import { CatalogManager } from "./CatalogManager";
import { getCategoryConfig } from "@/constants/catalogCategories";

const LOTS = getCategoryConfig("lots")!;

function makeJwt(payload: unknown): string {
  const b64 = btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `h.${b64}.s`;
}
function respond(data: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify({ data }), { status: 200, headers: { "Content-Type": "application/json" } }),
  );
}
let lastMethod = "";
let lastUrl = "";
beforeEach(() => {
  lastMethod = "";
  lastUrl = "";
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    lastUrl = input instanceof Request ? input.url : String(input);
    lastMethod = input instanceof Request ? input.method : (init?.method ?? "GET");
    if (lastMethod === "DELETE") return new Response(null, { status: 204 });
    return respond([
      { category: "breeds", key: "cobb_500", value: { label: "Cobb 500", type: "broiler" }, custom: false },
      { category: "breeds", key: "ma-race", value: { label: "Ma Race", type: "layer" }, custom: true },
    ]);
  }));
});
afterEach(() => vi.unstubAllGlobals());

function ownerToken() {
  return makeJwt({ memberships: [{ farmId: 1, farmRole: "OWNER", permissions: ["*"] }] });
}

describe("CatalogManager", () => {
  it("lists entries with a platform/custom badge", async () => {
    const { store } = renderWithProviders(<CatalogManager config={LOTS} farmId={1} />);
    store.dispatch(setTokens({ accessToken: ownerToken(), refreshToken: "r" }));
    expect(await screen.findByText("Cobb 500")).toBeInTheDocument();
    expect(screen.getByText("Ma Race")).toBeInTheDocument();
    expect(screen.getByText("Plateforme")).toBeInTheDocument();
    expect(screen.getByText("Personnalisé")).toBeInTheDocument();
  });

  it("labels the row action Désactiver for a platform entry and Supprimer for a custom one", async () => {
    const { store } = renderWithProviders(<CatalogManager config={LOTS} farmId={1} />);
    store.dispatch(setTokens({ accessToken: ownerToken(), refreshToken: "r" }));
    await screen.findByText("Cobb 500");
    expect(screen.getByRole("button", { name: /Désactiver Cobb 500/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Supprimer Ma Race/i })).toBeInTheDocument();
  });

  it("hides write actions when the user cannot manage the catalog (no role)", async () => {
    renderWithProviders(<CatalogManager config={LOTS} farmId={1} />); // no token → role null
    await screen.findByText("Cobb 500");
    expect(screen.queryByRole("button", { name: /Ajouter/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/components/settings/CatalogManager.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the manager** — `web/src/components/settings/CatalogManager.tsx`

```tsx
"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { CategoryConfig, FieldDescriptor } from "@/constants/catalogCategories";
import type { CatalogEntry } from "@/store/api/catalogApi";
import { useGetCatalogQuery, useDeleteCatalogEntryMutation } from "@/store/api/catalogApi";
import { useFarmRole, canManageCatalog } from "@/hooks/useFarmRole";
import { CatalogEntryDialog } from "./CatalogEntryDialog";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
import { colors } from "@/theme/tokens";

/** Render a field's display value (option label for selects, raw string otherwise). */
function displayValue(field: FieldDescriptor, value: Record<string, unknown>): string {
  const raw = value[field.name];
  if (raw == null) return "—";
  if (field.type === "select") {
    return field.options?.find((o) => o.value === raw)?.label ?? String(raw);
  }
  return String(raw);
}

export function CatalogManager({ config, farmId }: { config: CategoryConfig; farmId: number }) {
  const { data: entries, isLoading, error } = useGetCatalogQuery({
    farmId,
    category: config.backendCategory,
  });
  const [deleteEntry, { isLoading: deleting }] = useDeleteCatalogEntryMutation();
  const { showToast } = useToast();
  const role = useFarmRole(farmId);
  const canManage = canManageCatalog(role);

  const [addOpen, setAddOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<CatalogEntry | null>(null);
  const [toRemove, setToRemove] = useState<CatalogEntry | null>(null);

  // Columns: the label field first, then the other non-const fields.
  const columns = config.fields.filter((f) => f.const === undefined);

  const handleRemove = async () => {
    if (!toRemove) return;
    try {
      await deleteEntry({ farmId, category: config.backendCategory, key: toRemove.key }).unwrap();
      showToast(toRemove.custom ? "Entrée supprimée." : "Entrée désactivée.", "success");
      setToRemove(null);
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" }, mb: 2 }}
      >
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {config.title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {config.description}
          </Typography>
        </Box>
        {canManage && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<Plus size={18} />}
            onClick={() => setAddOpen(true)}
          >
            Ajouter
          </Button>
        )}
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {apiErrorMessage(error)}
        </Alert>
      )}

      {isLoading && <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2 }} />}

      {!isLoading && !error && entries && entries.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
          Aucune entrée. Ajoutez la première.
        </Typography>
      )}

      {!isLoading && !error && entries && entries.length > 0 && (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                {columns.map((c) => (
                  <TableCell key={c.name}>{c.label}</TableCell>
                ))}
                <TableCell>Origine</TableCell>
                {canManage && <TableCell align="right">Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.map((entry) => {
                const name = String(entry.value[config.labelField] ?? entry.key);
                return (
                  <TableRow key={entry.key} hover>
                    {columns.map((c) => (
                      <TableCell key={c.name}>{displayValue(c, entry.value)}</TableCell>
                    ))}
                    <TableCell>
                      <Chip
                        label={entry.custom ? "Personnalisé" : "Plateforme"}
                        size="small"
                        sx={{
                          bgcolor: entry.custom ? colors.accent[50] : colors.primary[50],
                          color: entry.custom ? colors.accent[700] : colors.primary[700],
                          fontWeight: 600,
                        }}
                      />
                    </TableCell>
                    {canManage && (
                      <TableCell align="right">
                        <IconButton
                          aria-label={`Modifier ${name}`}
                          onClick={() => setEditEntry(entry)}
                          size="small"
                        >
                          <Pencil size={18} />
                        </IconButton>
                        <IconButton
                          aria-label={`${entry.custom ? "Supprimer" : "Désactiver"} ${name}`}
                          onClick={() => setToRemove(entry)}
                          size="small"
                        >
                          <Trash2 size={18} />
                        </IconButton>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {canManage && (
        <CatalogEntryDialog
          open={addOpen}
          onClose={() => setAddOpen(false)}
          config={config}
          farmId={farmId}
        />
      )}
      {canManage && editEntry && (
        <CatalogEntryDialog
          open
          onClose={() => setEditEntry(null)}
          config={config}
          farmId={farmId}
          entry={editEntry}
        />
      )}
      <ConfirmDialog
        open={Boolean(toRemove)}
        title={toRemove?.custom ? "Supprimer cette entrée ?" : "Désactiver cette entrée ?"}
        message={
          toRemove?.custom
            ? "Cette entrée personnalisée sera définitivement supprimée."
            : "Cette entrée de la plateforme sera masquée pour votre ferme. Vous pourrez la réactiver en la ré-ajoutant."
        }
        confirmLabel={toRemove?.custom ? "Supprimer" : "Désactiver"}
        danger
        loading={deleting}
        onConfirm={handleRemove}
        onClose={() => setToRemove(null)}
      />
    </Box>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run src/components/settings/CatalogManager.test.tsx`
Expected: PASS. Then `cd web && npx tsc --noEmit 2>&1 | grep CatalogManager` → no errors on these files.
(Note: `colors.accent[50]`/`colors.accent[700]`/`colors.primary[50]`/`colors.primary[700]` all exist in `@/theme/tokens`.)

- [ ] **Step 5: Commit**

```bash
git add web/src/components/settings/CatalogManager.tsx web/src/components/settings/CatalogManager.test.tsx
git commit -m "feat(web): catalog manager table with add/edit/disable"
```

---

### Task 6: wire the `[category]` page + full verification

**Files:**
- Create: `web/src/components/settings/CatalogCategoryView.tsx`
- Modify: `web/src/app/(dashboard)/reglages/[category]/page.tsx`
- Test: `web/src/components/settings/CatalogCategoryView.test.tsx`

**Interfaces:**
- Consumes: `getCategoryConfig` (`@/constants/catalogCategories`), `CatalogManager` (Task 5), `useSelectedFarm` (`@/hooks/useSelectedFarm`, returns `{ farmId, isLoading, hasFarm }`).
- Produces: `CatalogCategoryView({ slug }: { slug: string })` — resolves the config + farm and renders the manager, or a "coming soon" placeholder for an unconfigured slug.

- [ ] **Step 1: Write the failing test** — `web/src/components/settings/CatalogCategoryView.test.tsx`

```tsx
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { CatalogCategoryView } from "./CatalogCategoryView";

function respond(data: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify({ data }), { status: 200, headers: { "Content-Type": "application/json" } }),
  );
}
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.includes("/farms/mine")) return respond([{ id: 1, name: "Ferme" }]);
    if (url.includes("/catalog/")) return respond([]);
    return respond([]);
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe("CatalogCategoryView", () => {
  it("renders the manager for a configured slug", async () => {
    renderWithProviders(<CatalogCategoryView slug="lots" />);
    expect(await screen.findByText("Souches et races de volaille (chair, ponte).")).toBeInTheDocument();
  });
  it("renders a coming-soon placeholder for an unconfigured slug", () => {
    renderWithProviders(<CatalogCategoryView slug="ventes" />);
    expect(screen.getByText(/Bientôt disponible/i)).toBeInTheDocument();
  });
});
```

(Note: `useSelectedFarm` calls the farms endpoint via `useGetMyFarmsQuery`. Confirm the URL substring by reading `web/src/store/api/farmsApi.ts` — adjust the `farms/mine` matcher in the stub to whatever path that query uses, e.g. `/api/v1/farms` or `/api/v1/me/farms`. The stub must return a farm with `id: 1` so `farmId` resolves.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/components/settings/CatalogCategoryView.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the view** — `web/src/components/settings/CatalogCategoryView.tsx`

```tsx
"use client";

import Link from "next/link";
import { Box, Button, Card, CardContent, Skeleton, Typography } from "@mui/material";
import { getCategoryConfig } from "@/constants/catalogCategories";
import { useSelectedFarm } from "@/hooks/useSelectedFarm";
import { CatalogManager } from "./CatalogManager";

const PLACEHOLDER_NAMES: Record<string, string> = {
  stock: "Stock",
  ventes: "Ventes",
};

export function CatalogCategoryView({ slug }: { slug: string }) {
  const config = getCategoryConfig(slug);
  const { farmId, isLoading } = useSelectedFarm();

  if (!config) {
    const name = PLACEHOLDER_NAMES[slug] ?? slug;
    return (
      <Card>
        <CardContent>
          <Box sx={{ py: 6, textAlign: "center" }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
              Bientôt disponible
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              La gestion des paramètres « {name} » arrivera dans une prochaine version.
            </Typography>
            <Button component={Link} href="/reglages" variant="outlined">
              Retour aux réglages
            </Button>
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (isLoading || !farmId) {
    return <Skeleton variant="rectangular" height={240} sx={{ borderRadius: 2 }} />;
  }

  return <CatalogManager config={config} farmId={farmId} />;
}
```

- [ ] **Step 4: Wire the page** — replace the body of `web/src/app/(dashboard)/reglages/[category]/page.tsx`

```tsx
import Link from "next/link";
import { Box, Breadcrumbs, Typography } from "@mui/material";
import { getCategoryConfig } from "@/constants/catalogCategories";
import { CatalogCategoryView } from "@/components/settings/CatalogCategoryView";

const CATEGORY_NAMES: Record<string, string> = {
  stock: "Stock",
  lots: "Lots",
  sanitaire: "Sanitaire",
  ventes: "Ventes",
  comptabilite: "Comptabilité",
};

/** Settings category page: renders the generic catalog manager for configured slugs. */
export default async function SettingsCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const name = getCategoryConfig(category)?.title ?? CATEGORY_NAMES[category] ?? category;

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 1 }}>
        <Link href="/reglages" style={{ color: "inherit" }}>
          Réglages
        </Link>
        <Typography color="text.primary">{name}</Typography>
      </Breadcrumbs>

      <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
        {name}
      </Typography>

      <CatalogCategoryView slug={category} />
    </Box>
  );
}
```

- [ ] **Step 5: Run the view test + full frontend gate**

```bash
cd web
npx vitest run src/components/settings/CatalogCategoryView.test.tsx   # both pass
npx tsc --noEmit                                                      # exit 0
npm run lint                                                          # 0 errors
npx vitest run                                                        # whole suite green
npx next build                                                        # Compiled successfully
```
Expected: all green. (This is the last task — the whole app must build.)

- [ ] **Step 6: Commit**

```bash
git add web/src/components/settings/CatalogCategoryView.tsx web/src/components/settings/CatalogCategoryView.test.tsx "web/src/app/(dashboard)/reglages/[category]/page.tsx"
git commit -m "feat(web): wire generic catalog manager into settings category pages"
```

---

## Self-Review (spec coverage)

- §3 Config déclarative (FieldDescriptor/CategoryConfig/registry) → Task 1. ✓
- §4 `catalogApi` → Task 2 ; `useFarmRole`/`canManageCatalog` → Task 3 ; `CatalogEntryDialog` → Task 4 ; `CatalogManager` → Task 5 ; page wiring + `CatalogCategoryView` → Task 6. ✓
- §5 Sémantique : create derives key via slugify (T4), edit keeps key + preserves unknown value keys (T4 `{...entry.value, ...values, ...consts}`, tested), disable-vs-delete label by `custom` (T5, tested). ✓
- §2 Write gating by farm role (OWNER/MANAGER) → `useFarmRole`/`canManageCatalog` (T3) consumed in T5 (actions hidden when `!canManage`, tested). ✓
- §6 Tests → each task ships its Vitest tests; T6 runs the full gate. ✓
- §2 No backend/migration/dependency → no task touches backend or package.json. ✓

**Type consistency:** `CategoryConfig`/`FieldDescriptor` (T1) consumed unchanged in T4/T5/T6; `CatalogEntry` (T2) consumed in T4/T5; `useFarmRole`/`canManageCatalog` (T3) in T5; `CatalogManager({config, farmId})` (T5) called by `CatalogCategoryView` (T6) with the resolved `farmId`. `getCategoryConfig` (T1) used in T6 page + view.

**Ordering:** T1 → T2 → T3 → T4 → T5 → T6 (T6 is the whole-frontend green gate). T4/T5 depend on T1+T2; T5 also on T3+T4; T6 on T1+T5.

**Known ambiguity flagged for the implementer (T6):** the exact URL that `useSelectedFarm`/`useGetMyFarmsQuery` calls — the T6 test stub must match it (read `web/src/store/api/farmsApi.ts`). This is the only value not pinned in the plan; everything else is exact.
