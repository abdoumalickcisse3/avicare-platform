# Vente des poulets de chair au poids — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a broiler sale line be priced by total live weight (heads pesés ensemble × prix au
kg) as an alternative to the existing per-head flat price, chosen per line, on both web and
mobile.

**Architecture:** Add one nullable `weightKg` field end-to-end (DB column → JPA entity → command
→ request/response DTOs → UI). When present on a `PRODUCTION`/`BROILER` line, `SaleService`
prices the line as `weightKg × unitPriceXof` instead of `quantity × unitPriceXof`; `quantity`
(heads) keeps decrementing the batch's `currentCount` exactly as today, unchanged. No new
backend read endpoint: the web/mobile weight suggestion reuses the existing
`GET .../performance` endpoint (`GrowthPerformance.currentWeightG`).

**Tech Stack:** Spring Boot 3 / JPA / Flyway (backend), Next.js + MUI + RTK Query (web), Expo /
React Native + RTK Query (mobile).

**Spec:** `docs/superpowers/specs/2026-09-23-broiler-sale-by-weight-design.md`

## Global Constraints

- Both pricing modes must coexist — a cart can mix a per-head line and a per-weight line.
- `quantity` (heads) always decrements/restocks `ProductionUnit.currentCount`; `weightKg` never
  drives stock, only price.
- Web feature implies mobile (project-wide rule) — every task below ships on both.
- No signature/mention of Claude in commit messages (project rule).
- Français dans l'UI ; noms de champs techniques en anglais (`weightKg`), comme le reste du code.

---

### Task 1: Colonne `weight_kg` sur `sale_items` + entité `SaleItem`

**Files:**
- Create: `backend/avicare-app/src/main/resources/db/migration/V59__sale_item_weight.sql`
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/domain/SaleItem.java`

**Interfaces:**
- Produces: `SaleItem.getWeightKg()`/`setWeightKg(BigDecimal)` — consommé par Task 3.

- [ ] **Step 1: Write the migration**

```sql
-- Poulets de chair vendus au poids (lot pesé ensemble) plutôt qu'à la tête à prix fixe (retour
-- éleveur pilote, 2026-09-23). NULL = ligne à la tête, comportement inchangé. Renseigné = le
-- prix de la ligne se calcule sur le poids, pas sur `quantity` (qui reste le nombre de têtes,
-- toujours utilisé pour décrémenter le stock du lot).
ALTER TABLE sale_items ADD COLUMN weight_kg NUMERIC(10,2) NULL;
```

- [ ] **Step 2: Add the field to the entity**

In `SaleItem.java`, add after `quantity`:

```java
  /**
   * Total live weight sold, in kg — set only for a BROILER line priced by weight (poids pesé du
   * lot vendu, pas un poids par tête). NULL = ligne à la tête, prix = quantity × unitPriceXof.
   * When set, {@code lineTotalXof = weightKg × unitPriceXof} and {@code quantity} still tracks
   * the number of heads sold (used to decrement stock), never the weight.
   */
  @Column(name = "weight_kg")
  private BigDecimal weightKg;
```

- [ ] **Step 3: Compile and confirm no regression**

Run: `cd backend && ./mvnw -pl avicare-app -am compile test-compile`
Expected: BUILD SUCCESS (Lombok generates the getter/setter; no other file references the new
field yet, so nothing else can break).

- [ ] **Step 4: Commit**

```bash
git add backend/avicare-app/src/main/resources/db/migration/V59__sale_item_weight.sql \
        backend/avicare-app/src/main/java/com/avicare/livestock/domain/SaleItem.java
git commit -m "feat(commercial): ajouter weight_kg sur sale_items"
```

---

### Task 2: `SaleCommand` / `SaleRequest` / `SaleResponse` — porter `weightKg` de bout en bout

**Files:**
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/commercial/SaleCommand.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/commercial/dto/SaleRequest.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/commercial/dto/SaleResponse.java`

**Interfaces:**
- Consumes: `SaleItem.getWeightKg()` (Task 1).
- Produces: `SaleCommand.Line.weightKg()`, `SaleRequest.LineRequest.weightKg`,
  `SaleResponse.Line.weightKg` — consommés par Task 3 (service) et les clients web/mobile.

`SaleCommand.Line` a 14 sites d'appel positionnels dans le code (tests dans
`SaleServiceTest`, `SaleServiceIT`, `CommercialProductionIT`, `CommercialActivityIT`,
`ActivityControllerIT`, `PaymentServiceIT`, `InvoiceServiceIT`, `CommercialRevenueQueriesIT`,
plus `SaleRequest.toCommandLine()`). Pour n'en casser aucun, on ajoute `weightKg` comme **8ᵉ
composant du record** et on garde l'ancien constructeur à 7 arguments comme surcharge —
compatible à la compilation avec tous les appels existants sans y toucher.

- [ ] **Step 1: `SaleCommand.Line` — nouveau champ + constructeur de compatibilité**

