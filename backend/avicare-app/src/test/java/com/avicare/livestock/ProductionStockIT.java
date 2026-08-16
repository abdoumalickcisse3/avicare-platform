package com.avicare.livestock;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.common.security.principal.UserRole;
import com.avicare.identity.domain.User;
import com.avicare.livestock.api.LivestockFacade;
import com.avicare.livestock.api.ProductType;
import com.avicare.livestock.domain.Breed;
import com.avicare.livestock.domain.EggTrayStock;
import com.avicare.livestock.domain.PoultryBatch;
import com.avicare.livestock.domain.ProductionUnit;
import com.avicare.livestock.domain.Species;
import com.avicare.livestock.domain.UnitKind;
import com.avicare.livestock.domain.UnitStatus;
import com.avicare.livestock.layer.EggTrayStockService;
import com.avicare.livestock.poultry.PoultryBatchService;
import com.avicare.livestock.repository.BreedRepository;
import com.avicare.livestock.repository.EggTrayStockRepository;
import com.avicare.livestock.repository.LifecycleEventRepository;
import com.avicare.livestock.repository.ProductionUnitRepository;
import com.avicare.livestock.service.LivestockFacadeImpl;
import com.avicare.livestock.service.LivestockService;
import com.avicare.tenancy.domain.Farm;
import jakarta.persistence.EntityManager;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Verifies the production stock facade (D27 blocking) on a real PostgreSQL (Testcontainers,
 * migrations V1–V23+). Fixture: 1 farm, 1 ACTIVE POULTRY unit (currentCount=100), 1 CLOSED POULTRY
 * unit (currentCount=100), and egg_tray_stocks with full_trays_count=10.
 *
 * <p>CI-only — Testcontainers can't run on this dev machine (Docker 29.x incompatibility, see
 * project memory).
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers
@Import({
  LivestockService.class,
  EggTrayStockService.class,
  LivestockFacadeImpl.class,
  PoultryBatchService.class
})
class ProductionStockIT {

  @Container
  static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

  @DynamicPropertySource
  static void datasource(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", POSTGRES::getUsername);
    registry.add("spring.datasource.password", POSTGRES::getPassword);
    registry.add("spring.flyway.enabled", () -> "true");
    registry.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
  }

  @Autowired LivestockFacade facade;
  @Autowired ProductionUnitRepository productionUnitRepository;
  @Autowired LifecycleEventRepository lifecycleEventRepository;
  @Autowired EggTrayStockRepository eggTrayStockRepository;
  @Autowired BreedRepository breedRepository;
  @Autowired EntityManager em;

  Long farmId;
  Long unitId; // ACTIVE PoultryBatch (broiler), currentCount=100
  Long closedUnitId; // CLOSED PoultryBatch (broiler), currentCount=100
  Long layerUnitId; // ACTIVE plain ProductionUnit (layer lot, no poultry_batches row)

  @BeforeEach
  void setUp() {
    // ── User (required by Farm.created_by and production_units.created_by FKs) ─
    User user = new User();
    user.setEmail("prodstock." + System.nanoTime() + "@test.io");
    user.setPasswordHash("$2a$12$aaaabbbbccccddddeeeeffff");
    user.setFullName("ProdStock Test");
    user.setRole(UserRole.USER);
    em.persist(user);
    em.flush();
    Long userId = user.getId();

    // ── Farm ──────────────────────────────────────────────────────────────────
    Farm farm = new Farm();
    farm.setName("ProdStock Farm " + System.nanoTime());
    farm.setCreatedBy(userId);
    em.persist(farm);
    em.flush();
    farmId = farm.getId();

    // ── Seeded cobb_500 breed (V4 migration, platform breed, farm_id=null) ────
    Breed breed =
        breedRepository
            .findBySpeciesAndCodeAndFarmId(Species.POULTRY, "cobb_500", null)
            .orElseThrow();

    // ── Active PoultryBatch (broiler) — currentCount=100 ─────────────────────
    PoultryBatch batch = new PoultryBatch();
    batch.setFarmId(farmId);
    batch.setSpecies(Species.POULTRY);
    batch.setUnitKind(UnitKind.BATCH);
    batch.setStartDate(LocalDate.now().minusDays(10));
    batch.setCurrentCount(100);
    batch.setStatus(UnitStatus.ACTIVE);
    batch.setCreatedBy(userId);
    batch.setBreed(breed);
    batch.setInitialCount(100);
    em.persist(batch);
    em.flush();
    unitId = batch.getId();

    // ── Closed PoultryBatch (broiler) — currentCount=100 (CLOSED guard test) ─
    PoultryBatch closedBatch = new PoultryBatch();
    closedBatch.setFarmId(farmId);
    closedBatch.setSpecies(Species.POULTRY);
    closedBatch.setUnitKind(UnitKind.BATCH);
    closedBatch.setStartDate(LocalDate.now().minusDays(30));
    closedBatch.setEndDate(LocalDate.now().minusDays(1));
    closedBatch.setCurrentCount(100);
    closedBatch.setStatus(UnitStatus.CLOSED);
    closedBatch.setCreatedBy(userId);
    closedBatch.setBreed(breed);
    closedBatch.setInitialCount(100);
    em.persist(closedBatch);
    em.flush();
    closedUnitId = closedBatch.getId();

    // ── Layer lot — plain ProductionUnit (no poultry_batches row, POULTRY species)
    // Used to verify that passing a layer lot as BROILER is rejected (Finding 1).
    ProductionUnit layer = new ProductionUnit();
    layer.setFarmId(farmId);
    layer.setSpecies(Species.POULTRY);
    layer.setUnitKind(UnitKind.BATCH);
    layer.setStartDate(LocalDate.now().minusDays(5));
    layer.setCurrentCount(50);
    layer.setStatus(UnitStatus.ACTIVE);
    layer.setCreatedBy(userId);
    em.persist(layer);
    em.flush();
    layerUnitId = layer.getId();

    // ── Egg tray stock — full_trays_count=10 ──────────────────────────────────
    EggTrayStock eggStock = new EggTrayStock();
    eggStock.setFarmId(farmId);
    eggStock.setFullTraysCount(10);
    eggStock.setEmptyTraysCount(0);
    em.persist(eggStock);
    em.flush();

    em.clear(); // detach all so queries hit DB, not first-level cache
  }

