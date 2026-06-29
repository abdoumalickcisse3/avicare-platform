# Onglet « Pondeuses » (layer flock tab) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Développer l'onglet « Pondeuses » de la fiche lot de ponte (`/elevage/oeufs/[unitId]`) pour suivre l'effectif de la bande (mortalité, réforme), visualiser son attrition (courbe + relevé), dériver l'entrée en ponte et afficher le stock de plateaux d'œufs.

**Architecture:** 100 % frontend (`web/`), réutilisation des endpoints existants. On étend `productionUnitsApi` (RTK Query) avec `getUnitEvents` / `recordMortality` / `recordUnitEvent`. Des helpers purs (`lib/flock.ts`) dérivent la courbe d'effectif, le relevé d'attrition et l'entrée en ponte depuis la liste d'événements. La présentation est « Courbe-héros + panneau attrition » (pas de bandeau KPI). Aucune migration, aucun changement backend.

**Tech Stack:** Next.js 16 (App Router), MUI v7, RTK Query (`baseApi.injectEndpoints`, `transformResponse: r=>r.data`), recharts + date-fns (charts existants), Vitest + `renderWithProviders`.

## Global Constraints

- Frontend uniquement ; aucune migration, aucun changement backend. Réutiliser les endpoints existants.
- RTK Query existant uniquement (pas de nouveau slice — on étend `productionUnitsApi`). `transformResponse: (r) => r.data`.
- Couleurs via `@/theme/tokens` (`colors`) ; nombres via `@/lib/format` (`formatNumber`) ; police chiffres = `var(--font-mono)` + `tabular-nums`. **Aucun hex en dur.**
- TypeScript strict, pas de `any` (si cast inévitable : `as unknown as T`). Rules of Hooks (appels inconditionnels).
- Réforme = `POST …/events` avec `{ eventType: "REFORM", quantityDelta: -count, reason }`. Mortalité = `POST …/mortality` avec `{ count, reason }`. Le 422 backend reste la garde réelle (jamais < 0, refus si lot CLOSED/CANCELLED).
- Effectif initial **dérivé** de l'événement `CREATED` (`quantityDelta = initialCount`). `ProductionUnit` n'a pas de champ `initialCount`.
- Actions (mortalité/réforme) visibles uniquement si `unit.status === "ACTIVE"`.
- Vérif avant chaque commit : `cd web && npx tsc --noEmit && npm run lint && npx vitest run`. `npm run lint` = projet entier. Commits Conventional Commits, scope `web`, **sans signature Claude/IA**.

---

## File Structure

- **Create** `web/src/lib/flock.ts` — helpers purs (courbe, attrition, entrée en ponte).
- **Create** `web/src/lib/flock.test.ts` — tests des helpers.
- **Create** `web/src/components/poultry-layer/charts/FlockCountCurve.tsx` — courbe d'effectif (recharts).
- **Create** `web/src/components/poultry-layer/LayerFlockEventDialog.tsx` — dialog mortalité/réforme.
- **Create** `web/src/components/poultry-layer/LayerFlockEventDialog.test.tsx`.
- **Create** `web/src/components/poultry-layer/FlockAttritionPanel.tsx` — relevé attrition + entrée en ponte + actions.
- **Create** `web/src/components/poultry-layer/BandEventList.tsx` — historique de bande.
- **Create** `web/src/components/poultry-layer/LayerFlockTab.tsx` — assemble l'onglet.
- **Create** `web/src/components/poultry-layer/LayerFlockTab.test.tsx`.
- **Modify** `web/src/types/index.ts` — `LifecycleEvent`, `MortalityInput`, `UnitEventInput`.
- **Modify** `web/src/store/api/baseApi.ts` — tag `UnitEvent`.
- **Modify** `web/src/store/api/productionUnitsApi.ts` — 3 endpoints.
- **Modify** `web/src/components/poultry-layer/LayerUnitDetailView.tsx` — brancher `LayerFlockTab` sur l'onglet `layers`.

---

### Task 1 : Types + endpoints RTK Query

**Files:**
- Modify: `web/src/types/index.ts`
- Modify: `web/src/store/api/baseApi.ts`
- Modify: `web/src/store/api/productionUnitsApi.ts`

**Interfaces:**
- Consumes: `baseApi` (`store/api/baseApi.ts`), `ApiEnvelope<T>` (déjà déclaré dans `productionUnitsApi.ts`).
- Produces: type `LifecycleEvent { id:number; productionUnitId:number; eventType:string; quantityDelta:number; reason:string|null; details:Record<string,unknown>; occurredAt:string }`, `MortalityInput { count:number; reason?:string }`, `UnitEventInput { eventType:string; quantityDelta:number; reason?:string }` ; hooks `useGetUnitEventsQuery`, `useRecordMortalityMutation`, `useRecordUnitEventMutation`.

- [ ] **Step 1 : ajouter les types** dans `web/src/types/index.ts` (à la fin du fichier) :

```ts
/** A production-unit lifecycle event (mirrors backend LifecycleEventResponse). */
export interface LifecycleEvent {
  id: number;
  productionUnitId: number;
  /** CREATED | MORTALITY | REFORM | COUNT_ADJUSTMENT | SALE | SALE_CANCEL */
  eventType: string;
  quantityDelta: number;
  reason: string | null;
  details: Record<string, unknown>;
  occurredAt: string;
}

/** Record mortality on a production unit (mirrors backend RecordMortalityRequest). */
export interface MortalityInput {
  count: number;
  reason?: string;
}

/** Record a generic lifecycle event (mirrors backend LifecycleEventRequest). */
export interface UnitEventInput {
  eventType: string;
  quantityDelta: number;
  reason?: string;
}
```

