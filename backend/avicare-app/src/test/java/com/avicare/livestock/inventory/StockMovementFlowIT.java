package com.avicare.livestock.inventory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.common.api.exception.ValidationException;
import com.avicare.livestock.domain.ArticleSource;
import com.avicare.livestock.domain.MovementReason;
import com.avicare.livestock.domain.MovementType;
import com.avicare.livestock.domain.ProductionUnit;
import com.avicare.livestock.domain.Species;
import com.avicare.livestock.domain.StockItem;
import com.avicare.livestock.domain.StockMovement;
import com.avicare.livestock.domain.UnitKind;
import com.avicare.livestock.domain.UnitStatus;
import com.avicare.livestock.repository.BreedRepository;
import com.avicare.livestock.repository.ProductionUnitRepository;
import com.avicare.support.RsaKeys;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.security.KeyPair;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Stock movements + low-stock alerts on a real PostgreSQL (Testcontainers, V1–V16): atomic cascade
 * to current_quantity with before/after snapshots, negative quantity allowed on OUT (D19),
 * ADJUSTMENT-to-target semantics, cross-module backref persistence, valuation, and compute-on-read
 * alerts. CI-only where Docker is unavailable.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@Testcontainers
class StockMovementFlowIT {

  @Container
  static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

  private static final KeyPair KEYS = RsaKeys.generate();

  @DynamicPropertySource
  static void props(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", POSTGRES::getUsername);
    registry.add("spring.datasource.password", POSTGRES::getPassword);
    registry.add("spring.flyway.enabled", () -> "true");
    registry.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
    registry.add("avicare.security.jwt.private-key", () -> RsaKeys.privatePem(KEYS));
    registry.add("avicare.security.jwt.public-key", () -> RsaKeys.publicPem(KEYS));
  }

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;
  @Autowired private StockItemService stockItemService;
  @Autowired private StockMovementService stockMovementService;
  @Autowired private InventoryAlertService inventoryAlertService;
  @Autowired private BreedRepository breedRepository;
  @Autowired private ProductionUnitRepository productionUnitRepository;

  @Test
  void movements_cascadeSnapshots_negativeAllowed_adjustmentToTarget() throws Exception {
    long farmId = createFarm();
    StockItem feed =
        stockItemService.createOrGet(farmId, ArticleSource.INVENTORY, "feed_layer", 1L);

    // IN 50 @ 440 → 0 -> 50, value 22000
    StockMovement in =
        stockMovementService.recordMovement(
            farmId,
            cmd(feed.getId(), MovementType.IN, "50", MovementReason.RECEPTION_PURCHASE, 440),
            1L);
    assertThat(in.getQuantityBefore()).isEqualByComparingTo("0");
    assertThat(in.getQuantityAfter()).isEqualByComparingTo("50");
    assertThat(in.getQuantity()).isEqualByComparingTo("50");
    assertThat(in.getTotalValueXof()).isEqualTo(22000L);
    assertThat(stockItemService.get(farmId, feed.getId()).getCurrentQuantity())
        .isEqualByComparingTo("50");
    assertThat(stockItemService.get(farmId, feed.getId()).getLastMovementAt()).isNotNull();

    // OUT 30 → 50 -> 20
    stockMovementService.recordMovement(
        farmId,
        cmd(feed.getId(), MovementType.OUT, "30", MovementReason.CONSUMPTION_LOT, null),
        1L);
    assertThat(stockItemService.get(farmId, feed.getId()).getCurrentQuantity())
        .isEqualByComparingTo("20");

    // OUT 100 → 20 -> -80 (D19, no exception)
    StockMovement neg =
        stockMovementService.recordMovement(
            farmId, cmd(feed.getId(), MovementType.OUT, "100", MovementReason.LOSS, null), 1L);
    assertThat(neg.getQuantityAfter()).isEqualByComparingTo("-80");

    // ADJUSTMENT to counted target 60 → -80 -> 60, magnitude 140
    StockMovement adj =
        stockMovementService.recordMovement(
            farmId,
            cmd(
                feed.getId(),
                MovementType.ADJUSTMENT,
                "60",
                MovementReason.INVENTORY_PHYSICAL,
                null),
            1L);
    assertThat(adj.getQuantityAfter()).isEqualByComparingTo("60");
    assertThat(adj.getQuantity()).isEqualByComparingTo("140");

    // no-op adjustment (target == current) → 422
    assertThatThrownBy(
            () ->
                stockMovementService.recordMovement(
                    farmId,
                    cmd(
                        feed.getId(),
                        MovementType.ADJUSTMENT,
                        "60",
                        MovementReason.INVENTORY_PHYSICAL,
                        null),
                    1L))
        .isInstanceOf(BusinessRuleException.class);

    // negative adjustment target → 400
    assertThatThrownBy(
            () ->
                stockMovementService.recordMovement(
                    farmId,
                    cmd(
                        feed.getId(),
                        MovementType.ADJUSTMENT,
                        "-5",
                        MovementReason.ERROR_CORRECTION,
                        null),
                    1L))
        .isInstanceOf(ValidationException.class);

    assertThat(stockMovementService.listForStockItem(farmId, feed.getId())).hasSize(4);
  }