```java
  public record Line(
      String articleKey,
      ArticleSource articleSource,
      BigDecimal quantity,
      Integer unitPriceXof,
      String notes,
      Long productionUnitId,
      ProductType productType,
      BigDecimal weightKg) {

    /** Compatibilité : tous les appels existants (à la tête) omettent le poids. */
    public Line(
        String articleKey,
        ArticleSource articleSource,
        BigDecimal quantity,
        Integer unitPriceXof,
        String notes,
        Long productionUnitId,
        ProductType productType) {
      this(articleKey, articleSource, quantity, unitPriceXof, notes, productionUnitId, productType, null);
    }
  }
```

- [ ] **Step 2: `SaleRequest.LineRequest` — champ optionnel + mapping**

```java
  @Schema(name = "SaleLineRequest")
  public record LineRequest(
      @NotBlank @Size(max = 80) String articleKey,
      @NotNull ArticleSource articleSource,
      @NotNull @Positive BigDecimal quantity,
      @NotNull @PositiveOrZero Integer unitPriceXof,
      @Size(max = 500) String notes,
      Long productionUnitId,
      ProductType productType,
      @Positive BigDecimal weightKg) {

    SaleCommand.Line toCommandLine() {
      return new SaleCommand.Line(
          articleKey,
          articleSource,
          quantity,
          unitPriceXof,
          notes,
          productionUnitId,
          productType,
          weightKg);
    }
  }
```

`@Positive` sur un champ nullable ne s'applique que si une valeur est fournie (Bean Validation
ignore les champs `null`) — donc `weightKg` reste optionnel mais un `0` ou un négatif explicite
est rejeté avant même d'atteindre le service.

- [ ] **Step 3: `SaleResponse.Line` — renvoyer le poids au client**

```java
  @Schema(name = "SaleLine")
  public record Line(
      Long id,
      String articleKey,
      ArticleSource articleSource,
      String articleLabelSnapshot,
      String unit,
      BigDecimal quantity,
      Integer unitPriceXof,
      Long lineTotalXof,
      String notes,
      BigDecimal weightKg) {

    static Line from(SaleItem i) {
      return new Line(
          i.getId(),
          i.getArticleKey(),
          i.getArticleSource(),
          i.getArticleLabelSnapshot(),
          i.getUnit(),
          i.getQuantity(),
          i.getUnitPriceXof(),
          i.getLineTotalXof(),
          i.getNotes(),
          i.getWeightKg());
    }
  }
```

- [ ] **Step 4: Compile**