- [ ] **Step 2 : ajouter le tag `UnitEvent`** dans `web/src/store/api/baseApi.ts`, dans le tableau `tagTypes`, juste après `"ProductionUnit",` :

```ts
    "ProductionUnit",
    "UnitEvent",
```

- [ ] **Step 3 : ajouter les 3 endpoints** dans `web/src/store/api/productionUnitsApi.ts`. Ajouter l'import de types et les endpoints dans le bloc `endpoints: (build) => ({ ... })`, puis exporter les hooks. Le fichier importe déjà `ProductionUnit, ProductionUnitInput` ; étendre l'import :

```ts
import type {
  LifecycleEvent,
  MortalityInput,
  ProductionUnit,
  ProductionUnitInput,
  UnitEventInput,
} from "@/types";
```

Ajouter, à l'intérieur de `endpoints: (build) => ({`, après `createProductionUnit` :

```ts
    getUnitEvents: build.query<
      LifecycleEvent[],
      { farmId: number; unitId: number }
    >({
      query: ({ farmId, unitId }) =>
        `/api/v1/farms/${farmId}/production-units/${unitId}/events`,
      transformResponse: (r: ApiEnvelope<LifecycleEvent[]>) => r.data,
      providesTags: (_r, _e, { unitId }) => [{ type: "UnitEvent", id: unitId }],
    }),
    recordMortality: build.mutation<
      LifecycleEvent,
      { farmId: number; unitId: number; body: MortalityInput }
    >({
      query: ({ farmId, unitId, body }) => ({
        url: `/api/v1/farms/${farmId}/production-units/${unitId}/mortality`,
        method: "POST",
        body,
      }),
      transformResponse: (r: ApiEnvelope<LifecycleEvent>) => r.data,
      invalidatesTags: (_r, _e, { unitId }) => [
        { type: "ProductionUnit", id: unitId },
        { type: "ProductionUnit", id: "LIST" },
        { type: "UnitEvent", id: unitId },
      ],
    }),
    recordUnitEvent: build.mutation<
      LifecycleEvent,
      { farmId: number; unitId: number; body: UnitEventInput }
    >({
      query: ({ farmId, unitId, body }) => ({
        url: `/api/v1/farms/${farmId}/production-units/${unitId}/events`,
        method: "POST",
        body,
      }),
      transformResponse: (r: ApiEnvelope<LifecycleEvent>) => r.data,
      invalidatesTags: (_r, _e, { unitId }) => [
        { type: "ProductionUnit", id: unitId },
        { type: "ProductionUnit", id: "LIST" },
        { type: "UnitEvent", id: unitId },
      ],
    }),
```

Étendre l'export des hooks en bas du fichier :

```ts
export const {
  useGetProductionUnitsQuery,
  useGetProductionUnitQuery,
  useCreateProductionUnitMutation,
  useGetUnitEventsQuery,
  useRecordMortalityMutation,
  useRecordUnitEventMutation,
} = productionUnitsApi;
```

- [ ] **Step 4 : vérifier la compilation** — `cd web && npx tsc --noEmit` → exit 0.

- [ ] **Step 5 : commit**

```bash
cd /Users/mac/Developer/avicare-platform
git add web/src/types/index.ts web/src/store/api/baseApi.ts web/src/store/api/productionUnitsApi.ts
git commit -m "feat(web): add production-unit events/mortality/event RTK Query endpoints"
```

---

### Task 2 : helpers purs `lib/flock.ts` (TDD)

**Files:**
- Create: `web/src/lib/flock.ts`
- Test: `web/src/lib/flock.test.ts`

**Interfaces:**
- Consumes: type `LifecycleEvent` (Task 1) ; types `DailyProduction` et `EggCollection` (déjà dans `@/types`). `DailyProduction` a `{ productionDate?: string; ... }` — **vérifier le nom exact du champ date** dans `@/types` (`DailyProduction`) et l'utiliser ; `EggCollection` a `{ collectionDate: string; totalEggs: number }`.
- Produces : `reconstructFlockCurve(events: LifecycleEvent[]): { date: string; count: number }[]` ; `summarizeAttrition(events: LifecycleEvent[]): { initial: number; mortality: number; reform: number; current: number; attritionPct: number }` ; `deriveLayingOnset(productions: DailyProduction[], collections: EggCollection[]): string | null`.

