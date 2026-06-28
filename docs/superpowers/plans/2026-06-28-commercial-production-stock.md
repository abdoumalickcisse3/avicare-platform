# Synchronisation commercial ↔ stock de production — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lier les ventes/commandes à la production réelle : vendre des poulets de chair (depuis un lot, `current_count`) ou des œufs (depuis le stock de plateaux ferme, `egg_tray_stocks.full_trays_count`) avec contrôle **bloquant** de disponibilité et décrément atomique à la sortie des marchandises.

**Architecture:** Le domaine `livestock` est la source de vérité du stock de production et expose `productionAvailable`/`consumeProduction`/`restockProduction` via `LivestockFacade`. Le commercial (sous-domaine plat) consomme via cette façade, dans la même transaction que la vente/livraison (pattern OUT existant, D21). Œufs auto-alimentés à la clôture des productions journalières.

**Tech Stack:** Spring Boot 3.4 / Java 21 / Spring Data JPA / Postgres ; Next.js 16 / MUI v7 / RTK Query / Vitest.

## Global Constraints

- Backend : `@Service` + `@RequiredArgsConstructor`, records Java 21, `@Transactional` sur écriture / `(readOnly=true)` sur lecture, exceptions héritent de `BusinessException` ; messages techniques en anglais. **Cross-context uniquement via façades** (commercial → `LivestockFacade`).
- **D27 — vente de production BLOQUANTE** : qty > dispo → `com.avicare.common.api.exception.BusinessRuleException(code, message)` (HTTP 422). Ne s'applique qu'à `article_source='PRODUCTION'` ; `INVENTORY`/`TREATMENT` gardent D18/D19 (non-bloquant) inchangés.
- **Chair** : stock = `production_units.current_count` (têtes), décrément via `LivestockService.recordEvent(unitId, "SALE", -heads, reason, Map.of(), userId)` (garde-fous existants : jamais < 0, refus unité CLOSED/CANCELLED). **Œufs** : stock = `egg_tray_stocks.full_trays_count` (plateaux, par ferme) via `EggTrayStockService.adjustStock(farmId, fullDelta, 0)`. Auto-feed à la clôture : `+= floor((collectés − cassés)/30)`.
- **Unités** : chair=`tête`, œufs=`plateau`. `qty` est déjà dans l'unité de stock (têtes/plateaux) — **aucune conversion ×30 à la vente** ; ×30 seulement à l'auto-feed.
- DB : tables `snake_case` pluriel, enums = `VARCHAR` + CHECK, `BIGSERIAL`, FK explicites + index. **Migrations Flyway immuables, nouvelles uniquement** (dernière = V23 → P2 = V24). Aucune migration mergée modifiée.
- Atomicité : le décrément production d'une vente/livraison est dans **la même transaction** ; rollback global si une ligne échoue.
- Commits : Conventional Commits, scope par contexte (`feat(livestock):`, `feat(commercial):`, `feat(web):`), **sans signature Claude/IA**. 1 PR = 1 phase. **Avant commit backend : `./mvnw -q spotless:apply -pl avicare-app` (gate CI `spotless:check`).** `*IT` Testcontainers tournent en CI (Docker 29.x KO en local) → écrire + `test-compile` local, exécution CI.
- Frontend : RTK Query (`baseApi.injectEndpoints`, `transformResponse: r=>r.data`), couleurs `@/theme/tokens`, `@/lib/format`, Rules of Hooks, pas de rôle-ferme exposé (422/403 backend = garde). Lint = `npm run lint` (projet entier).

---

## File Structure

**P1 — Stock de production (livestock)**
- Create `com.avicare.livestock.api.ProductType` (enum `BROILER, EGGS`, public — consommé par le commercial via la façade).
- Create `com.avicare.livestock.production.ProductionStockMath` (logique pure `goodEggsToTrays`) + test.
- Modify `LivestockFacade` (+`LivestockFacadeImpl`) : `productionAvailable` / `consumeProduction` / `restockProduction`.
- Modify `livestock/service/LivestockService` : ajouter constantes `EVENT_SALE="SALE"`, `EVENT_SALE_CANCEL="SALE_CANCEL"` ; helper `consumeHeads`/`restockHeads` (réutilise `recordEvent`).
- Modify `livestock/layer/EggProductionService` (clôture) : auto-feed `EggTrayStockService.adjustStock(farmId, goodEggsToTrays(...), 0)`.
- Tests : `ProductionStockMathTest` (unit, local), `ProductionStockIT` (`@DataJpaTest`+Testcontainers, CI).

