# Stock › Bibliothèque — articles personnalisés (CRUD) — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Permettre à une ferme de créer / modifier / supprimer ses propres articles d'inventaire depuis la page Stock › Bibliothèque (les articles plateforme restent en lecture seule).

**Architecture:** Réutilise le paramétrage 3 couches : les articles sont des `catalog_items` catégorie `inventory_items`. Un petit changement backend fait remonter les customs ferme (`listForFarm` + flag `custom`) ; la création/édition/suppression réutilisent l'endpoint `FarmCatalogController` existant. Le reste est frontend (dialog + actions de table).

**Tech Stack:** Spring Boot / Java 21 ; Next.js 16 / MUI v9 / RTK Query / react-hook-form + zod / Vitest.

## Global Constraints

- Commits : Conventional Commits, scope bounded-context (`feat(livestock:inventory)`, `feat(web)`). **Aucune signature Claude/AI, pas de Co-Authored-By, pas d'emoji.**
- Source des articles custom = **INVENTORY** uniquement. Value JSONB : `{label, subcategory, unit, typical_unit_price_xof}` (clés exactes).
- RBAC : create/edit/delete = **OWNER/MANAGER** (déjà enforce par `FarmCatalogController`) ; l'UI gate le bouton/les actions via `canManageCatalog(useFarmRole(farmId))`.
- Sous-catégories : `FEED`/`CONSUMABLE`/`EQUIPMENT`/`PRODUCT` (libellés FR Aliment/Consommable/Équipement/Produit).
- MUI est **v9** dans ce repo. Web : « This is NOT the Next.js you know » (consulter `web/node_modules/next/dist/docs/` au besoin).
- Footgun : ajouter un champ à un `record` casse les constructions POSITIONNELLES → grep + fix tous les sites.
- Backend : après édition, `./mvnw -q spotless:apply -pl avicare-app` ; après édition d'un fichier test, `clean test-compile`. Frontend : vitest ciblé + `npm run lint`.
- `*IT` Testcontainers = CI only.

---

## File Structure

**Backend (Task 1)**
- Modify `backend/avicare-app/src/main/java/com/avicare/livestock/inventory/InventoryCatalogItemDto.java` — champ `custom`.
- Modify `.../inventory/InventoryCatalogService.java` — `listForFarm`, `custom`, `farmId`.
- Modify `.../inventory/InventoryCatalogController.java` — passe `farmId` au service.
- Fix `OrderServiceTest`, `SaleServiceTest`, `PurchaseOrderServiceTest`, `StockMovementServiceTest` — sites positionnels.
- Create test `.../inventory/InventoryCatalogServiceTest.java`.

**Frontend**
- Modify `web/src/types/index.ts` — `InventoryCatalogItem.custom`. (Task 2)
- Modify `web/src/store/api/inventoryCatalogApi.ts` — 3 mutations. (Task 2)
- Modify `web/src/lib/inventory.ts` — `INVENTORY_SUBCATEGORY_LABELS`. (Task 3)
- Create `web/src/components/inventory/ArticleDialog.tsx` (+ `.test.tsx`). (Task 3)
- Modify `web/src/app/(dashboard)/stocks/articles/page.tsx` (+ create `page.test.tsx`). (Task 4)

---

## Task 1 : Backend — flag `custom` + lecture fusionnée `listForFarm`

**Files:**
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/inventory/InventoryCatalogItemDto.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/inventory/InventoryCatalogService.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/inventory/InventoryCatalogController.java`
- Modify (tests): `OrderServiceTest.java`, `SaleServiceTest.java`, `PurchaseOrderServiceTest.java`, `StockMovementServiceTest.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/livestock/inventory/InventoryCatalogServiceTest.java` (create)

**Interfaces:**
- Produces: `InventoryCatalogItemDto(String articleKey, ArticleSource articleSource, String label, String subcategory, String unit, Integer typicalUnitPriceXof, boolean custom)` ; `InventoryCatalogService.listInventoryArticles(Long farmId)` + `listAllAvailableArticles(Long farmId)`.

- [ ] **Step 1: Écrire le test de service (échoue d'abord)**

Create `InventoryCatalogServiceTest.java` :

```java
package com.avicare.livestock.inventory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.avicare.livestock.health.HealthCatalogService;
import com.avicare.parameters.api.ParametersFacade;
import com.avicare.parameters.api.dto.CatalogEntryInfo;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