- [ ] **Step 1 : écrire les tests** dans `web/src/lib/flock.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import {
  reconstructFlockCurve,
  summarizeAttrition,
  deriveLayingOnset,
} from "./flock";
import type { LifecycleEvent } from "@/types";

function ev(p: Partial<LifecycleEvent>): LifecycleEvent {
  return {
    id: p.id ?? 1,
    productionUnitId: 1,
    eventType: p.eventType ?? "MORTALITY",
    quantityDelta: p.quantityDelta ?? 0,
    reason: p.reason ?? null,
    details: p.details ?? {},
    occurredAt: p.occurredAt ?? "2026-03-01T08:00:00",
  };
}

const EVENTS: LifecycleEvent[] = [
  ev({ id: 1, eventType: "CREATED", quantityDelta: 1000, occurredAt: "2026-03-01T08:00:00" }),
  ev({ id: 2, eventType: "MORTALITY", quantityDelta: -3, occurredAt: "2026-06-25T08:00:00" }),
  ev({ id: 3, eventType: "REFORM", quantityDelta: -10, occurredAt: "2026-06-29T08:00:00" }),
];

describe("reconstructFlockCurve", () => {
  it("accumulates deltas chronologically starting from 0", () => {
    // Pass events out of order to prove it sorts by occurredAt.
    const curve = reconstructFlockCurve([EVENTS[2], EVENTS[0], EVENTS[1]]);
    expect(curve).toEqual([
      { date: "2026-03-01", count: 1000 },
      { date: "2026-06-25", count: 997 },
      { date: "2026-06-29", count: 987 },
    ]);
  });

  it("returns an empty array for no events", () => {
    expect(reconstructFlockCurve([])).toEqual([]);
  });
});

describe("summarizeAttrition", () => {
  it("separates mortality and reform and computes attrition pct", () => {
    const s = summarizeAttrition(EVENTS);
    expect(s).toEqual({
      initial: 1000,
      mortality: 3,
      reform: 10,
      current: 987,
      attritionPct: 1.3,
    });
  });

  it("is zero-safe when there are no events", () => {
    expect(summarizeAttrition([])).toEqual({
      initial: 0,
      mortality: 0,
      reform: 0,
      current: 0,
      attritionPct: 0,
    });
  });
});

describe("deriveLayingOnset", () => {
  it("returns the earliest closed production date with eggs", () => {
    const productions = [
      { productionDate: "2026-05-20", totalEggsCollected: 0 },
      { productionDate: "2026-05-12", totalEggsCollected: 120 },
      { productionDate: "2026-05-15", totalEggsCollected: 200 },
    ] as unknown as Parameters<typeof deriveLayingOnset>[0];
    expect(deriveLayingOnset(productions, [])).toBe("2026-05-12");
  });

  it("falls back to the earliest collection with eggs", () => {
    const collections = [
      { collectionDate: "2026-05-18", totalEggs: 50 },
      { collectionDate: "2026-05-16", totalEggs: 30 },
    ] as unknown as Parameters<typeof deriveLayingOnset>[1];
    expect(deriveLayingOnset([], collections)).toBe("2026-05-16");
  });

  it("returns null when nothing has eggs", () => {
    expect(deriveLayingOnset([], [])).toBeNull();
  });
});
```

- [ ] **Step 2 : lancer les tests, vérifier l'échec** — `cd web && npx vitest run src/lib/flock.test.ts` → FAIL (`flock` introuvable).

- [ ] **Step 3 : vérifier le nom du champ date de `DailyProduction`** dans `web/src/types/index.ts` (chercher `interface DailyProduction`). Si le champ est `productionDate` et le total `totalEggsCollected`, le code ci-dessous est correct ; sinon adapter les deux accès dans `deriveLayingOnset` aux noms réels (et corriger le test en conséquence).

- [ ] **Step 4 : implémenter** `web/src/lib/flock.ts` :

```ts
import type { DailyProduction, EggCollection, LifecycleEvent } from "@/types";

/** ISO datetime → "YYYY-MM-DD" (date part only). */
function dayOf(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Reconstruct the flock head-count over time from its lifecycle events.
 * Accumulates deltas from 0 in chronological order; the CREATED event carries
 * +initialCount, so the first point is the initial count and the last is current.
 */
export function reconstructFlockCurve(
  events: LifecycleEvent[],
): { date: string; count: number }[] {
  const sorted = [...events].sort((a, b) =>
    a.occurredAt < b.occurredAt ? -1 : a.occurredAt > b.occurredAt ? 1 : 0,
  );
  let running = 0;
  return sorted.map((e) => {
    running += e.quantityDelta;
    return { date: dayOf(e.occurredAt), count: running };
  });
}

/** Attrition breakdown derived from the events (initial = CREATED delta). */
export function summarizeAttrition(events: LifecycleEvent[]): {
  initial: number;
  mortality: number;
  reform: number;
  current: number;
  attritionPct: number;
} {
  let initial = 0;
  let mortality = 0;
  let reform = 0;
  let current = 0;
  for (const e of events) {
    current += e.quantityDelta;
    if (e.eventType === "CREATED") initial += e.quantityDelta;
    else if (e.eventType === "MORTALITY") mortality += Math.abs(e.quantityDelta);
    else if (e.eventType === "REFORM") reform += Math.abs(e.quantityDelta);
  }
  const attritionPct =
    initial === 0 ? 0 : ((initial - current) / initial) * 100;
  return {
    initial,
    mortality,
    reform,
    current,
    // round to 1 decimal to avoid float noise (1.2999999…)
    attritionPct: Math.round(attritionPct * 10) / 10,
  };
}

/**
 * Onset of lay = earliest closed daily production with eggs > 0; falls back to
 * the earliest collection with eggs > 0; null if nothing has laid yet.
 */
export function deriveLayingOnset(
  productions: DailyProduction[],
  collections: EggCollection[],
): string | null {
  const fromProductions = productions
    .filter((p) => (p.totalEggsCollected ?? 0) > 0)
    .map((p) => p.productionDate)
    .sort();
  if (fromProductions.length > 0) return fromProductions[0];

  const fromCollections = collections
    .filter((c) => (c.totalEggs ?? 0) > 0)
    .map((c) => c.collectionDate)
    .sort();
  return fromCollections.length > 0 ? fromCollections[0] : null;
}
```