**P2 — Intégration commerciale**
- Create migration `V24__commercial_production_source.sql` (sale_items/order_items/delivery_items : CHECK +`PRODUCTION`, +`production_unit_id`, +`product_type`, index).
- Modify entities `SaleItem`/`OrderItem`/`DeliveryItem` (+`productionUnitId`, +`productType`) ; `ArticleSource` enum (+`PRODUCTION`).
- Modify `SaleService` / `DeliveryService` / `OrderService` (+ chemins d'annulation) : brancher les lignes `PRODUCTION` vers la façade ; validation de cohérence de ligne.
- Tests : `CommercialProductionIT` (`@DataJpaTest`/`@SpringBootTest`, CI).

**P3 — Frontend**
- Modify `web/src/components/commercial/QuickSaleDialog.tsx` + `OrderDialog.tsx` (sélecteur source/type/lot + dispo).
- Modify/Create RTK Query usage (réutilise `productionUnitsApi` existant) + types.
- Tests Vitest composant.

---

# Phase P1 — Stock de production (livestock)

> PR : `feat(livestock): production stock availability/consume/restock + egg auto-feed (D27)`.

### Task P1.1 : enum `ProductType` + logique pure `goodEggsToTrays`

**Files:**
- Create: `backend/avicare-app/src/main/java/com/avicare/livestock/api/ProductType.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/livestock/production/ProductionStockMath.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/livestock/production/ProductionStockMathTest.java`

**Interfaces:**
- Produces: `enum ProductType { BROILER, EGGS }` ; `static int ProductionStockMath.goodEggsToTrays(int collected, int broken)` (plateaux pleins entiers à partir des œufs bons ; `floor(max(collected-broken,0)/30)`).

- [ ] **Step 1 : test qui échoue**
```java
package com.avicare.livestock.production;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.Test;

class ProductionStockMathTest {
  @Test void fullTraysFloorDivByThirty() {
    assertThat(ProductionStockMath.goodEggsToTrays(95, 5)).isEqualTo(3);   // 90 bons /30 = 3
    assertThat(ProductionStockMath.goodEggsToTrays(89, 0)).isEqualTo(2);   // 89/30 = 2 (reste 29 ignoré)
    assertThat(ProductionStockMath.goodEggsToTrays(30, 0)).isEqualTo(1);
    assertThat(ProductionStockMath.goodEggsToTrays(29, 0)).isEqualTo(0);
  }
  @Test void neverNegativeWhenBrokenExceedsCollected() {
    assertThat(ProductionStockMath.goodEggsToTrays(10, 25)).isEqualTo(0);
  }
}
```
- [ ] **Step 2 : FAIL** — `cd backend && ./mvnw -q -pl avicare-app test -Dtest=ProductionStockMathTest` → FAIL (classes absentes).
- [ ] **Step 3 : implémenter**
```java
// ProductType.java
package com.avicare.livestock.api;
/** Sellable farm production. BROILER = live birds from a batch; EGGS = full trays (farm pool). */
public enum ProductType { BROILER, EGGS }
```
```java
// ProductionStockMath.java
package com.avicare.livestock.production;
/** Pure conversions for production stock. */
public final class ProductionStockMath {
  private ProductionStockMath() {}
  /** Full 30-egg trays produced from a day's collection (remainder &lt; 30 ignored, V1). */
  public static int goodEggsToTrays(int collected, int broken) {
    int good = Math.max(collected - broken, 0);
    return good / 30;
  }
}
```
- [ ] **Step 4 : PASS** — `./mvnw -q -pl avicare-app test -Dtest=ProductionStockMathTest`.
- [ ] **Step 5 : spotless + commit**
```bash
cd backend && ./mvnw -q spotless:apply -pl avicare-app
git add backend/avicare-app/src/main/java/com/avicare/livestock/api/ProductType.java backend/avicare-app/src/main/java/com/avicare/livestock/production/ProductionStockMath.java backend/avicare-app/src/test/java/com/avicare/livestock/production/ProductionStockMathTest.java
git commit -m "feat(livestock): ProductType enum + production stock math (good eggs to trays)"
```

### Task P1.2 : façade `productionAvailable` / `consumeProduction` / `restockProduction`

**Files:**
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/api/LivestockFacade.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/service/LivestockFacadeImpl.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/service/LivestockService.java` (constantes + helpers chair)
- Test: `backend/avicare-app/src/test/java/com/avicare/livestock/ProductionStockIT.java` (`@DataJpaTest`+Testcontainers)

**Interfaces:**
- Consumes: `ProductType` (P1.1) ; `EggTrayStockService.adjustStock(Long farmId, int fullDelta, int emptyDelta)` (existant) ; `LivestockService.recordEvent(...)` (existant) ; `production_units.current_count`.
- Produces (sur `LivestockFacade`) :
```java
long productionAvailable(Long farmId, ProductType type, Long unitId);          // têtes (BROILER) ou plateaux (EGGS, unitId ignoré)
void consumeProduction(Long farmId, ProductType type, Long unitId, long qty);  // décrément bloquant (422 si insuffisant)
void restockProduction(Long farmId, ProductType type, Long unitId, long qty);  // annulation -> réincrément
```

- [ ] **Step 1 : lire** `LivestockFacadeImpl`, `LivestockService` (signatures exactes `recordEvent`/`getUnit`/garde CLOSED), `EggTrayStockService` (`getOrCreateForFarm`/`adjustStock`), `EggTrayStock` (getter `getFullTraysCount`), `ProductionUnit` (`getFarmId`/`getSpecies`/`getCurrentCount`/`getStatus`), enum `Species` (valeur chair, ex. `BROILER`/`POULTRY_BROILER`) pour valider type↔espèce. Noter les noms exacts avant d'écrire.

- [ ] **Step 2 : test `@DataJpaTest`** (`ProductionStockIT`, Testcontainers — **exécuté en CI**) :
  - fixture : 1 ferme, 1 lot chair `current_count=100` (espèce chair), 1 `egg_tray_stocks` ferme `full_trays_count=10`.
  - `productionAvailable(farm, BROILER, unit)` == 100 ; `(farm, EGGS, null)` == 10.
  - `consumeProduction(farm, BROILER, unit, 30)` → `current_count` 70 ; un `LifecycleEvent` type `SALE` delta −30 existe.
  - `consumeProduction(farm, EGGS, null, 4)` → `full_trays_count` 6.
  - `consumeProduction(farm, BROILER, unit, 1000)` → `BusinessRuleException` (insuffisant) ; idem `EGGS` qty > full_trays.
  - `restockProduction(farm, BROILER, unit, 10)` → `current_count` +10 (+ `LifecycleEvent` `SALE_CANCEL`) ; `restockProduction(farm, EGGS, null, 2)` → `full_trays_count` +2.
  - unité CLOSED → `consumeProduction` BROILER lève 422.
  (Asserts AssertJ ; copier le setup Testcontainers d'un `*IT` existant.)

- [ ] **Step 3 : implémenter** — dans `LivestockService` ajouter `public static final String EVENT_SALE="SALE";` et `EVENT_SALE_CANCEL="SALE_CANCEL";` ; ajouter `consumeHeads(unitId, heads, userId)` = garde dispo (`getCurrentCount() >= heads` sinon `BusinessRuleException("PRODUCTION_INSUFFICIENT", …)`) puis `recordEvent(unitId, EVENT_SALE, -heads, "sale", Map.of(), userId)` ; `restockHeads(...)` = `recordEvent(unitId, EVENT_SALE_CANCEL, +heads, "sale-cancel", …)`. Dans `LivestockFacadeImpl` (injecter `EggTrayStockService`) implémenter les 3 méthodes : BROILER → `LivestockService` (valider espèce chair, sinon 422 `PRODUCTION_TYPE_MISMATCH`) ; EGGS → lire `EggTrayStockService.getOrCreateForFarm(farmId).getFullTraysCount()` pour `available`, décrément via `adjustStock(farmId, -qty, 0)` après garde `available >= qty` (sinon 422). `@Transactional` sur consume/restock ; `(readOnly=true)` sur `productionAvailable`. `qty` int-safe (cast contrôlé).
  > Si `EggTrayStockService` n'expose pas de garde négative, faire la vérif `available >= qty` AVANT `adjustStock` ; le `CHECK (full_trays_count >= 0)` DB est le filet.

- [ ] **Step 4 : compiler + (CI exécute l'IT)** — `./mvnw -q -pl avicare-app -am test-compile` (exit 0). L'IT tourne en CI.
- [ ] **Step 5 : spotless + commit**
```bash
cd backend && ./mvnw -q spotless:apply -pl avicare-app
git add backend/avicare-app/src/main/java/com/avicare/livestock backend/avicare-app/src/test/java/com/avicare/livestock/ProductionStockIT.java
git commit -m "feat(livestock): production availability/consume/restock via facade (D27 blocking)"
```

### Task P1.3 : auto-alimentation du stock de plateaux à la clôture ponte

**Files:**
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/layer/EggProductionService.java`
- Test: étendre `ProductionStockIT` (ou un IT layer existant) — clôture → `full_trays_count`.

- [ ] **Step 1 : lire** `EggProductionService` : trouver la méthode de **clôture** d'une `daily_egg_productions` (celle qui finalise `total_eggs_collected`/`total_broken_eggs`), et son `farmId`. Injecter `EggTrayStockService` si absent.
- [ ] **Step 2 : test** — clôturer une production journalière de `collected=95, broken=5` (90 bons) sur une ferme à `full_trays_count=0` → après clôture `full_trays_count == 3`. (IT Testcontainers, CI.)
- [ ] **Step 3 : implémenter** — à la fin de la clôture, dans la même transaction : `eggTrayStockService.adjustStock(farmId, ProductionStockMath.goodEggsToTrays(collected, broken), 0)`. Ne se déclenche qu'à la **clôture** (pas à chaque collecte intermédiaire), pour éviter le double comptage. (Si la clôture peut être ré-exécutée, garder l'idempotence : n'alimenter qu'au passage vers l'état clôturé.)
- [ ] **Step 4 : compiler** — `./mvnw -q -pl avicare-app -am test-compile`.
- [ ] **Step 5 : spotless + commit**
```bash
cd backend && ./mvnw -q spotless:apply -pl avicare-app
git add backend/avicare-app/src/main/java/com/avicare/livestock/layer/EggProductionService.java backend/avicare-app/src/test/java/com/avicare/livestock
git commit -m "feat(livestock): auto-credit egg tray stock on daily production close"
```

---

# Phase P2 — Intégration commerciale

> PR : `feat(commercial): sell production from lot/egg-stock with blocking availability (D27)`.

### Task P2.1 : migration V24 + entités items (source PRODUCTION)

**Files:**
- Create: `backend/avicare-app/src/main/resources/db/migration/V24__commercial_production_source.sql`
- Modify: `SaleItem`, `OrderItem`, `DeliveryItem` entities (+`productionUnitId`, +`productType`) ; `ArticleSource` enum (+`PRODUCTION`).

- [ ] **Step 1 : lire** les 3 entités items + l'enum `ArticleSource` + le nom exact des tables/colonnes dans V20 (`order_items`), V21 (`sale_items`, `delivery_items`). Relever le **nom auto-généré** du CHECK inline `article_source` par table (`\d sale_items` ou `information_schema.check_constraints`) — nécessaire pour le DROP.
- [ ] **Step 2 : écrire la migration** (forme ; ajuster les noms de contraintes relevés au Step 1) :
```sql
-- V24 — Sell farm production (broilers from a lot, eggs from farm tray stock). D27.
ALTER TABLE sale_items     DROP CONSTRAINT <sale_items_article_source_check>;
ALTER TABLE sale_items     ADD  CONSTRAINT sale_items_article_source_check
                             CHECK (article_source IN ('INVENTORY','TREATMENT','PRODUCTION'));
ALTER TABLE sale_items     ADD COLUMN production_unit_id BIGINT NULL REFERENCES production_units(id);
ALTER TABLE sale_items     ADD COLUMN product_type VARCHAR(20) NULL
                             CHECK (product_type IN ('BROILER','EGGS'));
CREATE INDEX idx_sale_items_production_unit ON sale_items(production_unit_id);
-- … répéter pour order_items (V20) et delivery_items (V21) …
```
- [ ] **Step 3 : entités** — ajouter aux 3 items `private Long productionUnitId;` (`@Column(name="production_unit_id")`) et `@Enumerated(EnumType.STRING) private ProductType productType;` ; ajouter `PRODUCTION` à `ArticleSource`.
- [ ] **Step 4 : compiler** — `./mvnw -q -pl avicare-app -am test-compile`. (La migration tournera sous Testcontainers en CI.)
- [ ] **Step 5 : spotless + commit**
```bash
cd backend && ./mvnw -q spotless:apply -pl avicare-app
git add backend/avicare-app/src/main/resources/db/migration/V24__commercial_production_source.sql backend/avicare-app/src/main/java/com/avicare/livestock
git commit -m "feat(commercial): V24 production source on sale/order/delivery items"
```

### Task P2.2 : wiring vente / livraison / commande / annulation

**Files:**
- Modify: `commercial/SaleService.java`, `commercial/DeliveryService.java`, `commercial/OrderService.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/livestock/commercial/CommercialProductionIT.java`

**Interfaces:**
- Consumes: `LivestockFacade.productionAvailable/consumeProduction/restockProduction` (P1.2) ; `ProductType`.

- [ ] **Step 1 : lire** `SaleService` (boucle items + `recordStockMovement`, lignes ~73 et cancel ~98), `DeliveryService` (point OUT D21), `OrderService` (draft) ; relever comment `userId`/`farmId` sont disponibles. Injecter `LivestockFacade` dans les 3 services.
- [ ] **Step 2 : test `CommercialProductionIT`** (CI) :
  - vente directe d'une ligne BROILER (lot 100, qty 20) → vente COMPLETED + `current_count` 80 ; vente d'une ligne EGGS (full_trays 10, qty 4) → `full_trays_count` 6.
  - vente avec une ligne dépassant la dispo → `BusinessRuleException` ET **aucun** décrément (rollback : `current_count` inchangé, vente non créée).
  - livraison d'une commande avec ligne PRODUCTION → décrément à la livraison ; commande draft → **pas** de décrément.
  - annulation d'une vente PRODUCTION → restock (`current_count`/`full_trays_count` rétablis).
  - cohérence : ligne PRODUCTION sans `productType` → 422 ; BROILER sans `productionUnitId` → 422 ; EGGS avec `productionUnitId` → 422 (ou ignoré — choisir et tester).
- [ ] **Step 3 : implémenter** — dans chaque boucle d'items où l'OUT inventaire est fait : **si `item.getArticleSource()==PRODUCTION`** → `livestockFacade.consumeProduction(farmId, item.getProductType(), item.getProductionUnitId(), (long) item.getQuantity())` au lieu du `recordStockMovement` inventaire (et NON les deux). Annulation → `restockProduction(...)`. Validation de cohérence de ligne à la création (helper `validateProductionLine(line)` levant `BusinessRuleException`). Tout dans la transaction existante (`@Transactional`) → rollback global garanti.
  > `quantity` est `NUMERIC(14,3)` ; pour la production les quantités sont entières (têtes/plateaux) — valider qu'elles sont entières (`scale==0`) sinon 422, et caster en `long`.
- [ ] **Step 4 : compiler** — `./mvnw -q -pl avicare-app -am test-compile`.
- [ ] **Step 5 : spotless + commit**
```bash
cd backend && ./mvnw -q spotless:apply -pl avicare-app
git add backend/avicare-app/src/main/java/com/avicare/livestock/commercial backend/avicare-app/src/test/java/com/avicare/livestock/commercial/CommercialProductionIT.java
git commit -m "feat(commercial): wire production consume/restock into sale/delivery/cancel (D27)"
```

---

# Phase P3 — Frontend

> PR : `feat(web): sell farm production (lot/eggs) with availability in quick-sale & order`.

### Task P3.1 : sélecteur source/type/lot + dispo dans Vente rapide & Commande

**Files:**
- Modify: `web/src/components/commercial/QuickSaleDialog.tsx`, `web/src/components/commercial/OrderDialog.tsx`
- Modify: `web/src/types` (item line : `articleSource` + `productType` + `productionUnitId`) ; réutiliser le slice production-units existant.
- Test: `web/src/components/commercial/*` (Vitest) — rendu sélecteur + garde dispo.

- [ ] **Step 1 : lire** `QuickSaleDialog`/`OrderDialog` (structure des lignes article), le slice/endpoint des unités de production (`GET /farms/{id}/production-units`) déjà consommé ailleurs, et `@/lib/format`.
- [ ] **Step 2 : implémenter** — à l'ajout d'une ligne : choix **source** (Article inventaire / **Production**) ; si Production : **type** (Chair / Œufs). Chair → `Select` du **lot** (unités chair actives) affichant **« N têtes restantes »** (depuis le ProductionUnitInfo) ; Œufs → pas de lot, afficher **« N plateaux disponibles »** (depuis un endpoint stock œufs ferme — si absent, l'ajouter au scope P2 en lecture, ou réutiliser un endpoint tray-stock existant `GET /farms/{id}/egg-tray-stock`). Unité déduite (tête/plateau). Garde front : quantité ≤ dispo (désactive l'ajout sinon) ; le **422 backend reste la garde réelle**.
  > Vérifier s'il existe déjà un endpoint exposant `egg_tray_stocks` (EggTrayStockController). Si oui, le consommer ; sinon, le lire via un petit endpoint ajouté en P2.
- [ ] **Step 3 : test composant** — rendu du sélecteur Production, dispo affichée, bouton « ajouter » désactivé si quantité > dispo.
- [ ] **Step 4 : valider** — `cd web && npx tsc --noEmit && npm run lint && npx vitest run && npx next build` (vert).
- [ ] **Step 5 : commit**
```bash
git add web/src
git commit -m "feat(web): production line selector (lot/eggs) with availability in sale & order"
```

> **Fin P3 → PR.** Clôt la synchronisation commercial ↔ production.

---

## Self-Review (couverture du spec)

- §3 D27 bloquant (PRODUCTION) vs D19 → P1.2 (façade lève 422), P2.2 (wiring). ✓
- §3 chair=current_count / œufs=full_trays_count, unités tête/plateau, pas de ×30 à la vente → P1.2. ✓
- §3 auto-feed clôture (÷30 floor) → P1.1 (math) + P1.3 (hook). ✓
- §4 migration items (PRODUCTION + production_unit_id + product_type), pas de table œufs → P2.1. ✓
- §5 façade productionAvailable/consume/restock → P1.2. ✓
- §6 flux vente directe / livraison / commande draft / annulation → P2.2. ✓
- §7 frontend sélecteur lot/œufs + dispo → P3.1. ✓
- §9 tests (math pur, IT élevage blocage/restock, IT commercial atomicité, composant) → tasks dédiées. ✓

**Cohérence types** : `ProductType{BROILER,EGGS}` (P1.1) consommé par façade (P1.2), entités items (P2.1), wiring (P2.2), front (P3.1). `goodEggsToTrays` (P1.1) utilisé en P1.3. `productionAvailable/consumeProduction/restockProduction(farmId,type,unitId,qty)` stable P1.2→P2.2. `qty` = têtes (BROILER) / plateaux (EGGS), entier.

**Notes implémenteurs** : relever en Step 1 de chaque task backend les noms exacts (entités, getters, enum `Species`/`ArticleSource`, noms de contraintes CHECK) — le plan donne forme + intention, les `*IT` Testcontainers (CI) verrouillent le comportement. Lancer `spotless:apply -pl avicare-app` avant chaque commit backend.