/** Unit test: farm-merged inventory articles carry the platform/custom flag. */
class InventoryCatalogServiceTest {

  private ParametersFacade parametersFacade;
  private HealthCatalogService healthCatalogService;
  private InventoryCatalogService service;

  @BeforeEach
  void setUp() {
    parametersFacade = Mockito.mock(ParametersFacade.class);
    healthCatalogService = Mockito.mock(HealthCatalogService.class);
    service = new InventoryCatalogService(parametersFacade, healthCatalogService);
  }

  @Test
  void listInventoryArticles_mergesFarmCatalog_andFlagsCustom() {
    when(parametersFacade.listForFarm(7L, "inventory_items"))
        .thenReturn(
            List.of(
                new CatalogEntryInfo(
                    "inventory_items",
                    "feed_starter_broiler",
                    Map.of(
                        "label", "Démarrage poulet chair",
                        "subcategory", "FEED",
                        "unit", "kg",
                        "typical_unit_price_xof", 500),
                    false),
                new CatalogEntryInfo(
                    "inventory_items",
                    "melange-maison",
                    Map.of("label", "Mélange maison", "subcategory", "FEED", "unit", "sac"),
                    true)));

    List<InventoryCatalogItemDto> items = service.listInventoryArticles(7L);

    assertThat(items).hasSize(2);
    InventoryCatalogItemDto platform =
        items.stream().filter(i -> i.articleKey().equals("feed_starter_broiler")).findFirst().orElseThrow();
    assertThat(platform.custom()).isFalse();
    assertThat(platform.typicalUnitPriceXof()).isEqualTo(500);
    InventoryCatalogItemDto custom =
        items.stream().filter(i -> i.articleKey().equals("melange-maison")).findFirst().orElseThrow();
    assertThat(custom.custom()).isTrue();
    assertThat(custom.label()).isEqualTo("Mélange maison");
    assertThat(custom.typicalUnitPriceXof()).isNull();
  }
}
```

- [ ] **Step 2: Compiler — échoue (custom absent / signature)**

Run: `cd backend && ./mvnw -q -pl avicare-app -am clean test-compile`
Expected: FAIL — `constructor InventoryCatalogItemDto(...) cannot be applied` / `method listInventoryArticles(long) not found`.

- [ ] **Step 3: Ajouter `custom` au DTO**

Dans `InventoryCatalogItemDto.java`, ajouter `boolean custom` comme DERNIER composant :

```java
public record InventoryCatalogItemDto(
    String articleKey,
    ArticleSource articleSource,
    String label,
    String subcategory,
    String unit,
    Integer typicalUnitPriceXof,
    boolean custom) {}
```

- [ ] **Step 4: Fusionner la lecture dans `InventoryCatalogService`**

Dans `InventoryCatalogService.java` :

Remplacer `listInventoryArticles()` par une version prenant `farmId` et lisant `listForFarm` :

```java
  public List<InventoryCatalogItemDto> listInventoryArticles(Long farmId) {
    return parametersFacade.listForFarm(farmId, CAT_INVENTORY_ITEMS).stream()
        .map(InventoryCatalogService::toInventoryDto)
        .toList();
  }
```

Faire de même pour `listAllAvailableArticles` :

```java
  public List<InventoryCatalogItemDto> listAllAvailableArticles(Long farmId) {
    return Stream.concat(
            listInventoryArticles(farmId).stream(), listMedicationArticles().stream())
        .toList();
  }
```

Mettre à jour `toInventoryDto` pour propager `custom` (dernier argument) :

```java
  private static InventoryCatalogItemDto toInventoryDto(CatalogEntryInfo e) {
    Map<String, Object> v = e.value();
    return new InventoryCatalogItemDto(
        e.key(),
        ArticleSource.INVENTORY,
        str(v, "label"),
        str(v, "subcategory"),
        str(v, "unit"),
        intg(v, "typical_unit_price_xof"),
        e.custom());
  }