- [ ] **Step 5 : lancer les tests, vérifier le succès** — `cd web && npx vitest run src/lib/flock.test.ts` → PASS. Si `DailyProduction` n'expose pas `productionDate`/`totalEggsCollected`, corriger Step 4 + le test du Step 1 avec les vrais noms, puis relancer.

- [ ] **Step 6 : commit**

```bash
cd /Users/mac/Developer/avicare-platform
git add web/src/lib/flock.ts web/src/lib/flock.test.ts
git commit -m "feat(web): pure helpers for flock curve, attrition and laying onset"
```

---

### Task 3 : courbe d'effectif `FlockCountCurve` (recharts)

**Files:**
- Create: `web/src/components/poultry-layer/charts/FlockCountCurve.tsx`

**Interfaces:**
- Consumes: `reconstructFlockCurve` (Task 2) ; recharts ; `colors` de `@/theme/tokens` ; `date-fns` `format`.
- Produces: `FlockCountCurve({ events }: { events: LifecycleEvent[] })` (composant).

- [ ] **Step 1 : implémenter** `web/src/components/poultry-layer/charts/FlockCountCurve.tsx` (calqué sur `charts/LayingRateCurve.tsx`) :

```tsx
"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Box, Typography } from "@mui/material";
import { format, parseISO } from "date-fns";
import { reconstructFlockCurve } from "@/lib/flock";
import { colors } from "@/theme/tokens";
import type { LifecycleEvent } from "@/types";

export function FlockCountCurve({ events }: { events: LifecycleEvent[] }) {
  const data = reconstructFlockCurve(events).map((p) => ({
    date: p.date,
    label: format(parseISO(p.date), "dd/MM"),
    count: p.count,
  }));

  if (data.length === 0) {
    return (
      <Box sx={{ py: 6, textAlign: "center" }}>
        <Typography variant="body2" color="text.secondary">
          Aucun événement pour tracer l&apos;effectif.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%", height: 280 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.neutral[100]} />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: colors.neutral[500] }} />
          <YAxis
            tick={{ fontSize: 12, fill: colors.neutral[500] }}
            allowDecimals={false}
            width={48}
          />
          <Tooltip
            formatter={(v: number) => [v, "Effectif"]}
            labelFormatter={(l) => `Le ${l}`}
          />
          <Line
            type="stepAfter"
            dataKey="count"
            stroke={colors.info.main}
            strokeWidth={2}
            dot={{ r: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
}
```

- [ ] **Step 2 : vérifier la compilation** — `cd web && npx tsc --noEmit` → exit 0. (Vérif visuelle déléguée au tab du Task 6.)

- [ ] **Step 3 : commit**

```bash
cd /Users/mac/Developer/avicare-platform
git add web/src/components/poultry-layer/charts/FlockCountCurve.tsx
git commit -m "feat(web): flock head-count curve chart"
```

---

### Task 4 : dialog mortalité / réforme `LayerFlockEventDialog` (TDD)

**Files:**
- Create: `web/src/components/poultry-layer/LayerFlockEventDialog.tsx`
- Test: `web/src/components/poultry-layer/LayerFlockEventDialog.test.tsx`

**Interfaces:**
- Consumes: `useRecordMortalityMutation`, `useRecordUnitEventMutation` (Task 1) ; `useToast` (`@/components/feedback/ToastProvider`) ; `apiErrorMessage` (`@/lib/apiError`) ; `colors`.
- Produces: `LayerFlockEventDialog({ open, onClose, farmId, unitId, mode, currentCount }: { open: boolean; onClose: () => void; farmId: number; unitId: number; mode: "mortality" | "reform"; currentCount: number })`.

- [ ] **Step 1 : écrire le test** `web/src/components/poultry-layer/LayerFlockEventDialog.test.tsx` :

```tsx
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { LayerFlockEventDialog } from "./LayerFlockEventDialog";

function respond(data: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

let lastBody: Record<string, unknown> | null = null;

beforeEach(() => {
  lastBody = null;
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      if (init?.body) lastBody = JSON.parse(init.body as string);
      if (url.includes("/mortality") || url.includes("/events")) {
        return respond({
          id: 9,
          productionUnitId: 1,
          eventType: "MORTALITY",
          quantityDelta: -2,
          reason: null,
          details: {},
          occurredAt: "2026-06-29T08:00:00",
        });
      }
      return respond([]);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("LayerFlockEventDialog", () => {
  it("bloque la soumission tant que la quantité est 0", async () => {
    renderWithProviders(
      <LayerFlockEventDialog
        open
        onClose={vi.fn()}
        farmId={1}
        unitId={1}
        mode="mortality"
        currentCount={100}
      />,
    );
    expect(
      screen.getByRole("button", { name: /Enregistrer/i }),
    ).toBeDisabled();
  });

  it("envoie la mortalité avec le bon corps", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(
      <LayerFlockEventDialog
        open
        onClose={onClose}
        farmId={1}
        unitId={1}
        mode="mortality"
        currentCount={100}
      />,
    );
    await user.type(screen.getByLabelText(/Nombre/i), "2");
    await user.click(screen.getByRole("button", { name: /Enregistrer/i }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(lastBody).toEqual({ count: 2, reason: undefined });
  });

  it("envoie la réforme comme un événement REFORM à delta négatif", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <LayerFlockEventDialog
        open
        onClose={vi.fn()}
        farmId={1}
        unitId={1}
        mode="reform"
        currentCount={100}
      />,
    );
    await user.type(screen.getByLabelText(/Nombre/i), "10");
    await user.click(screen.getByRole("button", { name: /Enregistrer/i }));
    await waitFor(() =>
      expect(lastBody).toEqual({
        eventType: "REFORM",
        quantityDelta: -10,
        reason: undefined,
      }),
    );
  });
});
```

