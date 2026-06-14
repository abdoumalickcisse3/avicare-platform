package com.avicare.livestock.inventory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.avicare.common.api.exception.NotFoundException;
import com.avicare.livestock.domain.ArticleSource;
import com.avicare.livestock.domain.MovementReason;
import com.avicare.livestock.domain.MovementType;
import com.avicare.livestock.domain.ProductionUnit;
import com.avicare.livestock.domain.Species;
import com.avicare.livestock.domain.StockMovement;
import com.avicare.livestock.domain.UnitKind;
import com.avicare.livestock.domain.UnitStatus;
import com.avicare.livestock.health.TreatmentCommand;
import com.avicare.livestock.health.TreatmentExecutedService;
import com.avicare.livestock.health.VaccinationCommand;
import com.avicare.livestock.health.VaccinationService;
import com.avicare.livestock.poultry.DailyRecordCommand;
import com.avicare.livestock.poultry.DailyRecordService;
import com.avicare.livestock.repository.BreedRepository;
import com.avicare.livestock.repository.ProductionUnitRepository;
import com.avicare.support.RsaKeys;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.security.KeyPair;
import java.time.LocalDate;
import java.util.List;
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
 * Cross-context coupling (Décision D18) on a real PostgreSQL (Testcontainers, V1–V19): an optional
 * StockConsumption on a daily record / vaccination / treatment atomically creates an OUT stock
 * movement with the right reason + backref. Covers the non-coupled path (retrocompat), rollback on
 * an invalid article, the negative-stock warning (D19), and multi-movement consistency. CI-only
 * where Docker is unavailable.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@Testcontainers
class CrossContextCouplingIT {

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
  @Autowired private DailyRecordService dailyRecordService;
  @Autowired private VaccinationService vaccinationService;
  @Autowired private TreatmentExecutedService treatmentService;
  @Autowired private StockItemService stockItemService;
  @Autowired private StockMovementService stockMovementService;
  @Autowired private BreedRepository breedRepository;
  @Autowired private ProductionUnitRepository productionUnitRepository;

  @Test
  void dailyRecord_withFeedConsumption_createsMovementWithBackref_decrementsStock()
      throws Exception {
    long farmId = createFarm();
    long unitId = seedUnit(farmId);

    var rec =
        dailyRecordService.record(
            unitId,
            new DailyRecordCommand(
                LocalDate.now(),
                0,
                new BigDecimal("50"),
                BigDecimal.ZERO,
                null,
                new StockConsumption(
                    "feed_starter_broiler", ArticleSource.INVENTORY, new BigDecimal("50"), "lot")),
            1L);

    // stock auto-created then decremented to -50 (D19: negative allowed)
    assertThat(
            stockItemService
                .createOrGet(farmId, ArticleSource.INVENTORY, "feed_starter_broiler", 1L)
                .getCurrentQuantity())
        .isEqualByComparingTo("-50");

    List<StockMovement> movements = stockMovementService.listForProductionUnit(unitId);
    assertThat(movements).hasSize(1);
    assertThat(movements.get(0).getMovementType()).isEqualTo(MovementType.OUT);
    assertThat(movements.get(0).getReason()).isEqualTo(MovementReason.CONSUMPTION_LOT);
    assertThat(movements.get(0).getDailyRecordId()).isEqualTo(rec.getId());
  }

  @Test
  void dailyRecord_withoutConsumption_noMovement() throws Exception {
    long farmId = createFarm();
    long unitId = seedUnit(farmId);

    dailyRecordService.record(
        unitId,
        new DailyRecordCommand(
            LocalDate.now(), 0, new BigDecimal("50"), BigDecimal.ZERO, null, null),
        1L);

    assertThat(stockMovementService.listForProductionUnit(unitId)).isEmpty();
    assertThat(stockItemService.listForFarm(farmId)).isEmpty();
  }