```

Mettre à jour la construction dans `listMedicationArticles` (médicaments = plateforme, `custom=false`) — ajouter `false` comme dernier argument du `new InventoryCatalogItemDto(...)`.

- [ ] **Step 5: Passer `farmId` dans le contrôleur**

Dans `InventoryCatalogController.java` :

```java
  public ApiResponse<List<InventoryCatalogItemDto>> articles(@PathVariable Long farmId) {
    return ApiResponse.of(catalogService.listInventoryArticles(farmId));
  }
```
```java
  public ApiResponse<List<InventoryCatalogItemDto>> allArticles(@PathVariable Long farmId) {
    return ApiResponse.of(catalogService.listAllAvailableArticles(farmId));
  }
```

- [ ] **Step 6: Corriger les constructions positionnelles en test**

Run: `cd backend && grep -rln "new InventoryCatalogItemDto(" avicare-app/src/test`
Pour CHAQUE `new InventoryCatalogItemDto(...)` trouvé (dans `OrderServiceTest`, `SaleServiceTest`, `PurchaseOrderServiceTest`, `StockMovementServiceTest`), ajouter `false` comme DERNIER argument (ce sont des articles plateforme dans ces fixtures). Il y a ~10 sites.

- [ ] **Step 7: Compiler (clean, fichiers test édités)**

Run: `cd backend && ./mvnw -q -pl avicare-app -am clean test-compile`
Expected: BUILD SUCCESS.

- [ ] **Step 8: Lancer le test du service — passe**

Run: `cd backend && ./mvnw -q -pl avicare-app -am test -Dtest=InventoryCatalogServiceTest -Dsurefire.failIfNoSpecifiedTests=false`
Expected: PASS (1 test).

- [ ] **Step 9: Spotless + commit**

```bash
cd backend && ./mvnw -q spotless:apply -pl avicare-app
git add backend/avicare-app/src/main/java/com/avicare/livestock/inventory/ \
        backend/avicare-app/src/test/java/com/avicare/livestock/
git commit -m "feat(livestock:inventory): expose farm-custom articles via listForFarm + custom flag"
```

---

## Task 2 : Frontend — type `custom` + mutations create/update/delete

**Files:**
- Modify: `web/src/types/index.ts:704-711`
- Modify: `web/src/store/api/inventoryCatalogApi.ts`

**Interfaces:**
- Produces: `InventoryCatalogItem.custom: boolean` ; `useCreateArticleMutation`, `useUpdateArticleMutation`, `useDeleteArticleMutation` (`{ farmId, key, value? }`).

- [ ] **Step 1: Ajouter `custom` au type**

Dans `web/src/types/index.ts`, dans `interface InventoryCatalogItem`, ajouter :

```ts
  custom: boolean;
```
(après `typicalUnitPriceXof`).

- [ ] **Step 2: Ajouter les mutations à `inventoryCatalogApi`**

Dans `web/src/store/api/inventoryCatalogApi.ts`, à l'intérieur de `endpoints: (build) => ({ ... })`, ajouter (après `getPlatformFormulas`) :

```ts
    createArticle: build.mutation<
      void,
      { farmId: number; key: string; value: Record<string, unknown> }
    >({
      query: ({ farmId, key, value }) => ({
        url: `/api/v1/farms/${farmId}/catalog/inventory_items`,
        method: "POST",
        body: { key, value },
      }),
      invalidatesTags: [
        { type: "InventoryCatalog", id: "articles" },
        { type: "InventoryCatalog", id: "all" },
      ],
    }),
    updateArticle: build.mutation<
      void,
      { farmId: number; key: string; value: Record<string, unknown> }
    >({
      query: ({ farmId, key, value }) => ({
        url: `/api/v1/farms/${farmId}/catalog/inventory_items`,
        method: "POST",
        body: { key, value },
      }),
      invalidatesTags: [
        { type: "InventoryCatalog", id: "articles" },
        { type: "InventoryCatalog", id: "all" },
      ],
    }),
    deleteArticle: build.mutation<void, { farmId: number; key: string }>({
      query: ({ farmId, key }) => ({
        url: `/api/v1/farms/${farmId}/catalog/inventory_items/${key}`,
        method: "DELETE",
      }),
      invalidatesTags: [
        { type: "InventoryCatalog", id: "articles" },
        { type: "InventoryCatalog", id: "all" },
      ],
    }),