  // ── productionAvailable ──────────────────────────────────────────────────

  @Test
  void productionAvailable_broiler_returns_current_count() {
    long available = facade.productionAvailable(farmId, ProductType.BROILER, unitId);
    assertThat(available).isEqualTo(100L);
  }

  @Test
  void productionAvailable_eggs_returns_full_trays_count() {
    long available = facade.productionAvailable(farmId, ProductType.EGGS, null);
    assertThat(available).isEqualTo(10L);
  }

  // ── consumeProduction — happy paths ─────────────────────────────────────

  @Test
  void consumeProduction_broiler_decrements_current_count_and_records_sale_event() {
    facade.consumeProduction(farmId, ProductType.BROILER, unitId, 30);

    ProductionUnit reloaded = productionUnitRepository.findById(unitId).orElseThrow();
    assertThat(reloaded.getCurrentCount()).isEqualTo(70);

    List<com.avicare.livestock.domain.LifecycleEvent> events =
        lifecycleEventRepository.findByProductionUnitId(unitId);
    assertThat(events)
        .as("a SALE lifecycle event with delta -30 must be recorded")
        .anyMatch(e -> "SALE".equals(e.getEventType()) && e.getQuantityDelta() == -30);
  }

  @Test
  void consumeProduction_eggs_decrements_full_trays_count() {
    facade.consumeProduction(farmId, ProductType.EGGS, null, 4);

    int remaining = eggTrayStockRepository.findByFarmId(farmId).orElseThrow().getFullTraysCount();
    assertThat(remaining).isEqualTo(6);
  }

  // ── consumeProduction — blocking (D27) ───────────────────────────────────

  @Test
  void consumeProduction_broiler_throws_422_when_quantity_exceeds_available() {
    assertThatThrownBy(() -> facade.consumeProduction(farmId, ProductType.BROILER, unitId, 1000))
        .isInstanceOf(BusinessRuleException.class)
        .hasMessageContaining("1000");
  }

  @Test
  void consumeProduction_eggs_throws_422_when_quantity_exceeds_available() {
    assertThatThrownBy(() -> facade.consumeProduction(farmId, ProductType.EGGS, null, 100))
        .isInstanceOf(BusinessRuleException.class)
        .hasMessageContaining("100");
  }

  @Test
  void consumeProduction_broiler_throws_422_when_unit_is_closed() {
    // closedUnitId has currentCount=100, so the insufficiency guard passes;
    // the CLOSED guard in recordEvent fires (PRODUCTION_UNIT_NOT_OPEN, HTTP 422).
    // Code must be PRODUCTION_UNIT_NOT_OPEN — not PRODUCTION_INSUFFICIENT — to catch regressions.
    assertThatThrownBy(
            () -> facade.consumeProduction(farmId, ProductType.BROILER, closedUnitId, 30))
        .isInstanceOf(BusinessRuleException.class)
        .hasFieldOrPropertyWithValue("code", "PRODUCTION_UNIT_NOT_OPEN");
  }

  @Test
  void consumeProduction_broiler_throws_422_when_unit_is_layer_lot() {
    // layerUnitId is a plain ProductionUnit (species=POULTRY, no poultry_batches row).
    // validateBroilerUnit must reject it with PRODUCTION_TYPE_MISMATCH, not decrement its count.
    assertThatThrownBy(() -> facade.consumeProduction(farmId, ProductType.BROILER, layerUnitId, 10))
        .isInstanceOf(BusinessRuleException.class)
        .hasFieldOrPropertyWithValue("code", "PRODUCTION_TYPE_MISMATCH");
  }

  // ── restockProduction ────────────────────────────────────────────────────

  @Test
  void restockProduction_broiler_increments_current_count_and_records_sale_cancel_event() {
    facade.restockProduction(farmId, ProductType.BROILER, unitId, 10);

    ProductionUnit reloaded = productionUnitRepository.findById(unitId).orElseThrow();
    assertThat(reloaded.getCurrentCount()).isEqualTo(110);

    List<com.avicare.livestock.domain.LifecycleEvent> events =
        lifecycleEventRepository.findByProductionUnitId(unitId);
    assertThat(events)
        .as("a SALE_CANCEL lifecycle event with delta +10 must be recorded")
        .anyMatch(e -> "SALE_CANCEL".equals(e.getEventType()) && e.getQuantityDelta() == 10);
  }

  @Test
  void restockProduction_eggs_increments_full_trays_count() {
    facade.restockProduction(farmId, ProductType.EGGS, null, 2);

    int newCount = eggTrayStockRepository.findByFarmId(farmId).orElseThrow().getFullTraysCount();
    assertThat(newCount).isEqualTo(12);
  }
}