- [ ] **Step 2 : lancer le test, vérifier l'échec** — `cd web && npx vitest run src/components/poultry-layer/LayerFlockEventDialog.test.tsx` → FAIL (composant introuvable).

- [ ] **Step 3 : implémenter** `web/src/components/poultry-layer/LayerFlockEventDialog.tsx` :

```tsx
"use client";

import { useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from "@mui/material";
import {
  useRecordMortalityMutation,
  useRecordUnitEventMutation,
} from "@/store/api/productionUnitsApi";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";

type Mode = "mortality" | "reform";

const COPY: Record<Mode, { title: string; label: string; success: string }> = {
  mortality: {
    title: "Saisir une mortalité",
    label: "Nombre de sujets morts",
    success: "Mortalité enregistrée.",
  },
  reform: {
    title: "Réforme de la bande",
    label: "Nombre de sujets réformés",
    success: "Réforme enregistrée.",
  },
};

export function LayerFlockEventDialog({
  open,
  onClose,
  farmId,
  unitId,
  mode,
  currentCount,
}: {
  open: boolean;
  onClose: () => void;
  farmId: number;
  unitId: number;
  mode: Mode;
  currentCount: number;
}) {
  const { showToast } = useToast();
  const [recordMortality, { isLoading: mLoading }] = useRecordMortalityMutation();
  const [recordUnitEvent, { isLoading: eLoading }] = useRecordUnitEventMutation();
  const [count, setCount] = useState(0);
  const [reason, setReason] = useState("");

  const copy = COPY[mode];
  const saving = mLoading || eLoading;
  const overCount = count > currentCount;

  const reset = () => {
    setCount(0);
    setReason("");
  };

  const submit = async () => {
    if (count <= 0) return;
    try {
      if (mode === "mortality") {
        await recordMortality({
          farmId,
          unitId,
          body: { count, reason: reason || undefined },
        }).unwrap();
      } else {
        await recordUnitEvent({
          farmId,
          unitId,
          body: { eventType: "REFORM", quantityDelta: -count, reason: reason || undefined },
        }).unwrap();
      }
      showToast(copy.success, "success");
      reset();
      onClose();
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      fullWidth
      maxWidth="xs"
    >
      <DialogTitle>{copy.title}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label={`Nombre — ${copy.label}`}
            type="number"
            value={count === 0 ? "" : count}
            onChange={(e) =>
              setCount(Math.max(0, Math.floor(Number(e.target.value) || 0)))
            }
            inputMode="numeric"
            autoFocus
            fullWidth
          />
          <TextField
            label="Motif (optionnel)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            fullWidth
          />
          {overCount && (
            <Alert severity="warning">
              Dépasse l&apos;effectif actuel ({currentCount}) — le serveur refusera si l&apos;effectif
              passe sous 0.
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button
          onClick={() => {
            reset();
            onClose();
          }}
          color="inherit"
        >
          Annuler
        </Button>
        <Button
          onClick={submit}
          variant="contained"
          disabled={count <= 0 || saving}
        >
          Enregistrer
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

- [ ] **Step 4 : lancer le test, vérifier le succès** — `cd web && npx vitest run src/components/poultry-layer/LayerFlockEventDialog.test.tsx` → PASS.

- [ ] **Step 5 : commit**

```bash
cd /Users/mac/Developer/avicare-platform
git add web/src/components/poultry-layer/LayerFlockEventDialog.tsx web/src/components/poultry-layer/LayerFlockEventDialog.test.tsx
git commit -m "feat(web): mortality/reform dialog for layer flock"
```

---

### Task 5 : panneau attrition + historique (présentation)

**Files:**
- Create: `web/src/components/poultry-layer/FlockAttritionPanel.tsx`
- Create: `web/src/components/poultry-layer/BandEventList.tsx`

**Interfaces:**
- Consumes: `summarizeAttrition` (Task 2) ; `LayerFlockEventDialog` (Task 4) ; `formatNumber` (`@/lib/format`) ; `colors` ; `ageInDays` (`@/lib/poultry`) ; `date-fns` `format`/`parseISO`.
- Produces: `FlockAttritionPanel({ farmId, unitId, status, startDate, currentCount, events, onsetDate }: { farmId:number; unitId:number; status:string; startDate:string; currentCount:number; events:LifecycleEvent[]; onsetDate:string|null })` ; `BandEventList({ events }: { events: LifecycleEvent[] })`.

- [ ] **Step 1 : implémenter** `web/src/components/poultry-layer/FlockAttritionPanel.tsx` :

```tsx
"use client";