  @Test
  void dailyRecord_unknownArticle_rollsBackEverything() throws Exception {
    long farmId = createFarm();
    long unitId = seedUnit(farmId);

    assertThatThrownBy(
            () ->
                dailyRecordService.record(
                    unitId,
                    new DailyRecordCommand(
                        LocalDate.now(),
                        0,
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        null,
                        new StockConsumption(
                            "nope", ArticleSource.INVENTORY, new BigDecimal("10"), null)),
                    1L))
        .isInstanceOf(NotFoundException.class);

    // full rollback: neither the daily record nor a stock movement persisted
    assertThat(dailyRecordService.listForUnit(unitId)).isEmpty();
    assertThat(stockMovementService.listForProductionUnit(unitId)).isEmpty();
  }

  @Test
  void vaccination_withConsumption_backrefAndReason() throws Exception {
    long farmId = createFarm();
    long unitId = seedUnit(farmId);

    var vacc =
        vaccinationService.record(
            unitId,
            new VaccinationCommand(
                "newcastle_la_sota",
                LocalDate.now(),
                "WATER",
                new BigDecimal("0.5"),
                "ml",
                1000,
                "B-1",
                LocalDate.now().plusMonths(6),
                null,
                null,
                new StockConsumption(
                    "amoxicillin_50", ArticleSource.TREATMENT, new BigDecimal("10"), null)),
            1L);

    List<StockMovement> movements = stockMovementService.listForProductionUnit(unitId);
    assertThat(movements).hasSize(1);
    assertThat(movements.get(0).getReason()).isEqualTo(MovementReason.CONSUMPTION_VACCINATION);
    assertThat(movements.get(0).getVaccinationId()).isEqualTo(vacc.getId());
  }

  @Test
  void treatment_withConsumption_backrefAndReason() throws Exception {
    long farmId = createFarm();
    long unitId = seedUnit(farmId);

    var treat =
        treatmentService.record(
            unitId,
            new TreatmentCommand(
                "amoxicillin_50",
                LocalDate.now(),
                3,
                BigDecimal.ONE,
                "mg/L",
                "WATER",
                1000,
                null,
                "FARMER",
                null,
                null,
                null,
                new StockConsumption(
                    "amoxicillin_50", ArticleSource.TREATMENT, new BigDecimal("5"), null)),
            1L);

    List<StockMovement> movements = stockMovementService.listForProductionUnit(unitId);
    assertThat(movements).hasSize(1);
    assertThat(movements.get(0).getReason()).isEqualTo(MovementReason.CONSUMPTION_TREATMENT);
    assertThat(movements.get(0).getTreatmentExecutedId()).isEqualTo(treat.getId());
  }

  @Test
  void consistency_purchaseInThenTwoConsumptions() throws Exception {
    long farmId = createFarm();
    long unitId = seedUnit(farmId);
    var stock =
        stockItemService.createOrGet(farmId, ArticleSource.INVENTORY, "feed_starter_broiler", 1L);

    // IN 100 (purchase)
    stockMovementService.recordMovement(
        farmId,
        new StockMovementCommand(
            stock.getId(),
            MovementType.IN,
            new BigDecimal("100"),
            MovementReason.RECEPTION_PURCHASE,
            LocalDate.now(),
            null,
            null,
            null,
            null,
            440,
            null,
            null),
        1L);

    // two daily records consuming 50 then 60 → 100 - 110 = -10 (D19)
    consumeFeed(unitId, "50");
    consumeFeed(unitId, "60");

    assertThat(
            stockItemService
                .createOrGet(farmId, ArticleSource.INVENTORY, "feed_starter_broiler", 1L)
                .getCurrentQuantity())
        .isEqualByComparingTo("-10");
    // 1 IN + 2 OUT on the stock item
    assertThat(stockMovementService.listForStockItem(farmId, stock.getId())).hasSize(3);
  }

  // --- helpers --------------------------------------------------------

  private void consumeFeed(long unitId, String qty) {
    dailyRecordService.record(
        unitId,
        new DailyRecordCommand(
            LocalDate.now().plusDays(Long.parseLong(qty)), // distinct dates to avoid upsert
            0,
            new BigDecimal(qty),
            BigDecimal.ZERO,
            null,
            new StockConsumption(
                "feed_starter_broiler", ArticleSource.INVENTORY, new BigDecimal(qty), null)),
        1L);
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
    String email = "t" + System.nanoTime() + "@cc.io";
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
                    .content("{\"name\":\"Ferme CC\"}"))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return objectMapper.readTree(json).get("data").get("id").asLong();
  }
}