```

Puis dans le bloc d'exports en bas, ajouter :

```ts
  useCreateArticleMutation,
  useUpdateArticleMutation,
  useDeleteArticleMutation,
```

- [ ] **Step 3: Typecheck + lint**

Run: `cd web && npx tsc --noEmit && npm run lint`
Expected: 0 erreur.

- [ ] **Step 4: Commit**

```bash
git add web/src/types/index.ts web/src/store/api/inventoryCatalogApi.ts
git commit -m "feat(web): custom flag on InventoryCatalogItem + article create/update/delete endpoints"
```

---

## Task 3 : Frontend — `ArticleDialog` (création / édition)

**Files:**
- Modify: `web/src/lib/inventory.ts` — `INVENTORY_SUBCATEGORY_LABELS`
- Create: `web/src/components/inventory/ArticleDialog.tsx`
- Test: `web/src/components/inventory/ArticleDialog.test.tsx`

**Interfaces:**
- Consumes: `useCreateArticleMutation`, `useUpdateArticleMutation` (Task 2) ; `slugify` (`@/lib/slug`).
- Produces: `<ArticleDialog open onClose farmId article? />` where `article?: InventoryCatalogItem` (édition si fourni).

- [ ] **Step 1: Ajouter les libellés de sous-catégorie**

Dans `web/src/lib/inventory.ts`, ajouter :

```ts
/** FR labels for inventory article subcategories. */
export const INVENTORY_SUBCATEGORY_LABELS: Record<string, string> = {
  FEED: "Aliment",
  CONSUMABLE: "Consommable",
  EQUIPMENT: "Équipement",
  PRODUCT: "Produit",
};
```

- [ ] **Step 2: Écrire le test du dialog (échoue d'abord)**

Create `web/src/components/inventory/ArticleDialog.test.tsx` :

```tsx
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { ArticleDialog } from "./ArticleDialog";

let lastBody: Record<string, unknown> | null = null;
let lastMethod = "";