import { useState } from "react";
import { Box, Button, Card, CardContent, Divider, Stack, Typography } from "@mui/material";
import { HeartCrack, LogOut } from "lucide-react";
import { format, parseISO } from "date-fns";
import { summarizeAttrition } from "@/lib/flock";
import { formatNumber } from "@/lib/format";
import { ageInDays } from "@/lib/poultry";
import { colors } from "@/theme/tokens";
import type { LifecycleEvent } from "@/types";
import { LayerFlockEventDialog } from "./LayerFlockEventDialog";

const mono = {
  fontFamily: "var(--font-mono)",
  fontVariantNumeric: "tabular-nums",
} as const;

function Row({
  label,
  value,
  tint,
  strong,
}: {
  label: string;
  value: string;
  tint?: string;
  strong?: boolean;
}) {
  return (
    <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "baseline" }}>
      <Typography variant="body2" sx={{ color: tint ?? colors.neutral[600] }}>
        {label}
      </Typography>
      <Typography sx={{ ...mono, fontWeight: strong ? 700 : 500, color: tint ?? colors.neutral[800] }}>
        {value}
      </Typography>
    </Stack>
  );
}

export function FlockAttritionPanel({
  farmId,
  unitId,
  status,
  startDate,
  currentCount,
  events,
  onsetDate,
}: {
  farmId: number;
  unitId: number;
  status: string;
  startDate: string;
  currentCount: number;
  events: LifecycleEvent[];
  onsetDate: string | null;
}) {
  const [dialog, setDialog] = useState<null | "mortality" | "reform">(null);
  const a = summarizeAttrition(events);

  const onsetLabel =
    onsetDate != null
      ? `S.${Math.floor(ageInDays(onsetDate) / 7) + 1} · ${format(parseISO(onsetDate), "dd/MM/yyyy")}`
      : "—";

  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
          Attrition
        </Typography>
        <Stack spacing={1}>
          <Row label="Initial" value={formatNumber(a.initial)} />
          <Row label="− Mortalité" value={formatNumber(a.mortality)} tint={colors.error.main} />
          <Row label="− Réforme" value={formatNumber(a.reform)} tint={colors.warning.main} />
          <Divider />
          <Row label="= Effectif" value={formatNumber(currentCount)} strong />
          <Row label="Attrition" value={`${a.attritionPct.toFixed(1)} %`} />
          <Row label="Entrée en ponte" value={onsetLabel} />
        </Stack>

        {status === "ACTIVE" && (
          <Stack direction="row" spacing={1.5} sx={{ mt: 2.5 }}>
            <Button
              variant="outlined"
              color="inherit"
              size="small"
              startIcon={<HeartCrack size={16} />}
              onClick={() => setDialog("mortality")}
            >
              Mortalité
            </Button>
            <Button
              variant="outlined"
              color="inherit"
              size="small"
              startIcon={<LogOut size={16} />}
              onClick={() => setDialog("reform")}
            >
              Réforme
            </Button>
          </Stack>
        )}
      </CardContent>

      {dialog && (
        <LayerFlockEventDialog
          open
          onClose={() => setDialog(null)}
          farmId={farmId}
          unitId={unitId}
          mode={dialog}
          currentCount={currentCount}
        />
      )}
      {/* startDate is part of the public contract for future onset-by-age tweaks. */}
      <Box sx={{ display: "none" }} data-start-date={startDate} />
    </Card>
  );
}
```

> Note : `startDate` est dans la signature pour cohérence (âge), mais l'âge d'entrée en ponte est calculé sur `onsetDate`. Le petit `Box display:none` évite un paramètre inutilisé ; si le linter le tolère autrement, retirer le Box et préfixer le param `_startDate`. Choisir l'option qui passe `npm run lint` sans warning d'inutilisé.

- [ ] **Step 2 : implémenter** `web/src/components/poultry-layer/BandEventList.tsx` :

```tsx
"use client";

import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
import { format, parseISO } from "date-fns";
import { colors } from "@/theme/tokens";
import type { LifecycleEvent } from "@/types";

const mono = {
  fontFamily: "var(--font-mono)",
  fontVariantNumeric: "tabular-nums",
} as const;

const EVENT_LABELS: Record<string, string> = {
  CREATED: "Création",
  MORTALITY: "Mortalité",
  REFORM: "Réforme",
  COUNT_ADJUSTMENT: "Ajustement",
  SALE: "Vente",
  SALE_CANCEL: "Annulation vente",
};

function deltaColor(delta: number): string {
  if (delta > 0) return colors.success.main;
  if (delta < 0) return colors.error.main;
  return colors.neutral[500];
}