Run: `cd backend && ./mvnw -pl avicare-app -am compile test-compile`
Expected: BUILD SUCCESS — aucun des 14 sites d'appel existants de `SaleCommand.Line` ne casse
grâce au constructeur de compatibilité ; `SaleRequest.LineRequest` est peuplé par Jackson depuis
JSON (aucun site d'appel Java direct à mettre à jour).

- [ ] **Step 5: Commit**

```bash
git add backend/avicare-app/src/main/java/com/avicare/livestock/commercial/SaleCommand.java \
        backend/avicare-app/src/main/java/com/avicare/livestock/commercial/dto/SaleRequest.java \
        backend/avicare-app/src/main/java/com/avicare/livestock/commercial/dto/SaleResponse.java
git commit -m "feat(commercial): porter weightKg dans les DTOs de vente"
```

---

### Task 3: `SaleService` — calcul du prix au poids + validations (TDD)

**Files:**
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/commercial/SaleService.java`
- Modify: `backend/avicare-app/src/test/java/com/avicare/livestock/commercial/SaleServiceTest.java`

**Interfaces:**
- Consumes: `SaleCommand.Line.weightKg()` (Task 2).
- Produces: `SaleItem.unit == "kg"` et `lineTotalXof = round(weightKg × unitPriceXof)` quand
  `weightKg` est renseigné sur une ligne BROILER ; sinon comportement actuel inchangé.

Règle de validation : `weightKg` n'est autorisé que sur une ligne `PRODUCTION` de type
`BROILER` — sur toute autre ligne (œufs, inventaire, traitement), c'est une erreur métier
(422), pas une erreur de saisie silencieusement ignorée.

- [ ] **Step 1: Write the failing tests**

Dans `SaleServiceTest.java`, ajouter un helper à côté de `line()` et les tests suivants :

```java
  private static SaleCommand.Line broilerLine(
      Long unitId, String heads, int unitPriceXof, BigDecimal weightKg) {
    return new SaleCommand.Line(
        "BROILER",
        ArticleSource.PRODUCTION,
        new BigDecimal(heads),
        unitPriceXof,
        null,
        unitId,
        com.avicare.livestock.api.ProductType.BROILER,
        weightKg);
  }
```

```java
  @Test
  void create_broilerLineWithWeightKg_pricesByWeightNotHeads() {
    when(saleRepository.findMaxSequence(eq(7L), any())).thenReturn(0);
    SaleCommand cmd =
        new SaleCommand(
            null,
            null,
            "CASH",
            null,
            null,
            List.of(broilerLine(9L, "20", 1500, new BigDecimal("30.50"))));

    Sale sale = service.create(7L, cmd, 42L);

    SaleItem item = sale.getItems().get(0);
    assertThat(item.getQuantity()).isEqualByComparingTo("20");
    assertThat(item.getWeightKg()).isEqualByComparingTo("30.50");
    assertThat(item.getUnit()).isEqualTo("kg");
    // 30.50 * 1500 = 45 750 (pas 20 * 1500 = 30 000)
    assertThat(item.getLineTotalXof()).isEqualTo(45_750L);
    verify(livestockFacade).consumeProduction(7L, com.avicare.livestock.api.ProductType.BROILER, 9L, 20L);
  }

  @Test
  void create_broilerLineWithoutWeightKg_stillPricesByHeads() {
    when(saleRepository.findMaxSequence(eq(7L), any())).thenReturn(0);
    SaleCommand cmd =
        new SaleCommand(
            null, null, "CASH", null, null, List.of(broilerLine(9L, "20", 1500, null)));

    Sale sale = service.create(7L, cmd, 42L);

    SaleItem item = sale.getItems().get(0);
    assertThat(item.getUnit()).isEqualTo("tête");
    assertThat(item.getLineTotalXof()).isEqualTo(30_000L);
  }

  @Test
  void create_weightKgOnEggsLineThrowsBusinessRule() {
    SaleCommand.Line eggsWithWeight =
        new SaleCommand.Line(
            "EGGS",
            ArticleSource.PRODUCTION,
            BigDecimal.ONE,
            2000,
            null,
            null,
            com.avicare.livestock.api.ProductType.EGGS,
            new BigDecimal("1.5"));
    SaleCommand cmd = new SaleCommand(null, null, null, null, null, List.of(eggsWithWeight));

    assertThatExceptionOfType(BusinessRuleException.class)
        .isThrownBy(() -> service.create(7L, cmd, 42L));
  }

  @Test
  void create_nonPositiveWeightKgThrowsValidation() {
    SaleCommand cmd =
        new SaleCommand(
            null, null, null, null, null, List.of(broilerLine(9L, "20", 1500, BigDecimal.ZERO)));

    assertThatExceptionOfType(ValidationException.class)
        .isThrownBy(() -> service.create(7L, cmd, 42L));
  }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && ./mvnw -pl avicare-app test -Dtest=SaleServiceTest`
Expected: FAIL — `getWeightKg()`/nouveau constructeur compilent (Tasks 1-2 faits), mais
`create_broilerLineWithWeightKg_pricesByWeightNotHeads` échoue sur l'assertion du total (calcul
encore basé sur `quantity`), et les deux tests de validation échouent car rien ne rejette
`weightKg` hors contexte BROILER.

- [ ] **Step 3: Implement**

Dans `SaleService.applyLines()`, remplacer le bloc PRODUCTION :

```java
      if (line.articleSource() == ArticleSource.PRODUCTION) {
        validateProductionLine(line);
        item.setArticleKey(line.articleKey());
        item.setArticleSource(ArticleSource.PRODUCTION);
        item.setArticleLabelSnapshot(productionLabelFor(line.productType()));
        item.setUnit(line.weightKg() != null ? "kg" : productionUnitFor(line.productType()));
        item.setProductionUnitId(line.productionUnitId());
        item.setProductType(line.productType());
        item.setWeightKg(line.weightKg());
      } else {
```

Remplacer l'appel `lineTotal(line.quantity(), line.unitPriceXof())` par
`lineTotal(line.quantity(), line.unitPriceXof(), line.weightKg())`, et la méthode elle-même :

```java
  private static long lineTotal(BigDecimal quantity, Integer unitPriceXof, BigDecimal weightKg) {
    BigDecimal base = weightKg != null ? weightKg : quantity;
    return base.multiply(BigDecimal.valueOf(unitPriceXof))
        .setScale(0, RoundingMode.HALF_UP)
        .longValueExact();
  }
```

Ajouter la validation dans `validateProductionLine()` :

```java
    if (line.weightKg() != null) {
      if (line.productType() != ProductType.BROILER) {
        throw new BusinessRuleException(
            "PRODUCTION_LINE_WEIGHT_NOT_ALLOWED",
            "weightKg is only allowed for BROILER lines");
      }
      if (line.weightKg().signum() <= 0) {
        throw new ValidationException("SALE_LINE_WEIGHT", "weightKg must be greater than 0");
      }
    }
```

(Note : `validateProductionLine` est appelée avant que `productType()` puisse être `null` sans
avoir déjà levé `PRODUCTION_LINE_TYPE_REQUIRED` juste au-dessus — l'ordre des vérifications
existantes protège déjà contre un NPE ici.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && ./mvnw -pl avicare-app test -Dtest=SaleServiceTest`
Expected: PASS — tous les tests existants + les 4 nouveaux.

- [ ] **Step 5: Commit**

```bash
git add backend/avicare-app/src/main/java/com/avicare/livestock/commercial/SaleService.java \
        backend/avicare-app/src/test/java/com/avicare/livestock/commercial/SaleServiceTest.java
git commit -m "feat(commercial): prix au kilo pour une ligne de vente poulets de chair"
```

---

### Task 4: Preuve d'intégration — persistance réelle + décompte têtes inchangé

**Files:**
- Modify: `backend/avicare-app/src/test/java/com/avicare/livestock/commercial/CommercialProductionIT.java`

**Interfaces:**
- Consumes: le flux complet Task 1-3, sur une vraie base Postgres (Testcontainers).

- [ ] **Step 1: Write the failing test**

Ajouter à côté de `broilerLine(...)` :

```java
  private static SaleCommand.Line broilerLineByWeight(
      Long unitId, int heads, int price, java.math.BigDecimal weightKg) {
    return new SaleCommand.Line(
        "BROILER", ArticleSource.PRODUCTION, BigDecimal.valueOf(heads), price, null, unitId,
        ProductType.BROILER, weightKg);
  }
```

Et le test :

```java
  @Test
  void saleDirectBroilerByWeight_pricesByWeightAndDecrementsHeadsOnly() throws Exception {
    FarmContext ctx = createFarm("broilerweight." + System.nanoTime() + "@prod.io");
    Long unitId = createBatch(ctx.farmId(), ctx.userId(), 100);

    Sale sale =
        saleService.create(
            ctx.farmId(),
            new SaleCommand(
                null,
                null,
                "CASH",
                null,
                null,
                List.of(broilerLineByWeight(unitId, 20, 1500, new java.math.BigDecimal("30.50")))),
            ctx.userId());

    // Têtes décomptées, jamais le poids.
    assertThat(productionUnitRepository.findById(unitId).orElseThrow().getCurrentCount())
        .isEqualTo(80);
    // Prix = poids × PU, pas têtes × PU.
    assertThat(sale.getTotalXof()).isEqualTo(45_750L);

    // Le poids a bien été persisté (pas seulement calculé en mémoire).
    Sale reloaded = saleService.getById(ctx.farmId(), sale.getId());
    assertThat(reloaded.getItems().get(0).getWeightKg()).isEqualByComparingTo("30.50");
  }
```

- [ ] **Step 2: Run to verify it fails without Docker, and passes in CI**

Run local (attendu) : `cd backend && ./mvnw -pl avicare-app test -Dtest=CommercialProductionIT`
Expected: erreur Testcontainers/Docker (connu, cf. mémoire projet — cette machine ne peut pas
lancer Testcontainers). Ce test est validé par la CI GitHub Actions, pas en local.

- [ ] **Step 3: Push and confirm green in CI**

La CI (`Backend build`) doit passer avec ce nouveau test inclus — c'est la seule preuve
disponible avant merge que la colonne `weight_kg` se persiste et se relit correctement à
travers une vraie transaction Postgres.

- [ ] **Step 4: Commit**

```bash
git add backend/avicare-app/src/test/java/com/avicare/livestock/commercial/CommercialProductionIT.java
git commit -m "test(commercial): vente au poids — persistance et décompte têtes"
```

---

### Task 5: Web — types + RTK Query (contrat + suggestion de poids)

**Files:**
- Modify: `web/src/types/index.ts`
- Modify: `web/src/store/api/poultryBatchesApi.ts`

**Interfaces:**
- Produces: `SaleLineInput.weightKg?`, `SaleItem.weightKg`, `useLazyGetPerformanceQuery` —
  consommés par Task 6.

- [ ] **Step 1: Types**

Dans `web/src/types/index.ts`, sur `SaleLineInput` (ligne ~1047) et `SaleItem` (ligne ~1020) :

```ts
export interface SaleLineInput {
  articleKey: string;
  articleSource: ArticleSource;
  quantity: number;
  unitPriceXof: number;
  productType?: ProductType;
  productionUnitId?: number;
  notes?: string;
  /** Poulet de chair vendu au poids (lot pesé) plutôt qu'à la tête à prix fixe. */
  weightKg?: number;
}

export interface SaleItem {
  id: number;
  articleKey: string;
  articleSource: ArticleSource;
  articleLabelSnapshot: string | null;
  unit: string;
  quantity: number;
  unitPriceXof: number;
  lineTotalXof: number;
  notes: string | null;
  weightKg: number | null;
}
```

- [ ] **Step 2: Exporter le hook lazy de performance**

Dans `web/src/store/api/poultryBatchesApi.ts`, ajouter `useLazyGetPerformanceQuery` à
l'export final (RTK Query le génère déjà, il manque juste à l'export) :

```ts
export const {
  useGetBatchesQuery,
  useGetBatchQuery,
  useCreateBatchMutation,
  useGetDailyRecordsQuery,
  useCreateDailyRecordMutation,
  useGetWeighingsQuery,
  useCreateWeighingMutation,
  useGetPerformanceQuery,
  useLazyGetPerformanceQuery,
} = poultryBatchesApi;
```

- [ ] **Step 3: Type-check**

Run: `cd web && npx tsc --noEmit`
Expected: aucune nouvelle erreur (les deux interfaces gagnent des champs optionnels/étendus,
aucun site d'appel existant n'est cassé).

- [ ] **Step 4: Commit**

```bash
git add web/src/types/index.ts web/src/store/api/poultryBatchesApi.ts
git commit -m "feat(web): contrat weightKg + hook lazy de performance pour la vente au poids"
```

---

### Task 6: Web — `QuickSaleDialog` : bascule à la tête / au poids

**Files:**
- Modify: `web/src/components/commercial/QuickSaleDialog.tsx`
- Modify: `web/src/components/commercial/QuickSaleDialog.test.tsx`

**Interfaces:**
- Consumes: `useLazyGetPerformanceQuery`, `SaleLineInput.weightKg` (Task 5).

- [ ] **Step 1: Write the failing test**

Dans `QuickSaleDialog.test.tsx`, ajouter une réponse `performance` au mock fetch et un test :

```tsx
const PERFORMANCE = {
  poultryBatchId: 42,
  snapshotDate: "2026-09-20",
  ageDays: 30,
  currentWeightG: 1800,
  gmqGPerDay: 60,
  feedConversionRatio: 1.8,
  cumulativeMortalityPercent: 2,
  cumulativeFeedKg: 90,
  cumulativeWaterL: 144,
  forecastedTargetDate: null,
  performanceScore: "ON_TARGET",
};
```

Dans `setupFetch()`, ajouter la route :

```ts
      if (url.includes("/performance")) return respond(PERFORMANCE);
```

Nouveau test :

```tsx
  it("bascule une ligne chair en mode au poids et pré-remplit le poids suggéré", async () => {
    const user = userEvent.setup();
    setup();

    const lotCard = await screen.findByText("50 têtes restantes");
    await user.click(lotCard.closest("[role='button']") as HTMLElement);

    await user.click(await screen.findByRole("button", { name: "Au poids" }));

    // 1 tête (quantité par défaut) × 1800 g / 1000 = 1.8 kg suggéré.
    const weightInput = await screen.findByLabelText("Poids total (kg)");
    expect(weightInput).toHaveValue(1.8);
    expect(screen.getByLabelText(/Prix au kg/)).toBeInTheDocument();
  });

  it("envoie weightKg et un prix au kilo, pas le calcul à la tête", async () => {
    const user = userEvent.setup();
    setup();

    const lotCard = await screen.findByText("50 têtes restantes");
    await user.click(lotCard.closest("[role='button']") as HTMLElement);
    await user.click(await screen.findByRole("button", { name: "Au poids" }));

    const weightInput = await screen.findByLabelText("Poids total (kg)");
    fireEvent.change(weightInput, { target: { value: "30.5" } });
    fireEvent.change(screen.getByLabelText(/Prix au kg/), { target: { value: "1500" } });

    await user.click(screen.getByRole("button", { name: /Valider la vente/i }));

    await waitFor(() => expect(lastMethod).toBe("POST"));
    expect(lastBody?.lines).toEqual([
      expect.objectContaining({ quantity: 1, unitPriceXof: 1500, weightKg: 30.5 }),
    ]);
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd web && npx vitest run src/components/commercial/QuickSaleDialog.test.tsx`
Expected: FAIL — aucun bouton « Au poids » n'existe encore.

- [ ] **Step 3: Implement**

Dans `QuickSaleDialog.tsx` :

```tsx
import { useLazyGetPerformanceQuery } from "@/store/api/poultryBatchesApi";

interface Line {
  key: string;
  articleKey: string;
  articleSource: ArticleSource;
  productType?: ProductType;
  productionUnitId?: number;
  label: string;
  unit: string;
  quantity: number;
  unitPriceXof: number;
  max?: number;
  /** Ligne chair uniquement : bascule le calcul du prix sur le poids plutôt que sur les têtes. */
  pricingMode?: "HEAD" | "WEIGHT";
  weightKg?: number;
}
```

```tsx
  const [fetchPerformance] = useLazyGetPerformanceQuery();
  const [weighingHintByUnitId, setWeighingHintByUnitId] = useState<
    Record<number, { currentWeightG: number | null; snapshotDate: string | null }>
  >({});

  const setPricingMode = async (lineKey: string, mode: "HEAD" | "WEIGHT", unitId?: number) => {
    if (mode === "HEAD") {
      setLines((cur) =>
        cur.map((l) => (l.key === lineKey ? { ...l, pricingMode: "HEAD", weightKg: undefined } : l)),
      );
      return;
    }
    let hint = unitId != null ? weighingHintByUnitId[unitId] : undefined;
    if (unitId != null && !hint) {
      try {
        const perf = await fetchPerformance({ farmId, batchId: unitId }).unwrap();
        hint = { currentWeightG: perf.currentWeightG, snapshotDate: perf.snapshotDate };
      } catch {
        hint = { currentWeightG: null, snapshotDate: null };
      }
      setWeighingHintByUnitId((cur) => ({ ...cur, [unitId]: hint! }));
    }
    setLines((cur) =>
      cur.map((l) => {
        if (l.key !== lineKey) return l;
        const suggested =
          hint?.currentWeightG != null
            ? Math.round((l.quantity * hint.currentWeightG) / 10) / 100
            : undefined;
        return { ...l, pricingMode: "WEIGHT", weightKg: l.weightKg ?? suggested };
      }),
    );
  };

  const setWeight = (lineKey: string, weightKg: number) =>
    setLines((cur) => cur.map((l) => (l.key === lineKey ? { ...l, weightKg } : l)));
```

Total et payload — remplacer les deux usages de `l.quantity * l.unitPriceXof` :

```tsx
  const lineAmount = (l: Line) =>
    l.pricingMode === "WEIGHT" && l.weightKg != null
      ? l.weightKg * l.unitPriceXof
      : l.quantity * l.unitPriceXof;

  const total = lines.reduce((s, l) => s + lineAmount(l), 0);
```

```tsx
          lines: lines.map((l) => ({
            articleKey: l.articleKey,
            articleSource: l.articleSource,
            quantity: l.quantity,
            unitPriceXof: l.unitPriceXof,
            ...(l.pricingMode === "WEIGHT" && l.weightKg != null ? { weightKg: l.weightKg } : {}),
            ...(l.articleSource === "PRODUCTION"
              ? { productType: l.productType, productionUnitId: l.productionUnitId }
              : {}),
          })),
```

Et le rendu de chaque ligne panier — juste avant le bloc `<TextField ... label="PU" .../>`,
pour les lignes chair :

```tsx
                  {l.productType === "BROILER" && (
                    <Stack direction="row" spacing={0.5}>
                      <Button
                        size="small"
                        variant={l.pricingMode !== "WEIGHT" ? "contained" : "outlined"}
                        onClick={() => setPricingMode(l.key, "HEAD")}
                      >
                        À la tête
                      </Button>
                      <Button
                        size="small"
                        variant={l.pricingMode === "WEIGHT" ? "contained" : "outlined"}
                        onClick={() => setPricingMode(l.key, "WEIGHT", l.productionUnitId)}
                      >
                        Au poids
                      </Button>
                    </Stack>
                  )}
                  {l.pricingMode === "WEIGHT" && (
                    <Box>
                      <TextField
                        label="Poids total (kg)"
                        type="number"
                        value={l.weightKg ?? ""}
                        onChange={(e) => setWeight(l.key, Number(e.target.value) || 0)}
                        size="small"
                        sx={{ width: 120 }}
                      />
                      {weighingHintByUnitId[l.productionUnitId ?? -1]?.currentWeightG != null ? (
                        <Typography variant="caption" sx={{ color: colors.neutral[500], display: "block" }}>
                          Estimé d'après la pesée du{" "}
                          {weighingHintByUnitId[l.productionUnitId ?? -1]?.snapshotDate}
                        </Typography>
                      ) : (
                        <Typography variant="caption" sx={{ color: colors.neutral[500], display: "block" }}>
                          Aucune pesée enregistrée — saisissez le poids réel.
                        </Typography>
                      )}
                    </Box>
                  )}
```

Et relabelliser le champ prix pour une ligne au poids :

```tsx
                  <TextField
                    value={l.unitPriceXof}
                    onChange={(e) =>
                      setPrice(l.key, Number(e.target.value.replace(/[^0-9]/g, "")) || 0)
                    }
                    size="small"
                    label={l.pricingMode === "WEIGHT" ? "Prix au kg" : "PU"}
                    sx={{ width: 96, "& input": { ...mono } }}
                    inputMode="numeric"
                  />
                  <Typography sx={{ ...mono, width: 96, textAlign: "right", fontWeight: 600 }}>
                    {formatCurrency(lineAmount(l))}
                  </Typography>
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd web && npx vitest run src/components/commercial/QuickSaleDialog.test.tsx`
Expected: PASS — tous les tests existants + les 2 nouveaux.

- [ ] **Step 5: Type-check et suite complète**

Run: `cd web && npx tsc --noEmit && npx vitest run`
Expected: PASS partout, aucune régression ailleurs.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/commercial/QuickSaleDialog.tsx \
        web/src/components/commercial/QuickSaleDialog.test.tsx
git commit -m "feat(web): vente au poids pour les poulets de chair"
```

---

### Task 7: Mobile — types + RTK Query (parité avec Task 5)

**Files:**
- Modify: `mobile/src/types/index.ts`
- Modify: `mobile/src/store/api/poultryBatchesApi.ts`

**Interfaces:**
- Produces: mêmes contrats que Task 5, côté mobile.

- [ ] **Step 1: Types**

Dans `mobile/src/types/index.ts`, sur `SaleLineInput` et `SaleItem` (mêmes ajouts que Task 5) :

```ts
export interface SaleLineInput {
  articleKey: string;
  articleSource: ArticleSource;
  quantity: number;
  unitPriceXof: number;
  productType?: ProductType;
  productionUnitId?: number;
  notes?: string;
  weightKg?: number;
}

export interface SaleItem {
  id: number;
  articleKey: string;
  articleSource: ArticleSource;
  articleLabelSnapshot: string | null;
  unit: string;
  quantity: number;
  unitPriceXof: number;
  lineTotalXof: number;
  notes: string | null;
  weightKg: number | null;
}
```

Sur `GrowthPerformance` (mobile n'a pas encore `snapshotDate`, présent côté web — écart de
parité pré-existant, corrigé ici puisque ce champ devient nécessaire) :

```ts
export interface GrowthPerformance {
  poultryBatchId: number;
  snapshotDate: string;
  ageDays: number;
  currentWeightG: number | null;
  gmqGPerDay: number | null;
  feedConversionRatio: number | null;
  cumulativeMortalityPercent: number | null;
  cumulativeFeedKg: number | null;
  forecastedTargetDate: string | null;
  performanceScore: PerformanceScore | null;
}
```

- [ ] **Step 2: Exporter le hook lazy de performance**

Dans `mobile/src/store/api/poultryBatchesApi.ts` :

```ts
export const {
  useCreateBatchMutation,
  useGetBatchesQuery,
  useGetBatchQuery,
  useGetPerformanceQuery,
  useLazyGetPerformanceQuery,
  useGetWeighingsQuery,
  useGetDailyRecordsQuery,
} = poultryBatchesApi;
```

- [ ] **Step 3: Type-check**

Run: `cd mobile && npx tsc --noEmit`
Expected: aucune nouvelle erreur.

- [ ] **Step 4: Commit**

```bash
git add mobile/src/types/index.ts mobile/src/store/api/poultryBatchesApi.ts
git commit -m "feat(mobile): contrat weightKg + hook lazy de performance"
```

---

### Task 8: Mobile — `vente.tsx` : bascule à la tête / au poids (parité avec Task 6)

**Files:**
- Modify: `mobile/app/(field)/commerce/vente.tsx`
- Modify: `mobile/app/(field)/commerce/__tests__/vente.test.tsx`

**Interfaces:**
- Consumes: Task 7.

- [ ] **Step 1: Write the failing test**

Dans `vente.test.tsx`, mocker `useLazyGetPerformanceQuery` et ajouter un test :

```tsx
const mockFetchPerformance = jest.fn(() => ({
  unwrap: () =>
    Promise.resolve({
      poultryBatchId: 5,
      snapshotDate: '2026-09-20',
      currentWeightG: 1800,
      ageDays: 30,
      gmqGPerDay: 60,
      feedConversionRatio: 1.8,
      cumulativeMortalityPercent: 2,
      cumulativeFeedKg: 90,
      forecastedTargetDate: null,
      performanceScore: 'ON_TARGET',
    }),
}));
jest.mock('@/store/api/poultryBatchesApi', () => ({
  useLazyGetPerformanceQuery: jest.fn(() => [mockFetchPerformance]),
}));
```

```tsx
  it('bascule en mode au poids, pré-remplit le poids et envoie weightKg', async () => {
    await render(<VenteScreen />);
    await press(screen.getByLabelText('Ajouter Lot A à la vente'));
    await press(screen.getByLabelText('Au poids — Lot A'));

    const weightInput = await screen.findByLabelText('Poids total (kg) — Lot A');
    fireEvent.changeText(weightInput, '30.5');

    await press(screen.getByLabelText('Valider la vente'));

    expect(mockCreateSale).toHaveBeenCalledWith({
      farmId: 7,
      body: expect.objectContaining({
        lines: [expect.objectContaining({ weightKg: 30.5, quantity: 1 })],
      }),
    });
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd mobile && npx jest "app/(field)/commerce/__tests__/vente.test.tsx"`
Expected: FAIL — aucun bouton « Au poids — Lot A » n'existe encore.

- [ ] **Step 3: Implement**

Dans `vente.tsx`, mêmes ajouts d'état/logique que Task 6 (adaptés RN) :

```tsx
import { useLazyGetPerformanceQuery } from '@/store/api/poultryBatchesApi';

interface Line {
  key: string;
  articleKey: string;
  articleSource: ArticleSource;
  productType?: ProductType;
  productionUnitId?: number;
  label: string;
  unit: string;
  quantity: number;
  unitPriceXof: number;
  max?: number;
  pricingMode?: 'HEAD' | 'WEIGHT';
  weightKg?: number;
}
```

```tsx
  const [fetchPerformance] = useLazyGetPerformanceQuery();
  const [weighingHintByUnitId, setWeighingHintByUnitId] = useState<
    Record<number, { currentWeightG: number | null; snapshotDate: string | null }>
  >({});

  const setPricingMode = async (key: string, mode: 'HEAD' | 'WEIGHT', unitId?: number) => {
    if (mode === 'HEAD') {
      setLines((cur) => cur.map((l) => (l.key === key ? { ...l, pricingMode: 'HEAD', weightKg: undefined } : l)));
      return;
    }
    let hint = unitId != null ? weighingHintByUnitId[unitId] : undefined;
    if (unitId != null && !hint) {
      try {
        const perf = await fetchPerformance({ farmId: selectedFarmId, batchId: unitId }).unwrap();
        hint = { currentWeightG: perf.currentWeightG, snapshotDate: perf.snapshotDate };
      } catch {
        hint = { currentWeightG: null, snapshotDate: null };
      }
      setWeighingHintByUnitId((cur) => ({ ...cur, [unitId]: hint! }));
    }
    setLines((cur) =>
      cur.map((l) => {
        if (l.key !== key) return l;
        const suggested =
          hint?.currentWeightG != null ? Math.round((l.quantity * hint.currentWeightG) / 10) / 100 : undefined;
        return { ...l, pricingMode: 'WEIGHT', weightKg: l.weightKg ?? suggested };
      }),
    );
  };

  const setWeight = (key: string, weightKg: number) =>
    setLines((cur) => cur.map((l) => (l.key === key ? { ...l, weightKg } : l)));

  const lineAmount = (l: Line) =>
    l.pricingMode === 'WEIGHT' && l.weightKg != null ? l.weightKg * l.unitPriceXof : l.quantity * l.unitPriceXof;
```

Mettre à jour `total` (ligne ~97) pour utiliser `lineAmount(l)`, et `buildSaleInput` pour inclure
`weightKg` quand présent :

```tsx
export function buildSaleInput(
  lines: Line[],
  clientId: string,
  method: PaymentMethod,
  channel: string,
): SaleInput {
  return {
    clientId: clientId === WALK_IN ? null : Number(clientId),
    paymentMethod: method,
    salesChannelKey: channel || undefined,
    lines: lines.map((l) => ({
      articleKey: l.articleKey,
      articleSource: l.articleSource,
      quantity: l.quantity,
      unitPriceXof: l.unitPriceXof,
      ...(l.pricingMode === 'WEIGHT' && l.weightKg != null ? { weightKg: l.weightKg } : {}),
      ...(l.articleSource === 'PRODUCTION'
        ? { productType: l.productType, productionUnitId: l.productionUnitId }
        : {}),
    })),
  };
}
```

Dans le rendu de chaque ligne panier (juste après `<Text style={styles.cartUnit}>`), pour les
lignes chair :

```tsx
                {l.productType === 'BROILER' && (
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`À la tête — ${l.label}`}
                      onPress={() => setPricingMode(l.key, 'HEAD')}
                      style={[styles.chip, l.pricingMode !== 'WEIGHT' && styles.chipActive]}
                    >
                      <Text style={[styles.chipLabel, l.pricingMode !== 'WEIGHT' && styles.chipLabelActive]}>
                        À la tête
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Au poids — ${l.label}`}
                      onPress={() => setPricingMode(l.key, 'WEIGHT', l.productionUnitId)}
                      style={[styles.chip, l.pricingMode === 'WEIGHT' && styles.chipActive]}
                    >
                      <Text style={[styles.chipLabel, l.pricingMode === 'WEIGHT' && styles.chipLabelActive]}>
                        Au poids
                      </Text>
                    </Pressable>
                  </View>
                )}
                {l.pricingMode === 'WEIGHT' && (
                  <TextInput
                    value={l.weightKg != null ? String(l.weightKg) : ''}
                    onChangeText={(t) => setWeight(l.key, Number(t.replace(/[^0-9.]/g, '')) || 0)}
                    keyboardType="decimal-pad"
                    accessibilityLabel={`Poids total (kg) — ${l.label}`}
                    style={styles.priceInput}
                  />
                )}
```

Et le `TextInput` de prix existant (juste après le stepper de têtes) gagne un
`accessibilityLabel` dynamique — remplacer :

```tsx
                <TextInput
                  value={String(l.unitPriceXof)}
                  onChangeText={(t) => setPrice(l.key, Number(t.replace(/[^0-9]/g, '')) || 0)}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  accessibilityLabel={`Prix unitaire ${l.label}`}
                  style={styles.priceInput}
                />
```

par :

```tsx
                <TextInput
                  value={String(l.unitPriceXof)}
                  onChangeText={(t) => setPrice(l.key, Number(t.replace(/[^0-9]/g, '')) || 0)}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  accessibilityLabel={
                    l.pricingMode === 'WEIGHT' ? `Prix au kg — ${l.label}` : `Prix unitaire ${l.label}`
                  }
                  style={styles.priceInput}
                />
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd mobile && npx jest "app/(field)/commerce/__tests__/vente.test.tsx"`
Expected: PASS.

- [ ] **Step 5: Suite complète mobile**

Run: `cd mobile && npx tsc --noEmit && npx jest`
Expected: PASS partout.

- [ ] **Step 6: Commit**

```bash
git add "mobile/app/(field)/commerce/vente.tsx" \
        "mobile/app/(field)/commerce/__tests__/vente.test.tsx"
git commit -m "feat(mobile): vente au poids pour les poulets de chair"
```

---

## Hors périmètre (rappel de la spec)

- Les lignes `PRODUCTION` des commandes/livraisons (`OrderDraftCommand.Line`) partagent la même
  forme mais ne sont pas couvertes ici — seule la vente directe immédiate est concernée par la
  demande initiale.
- Toute automatisation qui figerait le poids sans validation humaine.