  @Test
  void backref_persisted_andValuation() throws Exception {
    long farmId = createFarm();
    long unitId = seedUnit(farmId);
    StockItem feed =
        stockItemService.createOrGet(farmId, ArticleSource.INVENTORY, "feed_layer", 1L);

    stockMovementService.recordMovement(
        farmId,
        cmd(feed.getId(), MovementType.IN, "100", MovementReason.RECEPTION_PURCHASE, 440),
        1L);
    StockMovement consumption =
        stockMovementService.recordMovement(
            farmId,
            new StockMovementCommand(
                feed.getId(),
                MovementType.OUT,
                new BigDecimal("40"),
                MovementReason.CONSUMPTION_LOT,
                LocalDate.now(),
                unitId,
                null,
                null,
                null,
                null,
                "fed batch",
                null),
            1L);

    assertThat(consumption.getProductionUnitId()).isEqualTo(unitId);
    assertThat(stockMovementService.listForProductionUnit(unitId)).hasSize(1);

    // current 60 @ 440 → 26400
    StockValuationResponse valuation = stockMovementService.getStockValuation(farmId);
    assertThat(valuation.totalValueXof()).isEqualTo(26400L);
    assertThat(valuation.items())
        .anySatisfy(
            i -> {
              assertThat(i.articleKey()).isEqualTo("feed_layer");
              assertThat(i.valueXof()).isEqualTo(26400L);
            });
  }

  @Test
  void alerts_lowNegativeAndRecent() throws Exception {
    long farmId = createFarm();
    StockItem feed =
        stockItemService.createOrGet(farmId, ArticleSource.INVENTORY, "feed_layer", 1L);
    StockItem corn =
        stockItemService.createOrGet(farmId, ArticleSource.INVENTORY, "corn_crushed", 1L);

    // feed: threshold 100, IN 60 → 60 (low, 40% below). corn: OUT 10 → -10 (negative, no
    // threshold).
    stockItemService.updateThreshold(farmId, feed.getId(), new BigDecimal("100"), 1L);
    stockMovementService.recordMovement(
        farmId,
        cmd(feed.getId(), MovementType.IN, "60", MovementReason.RECEPTION_PURCHASE, null),
        1L);
    stockMovementService.recordMovement(
        farmId, cmd(corn.getId(), MovementType.OUT, "10", MovementReason.LOSS, null), 1L);

    StockAlertsResponse alerts = inventoryAlertService.computeStockAlertsForFarm(farmId);

    assertThat(alerts.lowStockItems()).hasSize(1);
    assertThat(alerts.lowStockItems().get(0).articleKey()).isEqualTo("feed_layer");
    assertThat(alerts.lowStockItems().get(0).label()).isEqualTo("Ponte");
    assertThat(alerts.lowStockItems().get(0).percentBelowThreshold()).isEqualByComparingTo("40.0");

    assertThat(alerts.negativeStockItems()).hasSize(1);
    assertThat(alerts.negativeStockItems().get(0).articleKey()).isEqualTo("corn_crushed");
    assertThat(alerts.negativeStockItems().get(0).currentQuantity()).isEqualByComparingTo("-10");

    assertThat(alerts.recentMovements()).hasSize(2);
    assertThat(alerts.recentMovements().get(0).movementDate()).isEqualTo(LocalDate.now());
  }

  // --- helpers --------------------------------------------------------

  private static StockMovementCommand cmd(
      Long stockItemId, MovementType type, String qty, MovementReason reason, Integer unitPrice) {
    return new StockMovementCommand(
        stockItemId,
        type,
        new BigDecimal(qty),
        reason,
        LocalDate.now(),
        null,
        null,
        null,
        null,
        unitPrice,
        null,
        null);
  }

  private long seedUnit(long farmId) {
    long breedId =
        breedRepository
            .findBySpeciesAndCodeAndFarmId(Species.POULTRY, "cobb_500", null)
            .orElseThrow()
            .getId();
    ProductionUnit unit = new ProductionUnit();
    unit.setFarmId(farmId);
    unit.setSpecies(Species.POULTRY);
    unit.setUnitKind(UnitKind.BATCH);
    unit.setBreedId(breedId);
    unit.setName("Lot");
    unit.setStartDate(LocalDate.now().minusDays(10));
    unit.setCurrentCount(1000);
    unit.setStatus(UnitStatus.ACTIVE);
    return productionUnitRepository.save(unit).getId();
  }

  private long createFarm() throws Exception {
    String email = "t" + System.nanoTime() + "@mov.io";
    mockMvc
        .perform(
            post("/api/v1/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"email\":\""
                        + email
                        + "\",\"password\":\"password123\",\"fullName\":\"T\"}"))
        .andExpect(status().isCreated());
    String token =
        objectMapper
            .readTree(
                mockMvc
                    .perform(
                        post("/api/v1/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"email\":\"" + email + "\",\"password\":\"password123\"}"))
                    .andReturn()
                    .getResponse()
                    .getContentAsString())
            .get("data")
            .get("accessToken")
            .asText();
    String json =
        mockMvc
            .perform(
                post("/api/v1/farms")
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"name\":\"Ferme Mov\"}"))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return objectMapper.readTree(json).get("data").get("id").asLong();
  }
}