export function BandEventList({ events }: { events: LifecycleEvent[] }) {
  const sorted = [...events].sort((a, b) =>
    a.occurredAt < b.occurredAt ? 1 : a.occurredAt > b.occurredAt ? -1 : 0,
  );

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5 }}>
          Historique de bande
        </Typography>
        {sorted.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Aucun événement enregistré.
          </Typography>
        ) : (
          <Stack divider={<Box sx={{ borderBottom: `1px solid ${colors.neutral[100]}` }} />}>
            {sorted.map((e) => (
              <Stack
                key={e.id}
                direction="row"
                spacing={2}
                sx={{ alignItems: "center", py: 1 }}
              >
                <Typography variant="body2" sx={{ ...mono, color: colors.neutral[500], width: 84 }}>
                  {format(parseISO(e.occurredAt), "dd/MM/yyyy")}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>
                  {EVENT_LABELS[e.eventType] ?? e.eventType}
                </Typography>
                <Typography sx={{ ...mono, fontWeight: 700, color: deltaColor(e.quantityDelta), width: 64, textAlign: "right" }}>
                  {e.quantityDelta > 0 ? `+${e.quantityDelta}` : e.quantityDelta}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                  {e.reason ?? ""}
                </Typography>
              </Stack>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3 : vérifier la compilation** — `cd web && npx tsc --noEmit` → exit 0.

- [ ] **Step 4 : commit**

```bash
cd /Users/mac/Developer/avicare-platform
git add web/src/components/poultry-layer/FlockAttritionPanel.tsx web/src/components/poultry-layer/BandEventList.tsx
git commit -m "feat(web): flock attrition panel and band event history"
```

---

### Task 6 : assemblage `LayerFlockTab` + branchement + vérif finale

**Files:**
- Create: `web/src/components/poultry-layer/LayerFlockTab.tsx`
- Test: `web/src/components/poultry-layer/LayerFlockTab.test.tsx`
- Modify: `web/src/components/poultry-layer/LayerUnitDetailView.tsx`

**Interfaces:**
- Consumes: `useGetUnitEventsQuery` (Task 1) ; `useGetDailyProductionsQuery`, `useGetCollectionsQuery` (`@/store/api/eggProductionApi`) ; `deriveLayingOnset` (Task 2) ; `FlockCountCurve` (Task 3) ; `FlockAttritionPanel`, `BandEventList` (Task 5) ; `TrayStockPanel` (`./TrayStockPanel`) ; `isoDaysAgo`, `isoToday` (`@/lib/layer`) ; `ProductionUnit` (`@/types`).
- Produces: `LayerFlockTab({ farmId, unit }: { farmId: number; unit: ProductionUnit })`.

- [ ] **Step 1 : écrire le test** `web/src/components/poultry-layer/LayerFlockTab.test.tsx` :

```tsx
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { LayerFlockTab } from "./LayerFlockTab";
import type { ProductionUnit } from "@/types";

const UNIT: ProductionUnit = {
  id: 1,
  farmId: 1,
  species: "POULTRY",
  unitKind: "BATCH",
  breedId: 5,
  name: "Lot Pondeuse",
  startDate: "2026-03-01",
  endDate: null,
  currentCount: 987,
  status: "ACTIVE",
};

const EVENTS = [
  { id: 1, productionUnitId: 1, eventType: "CREATED", quantityDelta: 1000, reason: "unit_created", details: {}, occurredAt: "2026-03-01T08:00:00" },
  { id: 2, productionUnitId: 1, eventType: "MORTALITY", quantityDelta: -3, reason: "chaleur", details: {}, occurredAt: "2026-06-25T08:00:00" },
  { id: 3, productionUnitId: 1, eventType: "REFORM", quantityDelta: -10, reason: "fin de ponte", details: {}, occurredAt: "2026-06-29T08:00:00" },
];

function respond(data: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/events")) return respond(EVENTS);
      if (url.includes("tray-stock")) return respond({ farmId: 1, fullTraysCount: 29, emptyTraysCount: 4, updatedAt: "2026-06-29T00:00:00Z" });
      return respond([]);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("LayerFlockTab", () => {
  it("affiche le relevé d'attrition dérivé des événements", async () => {
    renderWithProviders(<LayerFlockTab farmId={1} unit={UNIT} />);
    // initial 1000, mortalité 3, réforme 10
    expect(await screen.findByText("Attrition")).toBeInTheDocument();
    expect(await screen.findByText("1 000")).toBeInTheDocument(); // formatNumber(1000) — espace fine
    expect(await screen.findByText("Historique de bande")).toBeInTheDocument();
  });

  it("masque les actions si le lot n'est pas ACTIVE", async () => {
    renderWithProviders(
      <LayerFlockTab farmId={1} unit={{ ...UNIT, status: "CLOSED" }} />,
    );
    await screen.findByText("Attrition");
    expect(screen.queryByRole("button", { name: /Mortalité/i })).not.toBeInTheDocument();
  });
});
```

> Note : `formatNumber(1000)` peut produire `1 000` avec une **espace fine insécable** (` `) selon la locale. Au Step 4, vérifier la sortie réelle de `formatNumber` et ajuster l'assertion (`1 000` ou `1 000` ou `1000`) pour qu'elle corresponde. Si trop fragile, remplacer par une assertion sur un texte stable (« Initial » + « Entrée en ponte » présents).

- [ ] **Step 2 : lancer le test, vérifier l'échec** — `cd web && npx vitest run src/components/poultry-layer/LayerFlockTab.test.tsx` → FAIL (composant introuvable).

- [ ] **Step 3 : implémenter** `web/src/components/poultry-layer/LayerFlockTab.tsx` :

```tsx
"use client";

import { Box, Card, CardContent, Skeleton, Stack, Typography } from "@mui/material";
import { useGetUnitEventsQuery } from "@/store/api/productionUnitsApi";
import {
  useGetCollectionsQuery,
  useGetDailyProductionsQuery,
} from "@/store/api/eggProductionApi";
import { deriveLayingOnset } from "@/lib/flock";
import { isoDaysAgo, isoToday } from "@/lib/layer";
import type { ProductionUnit } from "@/types";
import { FlockCountCurve } from "./charts/FlockCountCurve";
import { FlockAttritionPanel } from "./FlockAttritionPanel";
import { BandEventList } from "./BandEventList";
import { TrayStockPanel } from "./TrayStockPanel";

export function LayerFlockTab({
  farmId,
  unit,
}: {
  farmId: number;
  unit: ProductionUnit;
}) {
  const { data: events, isLoading } = useGetUnitEventsQuery({
    farmId,
    unitId: unit.id,
  });
  const { data: productions } = useGetDailyProductionsQuery({
    farmId,
    unitId: unit.id,
    from: isoDaysAgo(365),
    to: isoToday(),
  });
  const { data: collections } = useGetCollectionsQuery({
    farmId,
    unitId: unit.id,
    from: isoDaysAgo(365),
    to: isoToday(),
  });

  const evts = events ?? [];
  const onset = deriveLayingOnset(productions ?? [], collections ?? []);

  return (
    <Stack spacing={3}>
      <Box
        sx={{
          display: "grid",
          gap: { xs: 2, md: 3 },
          gridTemplateColumns: { xs: "1fr", md: "2fr 1fr" },
        }}
      >
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
              Effectif de la bande
            </Typography>
            {isLoading ? (
              <Skeleton variant="rectangular" height={280} sx={{ borderRadius: 2 }} />
            ) : (
              <FlockCountCurve events={evts} />
            )}
          </CardContent>
        </Card>

        <FlockAttritionPanel
          farmId={farmId}
          unitId={unit.id}
          status={unit.status}
          startDate={unit.startDate}
          currentCount={unit.currentCount}
          events={evts}
          onsetDate={onset}
        />
      </Box>

      <TrayStockPanel farmId={farmId} />

      <BandEventList events={evts} />
    </Stack>
  );
}
```

- [ ] **Step 4 : lancer le test, vérifier le succès** — `cd web && npx vitest run src/components/poultry-layer/LayerFlockTab.test.tsx` → PASS. Ajuster l'assertion `formatNumber` si besoin (cf. note Step 1).

- [ ] **Step 5 : brancher dans la fiche** — `web/src/components/poultry-layer/LayerUnitDetailView.tsx`. Ajouter l'import et remplacer le bloc placeholder de l'onglet `layers`.

Ajouter l'import (près des autres imports de tabs) :

```ts
import { LayerFlockTab } from "./LayerFlockTab";
```

Remplacer :

```tsx
      {tab === "layers" && (
        <LayerPlaceholderTab
          icon={Bird}
          title="Suivi des pondeuses — bientôt disponible"
          description="Le détail par bande (entrée en ponte, réforme, mortalité dédiée) arrivera dans une prochaine version."
        />
      )}
```

par :

```tsx
      {tab === "layers" && <LayerFlockTab farmId={farmId as number} unit={unit} />}
```

> Après cette substitution, `LayerPlaceholderTab` et l'icône `Bird` peuvent devenir inutilisés **dans ce fichier**. Vérifier : si `Bird`/`LayerPlaceholderTab` ne sont plus référencés ailleurs dans `LayerUnitDetailView.tsx`, retirer leurs imports pour éviter un warning lint d'inutilisé. (Le composant `LayerPlaceholderTab` reste dans le repo — il est encore utilisé pour d'autres onglets, ne pas le supprimer.)

- [ ] **Step 6 : vérification complète** —

```bash
cd /Users/mac/Developer/avicare-platform/web
npx tsc --noEmit && npm run lint && npx vitest run && npx next build
```

Attendu : tsc exit 0 ; lint 0 erreur ; vitest tout vert ; next build « Compiled successfully ».

- [ ] **Step 7 : commit**

```bash
cd /Users/mac/Developer/avicare-platform
git add web/src/components/poultry-layer/LayerFlockTab.tsx web/src/components/poultry-layer/LayerFlockTab.test.tsx web/src/components/poultry-layer/LayerUnitDetailView.tsx
git commit -m "feat(web): wire layer flock tab into the egg-unit detail page"
```

---

## Self-Review (couverture du spec)

- §3 Mortalité (endpoint existant) → Task 1 (endpoint) + Task 4 (dialog). ✓
- §3 Réforme (event REFORM, delta négatif) → Task 1 + Task 4. ✓
- §3 Entrée en ponte dérivée → Task 2 `deriveLayingOnset` + Task 5/6 affichage. ✓
- §3 Courbe d'effectif (accumulation depuis 0, initial = CREATED) → Task 2 `reconstructFlockCurve` + Task 3 chart. ✓
- §3 Plateaux d'œufs (TrayStockPanel) → Task 6. ✓
- §3 Actions visibles si ACTIVE → Task 5 (panel) + Task 6 (test masquage CLOSED). ✓
- §4 Disposition (courbe-héros 2fr + attrition 1fr ; plateaux ; historique) → Task 6. ✓
- §5 Types + endpoints + tag UnitEvent → Task 1. ✓
- §5 Helpers purs → Task 2 (+ tests). ✓
- §6 Tous les composants/fichiers → Tasks 3-6. ✓
- §8 Tests purs + composant → Tasks 2, 4, 6. ✓
- Type consistency : `LifecycleEvent`/`MortalityInput`/`UnitEventInput` (Task 1) consommés tels quels en 2/4/5/6 ; `reconstructFlockCurve`/`summarizeAttrition`/`deriveLayingOnset` (Task 2) signatures stables en 3/5/6. ✓
