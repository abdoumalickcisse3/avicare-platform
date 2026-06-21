# Refonte UX Commercial — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refondre l'UX transactionnelle du module commercial (frontend) : navigation resserrée, fil conducteur guidé, actions 1-clic, fiche client compte-courant, impression PDF — sans toucher au backend.

**Architecture:** Next.js 16 App Router + MUI v7 + RTK Query. On consomme l'API REST B5-5 existante (slices clients/sales/orders/deliveries/invoices/payments inchangées). On restructure les pages `web/src/app/(dashboard)/commercial/*` et `web/src/components/commercial/*`. Spec : `docs/superpowers/specs/2026-06-21-commercial-ux-refonte-design.md`.

**Tech Stack:** TypeScript, Next.js 16, MUI v7, RTK Query, Vitest + Testing Library, lucide-react, date-fns.

## Global Constraints

- **Backend inchangé** : aucune modif d'API, de slice RTK Query (endpoints), de migration. On lit l'existant.
- **Pas de page d'accueil/cockpit commercial** : sidebar Commercial = 4 entrées `Clients · Commandes · Ventes · Factures` ; `/commercial` redirige vers `/commercial/commandes`.
- **Aucune carte KPI/statistique** sur les pages commerciales (→ dashboard, Spec B). Compteurs autorisés uniquement sur les onglets.
- **Hors périmètre** : TVA, remises, avoirs/retours (conflit D25 / pas d'entités backend).
- **Gating** : `useCommercialGating` (`module.commercial.basic`) ; le 403 backend reste la garde réelle.
- **Conventions repo** : commits sans signature Claude ; 1 PR = 1 sujet (une PR par phase R1–R4) ; `tsc --noEmit` + `eslint` + `vitest run` + `next build` verts avant chaque commit de fin de tâche ; CI verte avant merge.
- **Routes dynamiques** : `[id]/page.tsx` = server component `await params` → client `*DetailView`.
- **Devise/format** : `formatCurrency`/`formatDate` de `@/lib/format` ; tokens via `@/theme/tokens` (jamais de hex en dur).

---

## File Structure

**Phase R1 — Nav & épuration**
- Modify `web/src/components/layout/Sidebar.tsx` — groupe Commercial = 4 enfants.
- Modify `web/src/components/layout/Sidebar.test.tsx` — assertions nav.
- Delete `web/src/app/(dashboard)/commercial/page.tsx` (cockpit) → recreate as redirect.
- Delete `web/src/app/(dashboard)/commercial/livraisons/page.tsx` → redirect.
- Delete `web/src/app/(dashboard)/commercial/paiements/page.tsx` → redirect.
- Modify `web/src/app/(dashboard)/commercial/commandes/page.tsx` — défaut « À livrer » + onglet « Livraisons ».
- Modify `web/src/app/(dashboard)/commercial/factures/page.tsx` — défaut « À encaisser » + onglet « Paiements », retrait KPI.
- Modify `web/src/app/(dashboard)/commercial/clients/page.tsx` — onglet « Débiteurs », retrait `ClientsKpis`.
- Modify `web/src/app/(dashboard)/commercial/ventes/page.tsx` — retrait KPI.
- Delete `web/src/components/commercial/ClientsKpis.tsx` (inutilisé après retrait).

**Phase R2 — DocumentFlow & 1-clic**
- Modify `web/src/lib/commercial.ts` — ajout `commercialNextStep()` (logique pure).
- Create `web/src/lib/commercial.nextStep.test.ts` — tests de la logique.
- Create `web/src/components/commercial/DocumentFlow.tsx` — bandeau provenance + liens + étape suivante.
- Modify les 4 vues détail (`OrderDetailView`, `InvoiceDetailView`, + vues vente/livraison si présentes) pour intégrer `DocumentFlow`.

**Phase R3 — Fiche client compte-courant**
- Modify `web/src/lib/commercial.ts` — ajout `buildClientTimeline()` (logique pure).
- Create `web/src/lib/commercial.timeline.test.ts` — tests d'agrégation.
- Modify `web/src/components/commercial/ClientDetailView.tsx` — timeline + actions.

**Phase R4 — Impression PDF**
- Create `web/src/components/commercial/PrintableInvoice.tsx` + `web/src/app/(dashboard)/commercial/factures/[id]/imprimer/page.tsx`.
- Create `web/src/components/commercial/PrintableDeliveryNote.tsx` + route d'impression livraison.
- Modify `web/src/app/globals.css` (ou feuille dédiée) — règles `@media print`.

---

## Phase R1 — Navigation resserrée & épuration

### Task R1.1: Sidebar — groupe Commercial à 4 entrées

**Files:**
- Modify: `web/src/components/layout/Sidebar.tsx`
- Test: `web/src/components/layout/Sidebar.test.tsx`

**Interfaces:**
- Produces: le groupe `commercial` n'expose plus que `/commercial/clients`, `/commercial/commandes`, `/commercial/ventes`, `/commercial/factures`.

- [ ] **Step 1: Update the test** — dans `Sidebar.test.tsx`, après avoir rendu la sidebar avec le module `module.commercial.basic` actif, assert que les libellés `Clients`, `Commandes`, `Ventes`, `Factures` sont présents et que `Livraisons`, `Paiements`, `Vue d'ensemble` sont absents.

```tsx
it("commercial group shows 4 leaves (no Livraisons/Paiements/Vue d'ensemble)", () => {
  renderSidebarWithModules(["module.commercial.basic"]); // helper existant du fichier
  expect(screen.getByText("Clients")).toBeInTheDocument();
  expect(screen.getByText("Commandes")).toBeInTheDocument();
  expect(screen.getByText("Ventes")).toBeInTheDocument();
  expect(screen.getByText("Factures")).toBeInTheDocument();
  expect(screen.queryByText("Livraisons")).not.toBeInTheDocument();
  expect(screen.queryByText("Paiements")).not.toBeInTheDocument();
});
```

(Si le helper de rendu n'existe pas sous ce nom, réutiliser le pattern de rendu déjà présent dans `Sidebar.test.tsx`.)

- [ ] **Step 2: Run the test, expect FAIL**

Run: `cd web && npx vitest run src/components/layout/Sidebar.test.tsx`
Expected: FAIL (Livraisons/Paiements encore présents).

- [ ] **Step 3: Edit the commercial group children** — dans `Sidebar.tsx`, remplacer les enfants du groupe `commercial` par exactement :

```tsx
children: [
  { label: "Clients", href: "/commercial/clients", icon: Users },
  { label: "Commandes", href: "/commercial/commandes", icon: ShoppingBag },
  { label: "Ventes", href: "/commercial/ventes", icon: Receipt },
  { label: "Factures", href: "/commercial/factures", icon: FileText },
],
```

Retirer les imports d'icônes devenus inutilisés (`LayoutGrid` s'il n'est plus utilisé ailleurs, `PackageCheck`, `Wallet`) — vérifier par recherche avant de supprimer.

- [ ] **Step 4: Run the test, expect PASS**

Run: `cd web && npx vitest run src/components/layout/Sidebar.test.tsx`
Expected: PASS.

- [ ] **Step 5: Lint + commit**

```bash
cd web && npx eslint src/components/layout/Sidebar.tsx && cd ..
git add web/src/components/layout/Sidebar.tsx web/src/components/layout/Sidebar.test.tsx
git commit -m "refactor(web): commercial sidebar to 4 entries"
```

### Task R1.2: Supprimer le cockpit `/commercial` → redirection

**Files:**
- Modify (replace content): `web/src/app/(dashboard)/commercial/page.tsx`

**Interfaces:**
- Produces: `/commercial` redirige (server) vers `/commercial/commandes`.

- [ ] **Step 1: Replace the cockpit page by a redirect**

```tsx
import { redirect } from "next/navigation";

/** The commercial area has no landing page; go straight to the orders worklist. */
export default function CommercialIndexPage() {
  redirect("/commercial/commandes");
}
```

- [ ] **Step 2: Verify build picks up the redirect**

Run: `cd web && npx next build 2>&1 | grep "/commercial"`
Expected: `/commercial` listed; no error.

- [ ] **Step 3: Commit**

```bash
git add "web/src/app/(dashboard)/commercial/page.tsx"
git commit -m "refactor(web): /commercial redirects to commandes (no cockpit)"
```

### Task R1.3: Fusionner Livraisons dans Commandes (onglet) + redirection route

**Files:**
- Modify: `web/src/app/(dashboard)/commercial/commandes/page.tsx`
- Modify (replace content): `web/src/app/(dashboard)/commercial/livraisons/page.tsx` (→ redirect)

**Interfaces:**
- Consumes: `useGetDeliveriesQuery`, `DELIVERY_STATUS_META` (existants).
- Produces: la page Commandes a un onglet supplémentaire « Livraisons » listant les livraisons de la ferme (n° LIV, commande, client, transporteur, statut, annuler) — reprise du tableau de l'ancienne page Livraisons.

- [ ] **Step 1:** Dans `commandes/page.tsx`, ajouter un onglet `livraisons` au `Tabs` existant. Quand `tab === "livraisons"`, rendre le tableau des livraisons (copier le corps de tableau + le menu « Annuler la livraison » depuis l'ancienne `livraisons/page.tsx`, en réutilisant `useGetDeliveriesQuery`, `useCancelDeliveryMutation`, `DELIVERY_STATUS_META`). Les autres onglets gardent le tableau des commandes.

- [ ] **Step 2:** Remplacer `livraisons/page.tsx` par une redirection :

```tsx
import { redirect } from "next/navigation";

export default function LivraisonsRedirectPage() {
  redirect("/commercial/commandes");
}
```

- [ ] **Step 3: Typecheck + build**

Run: `cd web && npx tsc --noEmit && npx next build 2>&1 | grep -E "/commercial/(commandes|livraisons)"`
Expected: tsc 0 erreur ; les deux routes compilent.

- [ ] **Step 4: Commit**

```bash
git add "web/src/app/(dashboard)/commercial/commandes/page.tsx" "web/src/app/(dashboard)/commercial/livraisons/page.tsx"
git commit -m "refactor(web): fold deliveries into the orders page (tab) + redirect"
```

### Task R1.4: Fusionner Paiements dans Factures (onglet) + redirection route

**Files:**
- Modify: `web/src/app/(dashboard)/commercial/factures/page.tsx`
- Modify (replace content): `web/src/app/(dashboard)/commercial/paiements/page.tsx` (→ redirect)

**Interfaces:**
- Consumes: `useGetPaymentsQuery`, `useVoidPaymentMutation`, `PAYMENT_METHOD_LABELS` (existants).
- Produces: la page Factures a un onglet « Paiements » listant les paiements (n° P, facture, client, montant, méthode, statut, void) — repris de l'ancienne page Paiements.

- [ ] **Step 1:** Dans `factures/page.tsx`, ajouter un onglet `paiements`. Quand `tab === "paiements"`, rendre le tableau des paiements (copier depuis l'ancienne `paiements/page.tsx`). Les autres onglets gardent le tableau des factures.

- [ ] **Step 2:** Remplacer `paiements/page.tsx` par une redirection vers `/commercial/factures` (même pattern que Step 2 de R1.3).

- [ ] **Step 3: Typecheck + build**

Run: `cd web && npx tsc --noEmit && npx next build 2>&1 | grep -E "/commercial/(factures|paiements)"`
Expected: tsc 0 erreur ; routes compilent.

- [ ] **Step 4: Commit**

```bash
git add "web/src/app/(dashboard)/commercial/factures/page.tsx" "web/src/app/(dashboard)/commercial/paiements/page.tsx"
git commit -m "refactor(web): fold payments into the invoices page (tab) + redirect"
```

### Task R1.5: Onglets actionnables par défaut + retrait des KPI

**Files:**
- Modify: `web/src/app/(dashboard)/commercial/commandes/page.tsx` (défaut `À livrer`)
- Modify: `web/src/app/(dashboard)/commercial/factures/page.tsx` (défaut `À encaisser`, retrait KPI)
- Modify: `web/src/app/(dashboard)/commercial/clients/page.tsx` (onglet `Débiteurs`, retrait `ClientsKpis`)
- Modify: `web/src/app/(dashboard)/commercial/ventes/page.tsx` (retrait KPI)
- Delete: `web/src/components/commercial/ClientsKpis.tsx`

**Interfaces:**
- Produces: chaque liste s'ouvre sur sa vue actionnable, compteurs sur les onglets ; plus aucune carte KPI.

- [ ] **Step 1: Commandes — défaut « À livrer »** : changer l'état initial `useState("all")` → `useState("IN_PROGRESS")` et renommer le libellé de l'onglet `IN_PROGRESS` en `À livrer` (garder la valeur `IN_PROGRESS`). Les compteurs `(n)` existent déjà.

- [ ] **Step 2: Factures — défaut « À encaisser » + retrait KPI** : ajouter un onglet `unpaid` (libellé « À encaisser ») filtrant `ISSUED`+`PARTIALLY_PAID`, et le mettre en défaut `useState("unpaid")`. Supprimer le bloc des 3 cartes KPI (`<Box ...>` des cartes impayées/en retard/CA facturé) et le `useMemo kpis` devenu inutile.

```tsx
// filtre de l'onglet "unpaid"
if (tab === "unpaid") return invoices.filter((i) => i.status === "ISSUED" || i.status === "PARTIALLY_PAID");
```

- [ ] **Step 3: Clients — onglet « Débiteurs » + retrait `ClientsKpis`** : retirer l'import et le rendu de `ClientsKpis` et le `useMemo kpis`. Ajouter un filtre « Débiteurs » (clients `currentBalanceXof > 0`, triés décroissant) exposé soit via un petit `Tabs` (Débiteurs / Tous), soit via un toggle ; défaut « Tous » (les débiteurs restent un onglet, pas le défaut — la page Clients sert d'abord d'annuaire). Réutiliser `isOverLimit`/`creditColor` déjà présents.

- [ ] **Step 4: Ventes — retrait KPI** : supprimer le bloc des 2 cartes KPI (ventes du jour / transactions) et le `useMemo kpis`. La page garde son tableau d'historique.

- [ ] **Step 5: Delete `ClientsKpis.tsx`** une fois qu'aucun import ne le référence.

Run: `cd web && grep -rn "ClientsKpis" src || echo "no refs"`
Expected: `no refs` avant suppression.

```bash
git rm web/src/components/commercial/ClientsKpis.tsx
```

- [ ] **Step 6: Typecheck + lint + full tests + build**

Run: `cd web && npx tsc --noEmit && npx eslint "src/app/(dashboard)/commercial" src/components/commercial && npx vitest run && npx next build`
Expected: tsc 0 ; eslint 0 ; vitest vert ; build OK.

- [ ] **Step 7: Commit**

```bash
git add -A web/src
git commit -m "refactor(web): actionable default tabs + remove per-page KPIs"
```

> **Fin de R1 → PR** : `feat(web): commercial nav slimming + actionable tabs (R1)`. CI verte → merge.

---

## Phase R2 — Fil conducteur (`DocumentFlow`) & actions 1-clic

### Task R2.1: Logique pure `commercialNextStep()`

**Files:**
- Modify: `web/src/lib/commercial.ts`
- Test: `web/src/lib/commercial.nextStep.test.ts`

**Interfaces:**
- Produces:
```ts
export type NextStepKind =
  | "confirm" | "startPreparation" | "deliver"
  | "invoiceFromDelivery" | "invoiceFromSale" | "recordPayment" | "none";
export interface NextStep { kind: NextStepKind; label: string }
export function orderNextStep(o: Order, hasInvoice: boolean): NextStep;
export function invoiceNextStep(i: Invoice): NextStep;
export function saleNextStep(s: Sale, hasInvoice: boolean): NextStep;
```

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { orderNextStep, invoiceNextStep, saleNextStep } from "./commercial";
import type { Order, Invoice, Sale } from "@/types";

const order = (status: Order["status"]): Order =>
  ({ status, items: [] } as unknown as Order);

describe("orderNextStep", () => {
  it("PENDING → confirm", () => expect(orderNextStep(order("PENDING"), false).kind).toBe("confirm"));
  it("CONFIRMED → startPreparation", () => expect(orderNextStep(order("CONFIRMED"), false).kind).toBe("startPreparation"));
  it("IN_PROGRESS → deliver", () => expect(orderNextStep(order("IN_PROGRESS"), false).kind).toBe("deliver"));
  it("DELIVERED + not invoiced → invoiceFromDelivery", () =>
    expect(orderNextStep(order("DELIVERED"), false).kind).toBe("invoiceFromDelivery"));
  it("DELIVERED + invoiced → none", () =>
    expect(orderNextStep(order("DELIVERED"), true).kind).toBe("none"));
  it("CANCELLED → none", () => expect(orderNextStep(order("CANCELLED"), false).kind).toBe("none"));
});

describe("invoiceNextStep", () => {
  const inv = (status: Invoice["status"], outstanding: number): Invoice =>
    ({ status, outstandingXof: outstanding } as unknown as Invoice);
  it("ISSUED with due → recordPayment", () => expect(invoiceNextStep(inv("ISSUED", 1000)).kind).toBe("recordPayment"));
  it("PARTIALLY_PAID with due → recordPayment", () => expect(invoiceNextStep(inv("PARTIALLY_PAID", 500)).kind).toBe("recordPayment"));
  it("PAID → none", () => expect(invoiceNextStep(inv("PAID", 0)).kind).toBe("none"));
  it("CANCELLED → none", () => expect(invoiceNextStep(inv("CANCELLED", 0)).kind).toBe("none"));
});

describe("saleNextStep", () => {
  const sale = (status: Sale["status"]): Sale => ({ status } as unknown as Sale);
  it("COMPLETED + not invoiced → invoiceFromSale (optional)", () =>
    expect(saleNextStep(sale("COMPLETED"), false).kind).toBe("invoiceFromSale"));
  it("COMPLETED + invoiced → none", () => expect(saleNextStep(sale("COMPLETED"), true).kind).toBe("none"));
  it("CANCELLED → none", () => expect(saleNextStep(sale("CANCELLED"), false).kind).toBe("none"));
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `cd web && npx vitest run src/lib/commercial.nextStep.test.ts`
Expected: FAIL (functions undefined).

- [ ] **Step 3: Implement in `lib/commercial.ts`**

```ts
import type { Invoice, Order, Sale } from "@/types"; // ajouter aux imports existants

export type NextStepKind =
  | "confirm" | "startPreparation" | "deliver"
  | "invoiceFromDelivery" | "invoiceFromSale" | "recordPayment" | "none";
export interface NextStep { kind: NextStepKind; label: string }

const NONE: NextStep = { kind: "none", label: "" };

export function orderNextStep(o: Order, hasInvoice: boolean): NextStep {
  switch (o.status) {
    case "PENDING": return { kind: "confirm", label: "Confirmer" };
    case "CONFIRMED": return { kind: "startPreparation", label: "Préparer" };
    case "IN_PROGRESS": return { kind: "deliver", label: "Livrer" };
    case "DELIVERED": return hasInvoice ? NONE : { kind: "invoiceFromDelivery", label: "Générer la facture" };
    default: return NONE;
  }
}

export function invoiceNextStep(i: Invoice): NextStep {
  if (i.status === "CANCELLED" || i.status === "PAID") return NONE;
  return i.outstandingXof > 0 ? { kind: "recordPayment", label: "Encaisser" } : NONE;
}

export function saleNextStep(s: Sale, hasInvoice: boolean): NextStep {
  if (s.status !== "COMPLETED" || hasInvoice) return NONE;
  return { kind: "invoiceFromSale", label: "Générer la facture" };
}
```

- [ ] **Step 4: Run, expect PASS**

Run: `cd web && npx vitest run src/lib/commercial.nextStep.test.ts`
Expected: PASS (15 assertions).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/commercial.ts web/src/lib/commercial.nextStep.test.ts
git commit -m "feat(web): commercial next-step logic (DocumentFlow core)"
```

### Task R2.2: Composant `DocumentFlow`

**Files:**
- Create: `web/src/components/commercial/DocumentFlow.tsx`

**Interfaces:**
- Consumes: `orderNextStep`/`invoiceNextStep`/`saleNextStep`, `formatCurrency`.
- Produces:
```tsx
export function DocumentFlow(props: {
  links: { label: string; href?: string; current?: boolean }[]; // chaîne provenance→…
  nextStep: NextStep;
  onAction: (kind: NextStepKind) => void;
  busy?: boolean;
}): JSX.Element;
```

- [ ] **Step 1: Implement the component** — un bandeau (Card) avec : la chaîne de documents liés (horizontale, scrollable sur mobile, l'élément `current` en gras) et, à droite, un bouton primaire `nextStep.label` (masqué si `kind === "none"`) appelant `onAction(nextStep.kind)`, désactivé si `busy`. Tokens depuis `@/theme/tokens`. Pas de logique métier ici (déléguée au parent).

- [ ] **Step 2: Build check**

Run: `cd web && npx tsc --noEmit`
Expected: 0 erreur.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/commercial/DocumentFlow.tsx
git commit -m "feat(web): DocumentFlow banner (linked docs + next step)"
```

### Task R2.3: Intégrer `DocumentFlow` + actions 1-clic dans les fiches

**Files:**
- Modify: `web/src/components/commercial/OrderDetailView.tsx`
- Modify: `web/src/components/commercial/InvoiceDetailView.tsx`

**Interfaces:**
- Consumes: `DocumentFlow`, `orderNextStep`/`invoiceNextStep`, slices existantes (`useGetInvoicesQuery` pour savoir si une commande/livraison/vente est déjà facturée ; `useCreateInvoiceFromDeliveryMutation` ; `DeliverOrderDialog` ; `PaymentDialog`).

- [ ] **Step 1: OrderDetailView** — récupérer les factures de la ferme (`useGetInvoicesQuery`) pour calculer `hasInvoice` (existe une facture dont `deliveryId` ∈ livraisons de la commande, ou liée à la commande). Calculer `orderNextStep(order, hasInvoice)`. Rendre `<DocumentFlow links={[commande, livraison?, facture?]} nextStep onAction>` au-dessus du contenu. `onAction` route : `confirm`→`confirm()`, `startPreparation`→`startPrep()`, `deliver`→ouvrir `DeliverOrderDialog`, `invoiceFromDelivery`→`createInvoiceFromDelivery({deliveryId})` puis toast + naviguer vers la facture. Conserver les boutons header existants (ou les remplacer par le seul bouton `DocumentFlow` — au choix, en gardant « Annuler » accessible).

- [ ] **Step 2: InvoiceDetailView** — calculer `invoiceNextStep(invoice)` ; `<DocumentFlow>` avec liens (source → facture → paiements) ; `onAction recordPayment`→ouvrir `PaymentDialog` (déjà présent). Le bouton « Encaisser » du header peut être retiré au profit de celui du `DocumentFlow`.

- [ ] **Step 3: Typecheck + full tests + build**

Run: `cd web && npx tsc --noEmit && npx vitest run && npx next build`
Expected: tout vert.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/commercial/OrderDetailView.tsx web/src/components/commercial/InvoiceDetailView.tsx
git commit -m "feat(web): wire DocumentFlow + one-click invoice/collect into detail views"
```

> **Fin de R2 → PR** : `feat(web): guided commercial flow (DocumentFlow + 1-click) (R2)`.

---

## Phase R3 — Fiche client compte-courant (timeline)

### Task R3.1: Logique pure `buildClientTimeline()`

**Files:**
- Modify: `web/src/lib/commercial.ts`
- Test: `web/src/lib/commercial.timeline.test.ts`

**Interfaces:**
- Produces:
```ts
export type TimelineKind = "order" | "sale" | "invoice" | "payment";
export interface TimelineEntry {
  kind: TimelineKind; id: number; date: string; label: string; amountXof: number; href: string;
}
export function buildClientTimeline(input: {
  orders: Order[]; sales: Sale[]; invoices: Invoice[]; payments: Payment[];
}): TimelineEntry[]; // trié date desc
```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { buildClientTimeline } from "./commercial";

it("merges and sorts by date desc with correct kinds/hrefs", () => {
  const t = buildClientTimeline({
    orders: [{ id: 1, orderNumber: "ORD-1", orderDate: "2026-01-01", totalXof: 1000 }] as any,
    sales: [{ id: 2, saleNumber: "V-1", saleDate: "2026-03-01", totalXof: 2000 }] as any,
    invoices: [{ id: 3, invoiceNumber: "F-1", issueDate: "2026-02-01", totalXof: 1500 }] as any,
    payments: [{ id: 4, paymentNumber: "P-1", paymentDate: "2026-04-01", amountXof: 500 }] as any,
  });
  expect(t.map((e) => e.kind)).toEqual(["payment", "sale", "invoice", "order"]);
  expect(t[0].href).toBe("/commercial/factures/3"); // payment links to its invoice page? -> see step 3
});
```

(Ajuster l'attendu du `href` du paiement selon le choix d'implémentation du Step 3 ; garder l'assert de tri et de kinds.)

- [ ] **Step 2: Run, expect FAIL**

Run: `cd web && npx vitest run src/lib/commercial.timeline.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** — mapper chaque source en `TimelineEntry` (order→`/commercial/commandes/{id}`, sale→`/commercial/ventes` (pas de détail vente : lien liste), invoice→`/commercial/factures/{id}`, payment→`/commercial/factures/{invoiceId}`), concaténer, trier par `date` desc. Libellés : `ORD-…`, `V-…`, `F-…`, `P-…`.

- [ ] **Step 4: Run, expect PASS** — `cd web && npx vitest run src/lib/commercial.timeline.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/commercial.ts web/src/lib/commercial.timeline.test.ts
git commit -m "feat(web): client commercial timeline aggregation"
```

### Task R3.2: Timeline dans `ClientDetailView`

**Files:**
- Modify: `web/src/components/commercial/ClientDetailView.tsx`

- [ ] **Step 1:** Charger les données du client via les slices filtrées (`useGetOrdersQuery({farmId, clientId})`, `useGetSalesQuery` puis filtrer `clientId`, `useGetInvoicesQuery` filtrer `clientId`, `useGetPaymentsQuery` filtrer via factures du client). Construire `buildClientTimeline(...)`. Remplacer le bloc « Historique commercial » placeholder par la timeline (liste d'entrées cliquables, date + libellé + montant, icône par `kind`). Ajouter les actions header « Nouvelle commande » (ouvre `OrderDialog` pré-rempli client) et « Encaisser » (si le client a une facture impayée).

- [ ] **Step 2: Typecheck + full tests + build** — `cd web && npx tsc --noEmit && npx vitest run && npx next build`.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/commercial/ClientDetailView.tsx
git commit -m "feat(web): client account-current timeline + contextual actions"
```

> **Fin de R3 → PR** : `feat(web): client account-current view (R3)`.

---

## Phase R4 — Impression PDF (print CSS, zéro dépendance)

### Task R4.1: Facture imprimable

**Files:**
- Create: `web/src/components/commercial/PrintableInvoice.tsx`
- Create: `web/src/app/(dashboard)/commercial/factures/[id]/imprimer/page.tsx`
- Modify: `web/src/app/globals.css`

**Interfaces:**
- Consumes: `useGetInvoiceQuery`, `useGetClientQuery`, `formatCurrency`/`formatDate`.

- [ ] **Step 1: `PrintableInvoice`** — composant client qui rend une mise en page A4 sobre : en-tête ferme (nom de la ferme courante), bloc client, n° facture + dates, tableau des lignes HT, total/payé/reste dû, statut. Aucune chrome applicative.

- [ ] **Step 2: Route `/imprimer`** — server page `await params` → `<PrintableInvoice invoiceId>`. Au montage (client), appeler `window.print()` une fois les données chargées.

- [ ] **Step 3: `@media print`** — dans `globals.css`, masquer la sidebar/header applicatifs et n'afficher que le contenu imprimable :

```css
@media print {
  body { background: #fff; }
  [data-app-chrome] { display: none !important; }
  [data-print-root] { display: block !important; }
}
```

(Marquer la zone imprimable avec `data-print-root` et la chrome dashboard avec `data-app-chrome` — ajouter l'attribut sur le conteneur du `(dashboard)` layout.)

- [ ] **Step 4:** Ajouter un bouton « Imprimer / PDF » dans `InvoiceDetailView` qui ouvre `/commercial/factures/{id}/imprimer` (nouvel onglet) — l'utilisateur fait « Enregistrer en PDF » depuis la boîte d'impression navigateur.

- [ ] **Step 5: Build** — `cd web && npx tsc --noEmit && npx next build 2>&1 | grep imprimer` (route présente).

- [ ] **Step 6: Commit**

```bash
git add -A web/src
git commit -m "feat(web): printable invoice (print CSS, PDF via browser)"
```

### Task R4.2: Bon de livraison imprimable

**Files:**
- Create: `web/src/components/commercial/PrintableDeliveryNote.tsx`
- Create: `web/src/app/(dashboard)/commercial/commandes/livraison/[id]/imprimer/page.tsx` (ou route équivalente atteignable depuis l'onglet Livraisons / la fiche commande)

- [ ] **Step 1:** `PrintableDeliveryNote` — en-tête + client + lignes livrées (qté + article, sans montants par défaut) + transporteur + date. Réutilise `useGetDeliveryQuery`.
- [ ] **Step 2:** Route `/imprimer` + `window.print()` au montage (même pattern que R4.1).
- [ ] **Step 3:** Bouton « Bon de livraison (PDF) » sur la fiche commande livrée / la ligne de l'onglet Livraisons.
- [ ] **Step 4: Build + full tests** — `cd web && npx tsc --noEmit && npx vitest run && npx next build`.
- [ ] **Step 5: Commit**

```bash
git add -A web/src
git commit -m "feat(web): printable delivery note"
```

> **Fin de R4 → PR** : `feat(web): printable invoice + delivery note (R4)`. Clôt la refonte (Spec A).

---

## Self-Review (couverture du spec)

- §3 Nav 4 entrées → R1.1 ; redirections → R1.2/R1.3/R1.4. ✓
- §4 DocumentFlow + mapping étapes → R2.1 (logique) + R2.2 (UI) + R2.3 (intégration). ✓
- §5 Actions 1-clic → R2.3. ✓
- §6 Fiche client compte-courant → R3.1/R3.2. ✓
- §7 Onglets actionnables par défaut → R1.5. ✓
- §8 Épuration KPI → R1.5 (+ suppression `ClientsKpis`). ✓
- §9 Impression PDF → R4.1/R4.2. ✓
- §10 frontend-design → appliqué transversalement à l'implémentation UI (R1–R4), tokens existants.
- §12 Découpage R1–R4 = une PR par phase. ✓
- §13 Tests → tests logique (R2.1, R3.1) + nav (R1.1) + build/suite à chaque phase. ✓

Types cohérents : `NextStep`/`NextStepKind`, `TimelineEntry`/`TimelineKind` définis en R2.1/R3.1 et consommés en R2.2/R2.3/R3.2. Pas de placeholder.