beforeEach(() => {
  lastBody = null;
  lastMethod = "";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      lastMethod = input instanceof Request ? input.method : (init?.method ?? "GET");
      if (input instanceof Request) {
        try {
          lastBody = await input.clone().json();
        } catch {
          /* no body */
        }
      } else if (init?.body) {
        lastBody = JSON.parse(init.body as string);
      }
      return new Response(JSON.stringify({ data: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("ArticleDialog", () => {
  it("creates a custom article with a slugified key and the exact value payload", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ArticleDialog open onClose={vi.fn()} farmId={1} />);

    await user.type(screen.getByLabelText("Libellé"), "Mélange Maison");
    await user.click(screen.getByRole("combobox", { name: "Sous-catégorie" }));
    await user.click(await screen.findByRole("option", { name: "Aliment" }));
    await user.type(screen.getByLabelText("Unité"), "sac");
    await user.type(screen.getByLabelText("Prix moyen (XOF)"), "6000");

    await user.click(screen.getByRole("button", { name: /Enregistrer/i }));

    await waitFor(() => expect(lastMethod).toBe("POST"));
    expect(lastBody).toEqual({
      key: "melange-maison",
      value: {
        label: "Mélange Maison",
        subcategory: "FEED",
        unit: "sac",
        typical_unit_price_xof: 6000,
      },
    });
  });
});
```

- [ ] **Step 3: Lancer — échoue (composant absent)**

Run: `cd web && npx vitest run src/components/inventory/ArticleDialog.test.tsx`
Expected: FAIL — impossible de résoudre `./ArticleDialog`.

- [ ] **Step 4: Créer `ArticleDialog.tsx`**

Create `web/src/components/inventory/ArticleDialog.tsx` :

```tsx
"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";
import type { InventoryCatalogItem } from "@/types";
import {
  useCreateArticleMutation,
  useUpdateArticleMutation,
} from "@/store/api/inventoryCatalogApi";
import { INVENTORY_SUBCATEGORY_LABELS } from "@/lib/inventory";
import { slugify } from "@/lib/slug";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";

const schema = z.object({
  label: z.string().min(1, "Ce champ est requis"),
  subcategory: z.enum(["FEED", "CONSUMABLE", "EQUIPMENT", "PRODUCT"]),
  unit: z.string().optional(),
  price: z.string().regex(/^\d*$/, "Montant entier").optional().or(z.literal("")),
});
type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  farmId: number;
  /** When set, the dialog edits this custom article (key is fixed). */
  article?: InventoryCatalogItem;
}

export function ArticleDialog({ open, onClose, farmId, article }: Props) {
  const { showToast } = useToast();
  const [createArticle, { isLoading: creating }] = useCreateArticleMutation();
  const [updateArticle, { isLoading: updating }] = useUpdateArticleMutation();
  const isEdit = article != null;

  const { control, handleSubmit, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { label: "", subcategory: "FEED", unit: "", price: "" },
  });

  // Edge-trigger reset on open (fresh fields per opening; prefilled in edit mode).
  useEffect(() => {
    if (open) {
      reset({
        label: article?.label ?? "",
        subcategory: (article?.subcategory as FormValues["subcategory"]) ?? "FEED",
        unit: article?.unit ?? "",
        price: article?.typicalUnitPriceXof != null ? String(article.typicalUnitPriceXof) : "",
      });
    }
  }, [open, article, reset]);

  const onSubmit = async (values: FormValues) => {
    const value: Record<string, unknown> = {
      label: values.label,
      subcategory: values.subcategory,
    };
    if (values.unit) value.unit = values.unit;
    if (values.price) value.typical_unit_price_xof = Number(values.price);
    const key = isEdit ? article!.articleKey : slugify(values.label);
    try {
      if (isEdit) await updateArticle({ farmId, key, value }).unwrap();
      else await createArticle({ farmId, key, value }).unwrap();
      showToast(isEdit ? "Article modifié" : "Article créé", "success");
      onClose();
    } catch (e) {
      showToast(apiErrorMessage(e), "error");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{isEdit ? "Modifier l'article" : "Nouvel article"}</DialogTitle>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Controller
              name="label"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Libellé"
                  fullWidth
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
            <Controller
              name="subcategory"
              control={control}
              render={({ field }) => (
                <TextField {...field} select label="Sous-catégorie" fullWidth>
                  {Object.entries(INVENTORY_SUBCATEGORY_LABELS).map(([value, label]) => (
                    <MenuItem key={value} value={value}>
                      {label}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
            <Controller
              name="unit"
              control={control}
              render={({ field }) => (
                <TextField {...field} label="Unité" placeholder="kg, sac, unité…" fullWidth />
              )}
            />
            <Controller
              name="price"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Prix moyen (XOF)"
                  fullWidth
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Annuler</Button>
          <Button type="submit" variant="contained" disabled={creating || updating}>
            Enregistrer
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
```

- [ ] **Step 5: Lancer — passe**

Run: `cd web && npx vitest run src/components/inventory/ArticleDialog.test.tsx`
Expected: PASS.

- [ ] **Step 6: Lint + commit**

```bash
cd web && npm run lint
git add web/src/lib/inventory.ts web/src/components/inventory/ArticleDialog.tsx web/src/components/inventory/ArticleDialog.test.tsx
git commit -m "feat(web): ArticleDialog to create/edit a custom inventory article"
```

---

## Task 4 : Frontend — brancher la page Bibliothèque

**Files:**
- Modify: `web/src/app/(dashboard)/stocks/articles/page.tsx`
- Test: `web/src/app/(dashboard)/stocks/articles/page.test.tsx` (create)

**Interfaces:**
- Consumes: `ArticleDialog` (Task 3) ; `useDeleteArticleMutation` (Task 2) ; `useFarmRole`/`canManageCatalog` ; `InventoryCatalogItem.custom` (Task 1/2).

- [ ] **Step 1: Écrire le test de page (échoue d'abord)**

Create `web/src/app/(dashboard)/stocks/articles/page.test.tsx`. Il mocke `useFarmRole` (OWNER) + `useInventoryGating` (farm active), stub `/articles` avec un article plateforme (`custom:false`) + un custom (`custom:true`), et vérifie : bouton « Nouvel article » activé, puce « Perso » sur la ligne custom, action Supprimer présente sur custom et absente sur plateforme.

```tsx
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import ArticleLibraryPage from "./page";

vi.mock("@/hooks/useInventoryGating", () => ({
  useInventoryGating: () => ({ farmId: 1, hasFarm: true, hasInventory: true }),
}));
vi.mock("@/hooks/useFarmRole", async (orig) => ({
  ...(await orig<typeof import("@/hooks/useFarmRole")>()),
  useFarmRole: () => "OWNER",
}));

function respond(data: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify({ data }), { status: 200, headers: { "Content-Type": "application/json" } }),
  );
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/inventory/catalog/articles")) {
        return respond([
          { articleKey: "feed_layer", articleSource: "INVENTORY", label: "Ponte", subcategory: "FEED", unit: "kg", typicalUnitPriceXof: 440, custom: false },
          { articleKey: "melange-maison", articleSource: "INVENTORY", label: "Mélange maison", subcategory: "FEED", unit: "sac", typicalUnitPriceXof: null, custom: true },
        ]);
      }
      return respond(null);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("ArticleLibraryPage", () => {
  it("enables create for OWNER and shows edit/delete only on custom rows", async () => {
    renderWithProviders(<ArticleLibraryPage />);

    expect(await screen.findByText("Mélange maison")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Nouvel article/i })).toBeEnabled();

    // Custom row: "Perso" chip + a delete action.
    const customRow = screen.getByText("Mélange maison").closest("tr")!;
    expect(within(customRow).getByText("Perso")).toBeInTheDocument();
    expect(within(customRow).getByRole("button", { name: /Supprimer/i })).toBeInTheDocument();

    // Platform row: no delete action.
    const platformRow = screen.getByText("Ponte").closest("tr")!;
    expect(within(platformRow).queryByRole("button", { name: /Supprimer/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Lancer — échoue (bouton disabled, pas d'actions)**

Run: `cd web && npx vitest run "src/app/(dashboard)/stocks/articles/page.test.tsx"`
Expected: FAIL.

- [ ] **Step 3: Brancher la page**

Dans `web/src/app/(dashboard)/stocks/articles/page.tsx` :

Ajouter les imports :

```tsx
import { IconButton, Dialog as ConfirmDialog, DialogTitle as ConfirmTitle, DialogContent as ConfirmContent, DialogActions as ConfirmActions } from "@mui/material";
import { Pencil, Trash2 } from "lucide-react";
import { ArticleDialog } from "@/components/inventory/ArticleDialog";
import { useDeleteArticleMutation } from "@/store/api/inventoryCatalogApi";
import { useFarmRole, canManageCatalog } from "@/hooks/useFarmRole";
import type { InventoryCatalogItem } from "@/types";
```

> Note : `Button`, `Chip`, etc. sont déjà importés. N'ajoute que ce qui manque (`IconButton`, et les alias Confirm* peuvent réutiliser `Dialog/DialogTitle/DialogContent/DialogActions` déjà importés si présents — sinon importe-les). `useToast`/`apiErrorMessage` pour le feedback de suppression.

Dans le composant, après les hooks existants :

```tsx
  const role = useFarmRole(farmId);
  const canManage = canManageCatalog(role);
  const [deleteArticle] = useDeleteArticleMutation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryCatalogItem | undefined>(undefined);
  const [toDelete, setToDelete] = useState<InventoryCatalogItem | null>(null);

  const openCreate = () => {
    setEditing(undefined);
    setDialogOpen(true);
  };
  const openEdit = (a: InventoryCatalogItem) => {
    setEditing(a);
    setDialogOpen(true);
  };
  const confirmDelete = async () => {
    if (!toDelete || farmId == null) return;
    await deleteArticle({ farmId, key: toDelete.articleKey });
    setToDelete(null);
  };
```

Remplacer le bouton désactivé par un bouton actif gaté :

```tsx
        {canManage && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<Plus size={18} />}
            onClick={openCreate}
          >
            Nouvel article
          </Button>
        )}
```
(Retirer le `<Tooltip>…</Tooltip>` qui l'entourait.)

Ajouter une colonne d'actions dans `<TableHead>` (après « Prix moyen ») :

```tsx
                <TableCell align="right" />
```

Dans la ligne (`<TableRow>` du `filtered.map`), après la cellule prix, ajouter la cellule actions ; et rendre la puce « Perso » à côté du libellé :

```tsx
                  <TableCell align="right">
                    {a.custom && canManage && (
                      <>
                        <IconButton size="small" aria-label="Modifier" onClick={() => openEdit(a)}>
                          <Pencil size={16} />
                        </IconButton>
                        <IconButton size="small" aria-label="Supprimer" onClick={() => setToDelete(a)}>
                          <Trash2 size={16} />
                        </IconButton>
                      </>
                    )}
                  </TableCell>
```

Et dans la cellule « Référence » (le libellé), ajouter la puce si custom :

```tsx
                  <TableCell sx={{ fontWeight: 600 }}>
                    {a.label}
                    {a.custom && (
                      <Chip label="Perso" size="small" color="primary" variant="outlined" sx={{ ml: 1 }} />
                    )}
                  </TableCell>
```

Enfin, avant la fermeture du composant (`</Box>`), monter le dialog + la confirmation :

```tsx
      {farmId != null && (
        <ArticleDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          farmId={farmId}
          article={editing}
        />
      )}
      <Dialog open={toDelete != null} onClose={() => setToDelete(null)}>
        <DialogTitle>Supprimer l&apos;article ?</DialogTitle>
        <DialogContent>Supprimer « {toDelete?.label} » de la bibliothèque ?</DialogContent>
        <DialogActions>
          <Button onClick={() => setToDelete(null)}>Annuler</Button>
          <Button color="error" variant="contained" onClick={confirmDelete}>
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>
```

> `Dialog`, `DialogTitle`, `DialogContent`, `DialogActions` : les importer depuis `@mui/material` s'ils ne le sont pas déjà (ne pas utiliser les alias Confirm* — c'était indicatif). `farmId` est un `number` issu de `useInventoryGating`.

- [ ] **Step 4: Lancer le test de page — passe**

Run: `cd web && npx vitest run "src/app/(dashboard)/stocks/articles/page.test.tsx"`
Expected: PASS.

- [ ] **Step 5: Suite ciblée + lint**

Run: `cd web && npx vitest run src/components/inventory/ src/app/\(dashboard\)/stocks/ && npm run lint`
Expected: PASS, 0 erreur lint.

- [ ] **Step 6: Commit**

```bash
git add "web/src/app/(dashboard)/stocks/articles/page.tsx" "web/src/app/(dashboard)/stocks/articles/page.test.tsx"
git commit -m "feat(web): create/edit/delete custom articles on the Bibliothèque page"
```

---

## Self-Review (rempli à l'écriture)

**1. Spec coverage :**
- Flag `custom` + lecture `listForFarm` (customs remontent) → Task 1. ✅
- Endpoint create/edit/delete réutilisé (mutations front) → Task 2. ✅
- `ArticleDialog` (label/sous-catégorie/unité/prix, slug key, edge-trigger reset) → Task 3. ✅
- Page : bouton gaté OWNER/MANAGER, puce « Perso », édition/suppression sur custom, plateforme lecture seule, confirmation → Task 4. ✅
- Source INVENTORY only, value keys `{label,subcategory,unit,typical_unit_price_xof}` → Tasks 1/3. ✅
- Hors périmètre respecté (pas de TREATMENT custom, pas d'édition plateforme). ✅

**2. Placeholder scan :** aucun TODO/TBD ; code complet.

**3. Type consistency :** `InventoryCatalogItemDto(...,custom)` cohérent (Task 1) ↔ `InventoryCatalogItem.custom` (Task 2) ↔ usage page (Task 4). Mutations `create/update/deleteArticle({farmId,key,value})` cohérentes (Task 2) ↔ `ArticleDialog` (Task 3) ↔ page delete (Task 4). Value keys snake_case (`typical_unit_price_xof`) cohérentes backend (Task 1 `intg`) ↔ dialog (Task 3).
