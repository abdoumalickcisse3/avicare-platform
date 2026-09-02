package com.avicare.livestock.closure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.avicare.common.api.exception.ConflictException;
import com.avicare.common.api.exception.NotFoundException;
import com.avicare.common.security.principal.UserRole;
import com.avicare.finance.domain.Expense;
import com.avicare.finance.domain.ExpenseSource;
import com.avicare.identity.domain.User;
import com.avicare.livestock.domain.LifecycleEvent;
import com.avicare.livestock.domain.MovementReason;
import com.avicare.livestock.domain.MovementType;
import com.avicare.livestock.domain.ProductionUnit;
import com.avicare.livestock.domain.Species;
import com.avicare.livestock.domain.StockItem;
import com.avicare.livestock.domain.UnitKind;
import com.avicare.livestock.domain.UnitStatus;
import com.avicare.livestock.inventory.StockMovementCommand;
import com.avicare.livestock.inventory.StockMovementService;
import com.avicare.livestock.repository.ProductionUnitRepository;
import com.avicare.livestock.service.LivestockService;
import com.avicare.tenancy.domain.Farm;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * End-to-end closing flow on a real PostgreSQL (Testcontainers): a unit that consumed valued feed
 * and carries a direct expense is closed, and the report holds. Also proves the two properties the
 * whole design rests on — a later expense does not move a frozen report, and reopening erases it.
 *
 * <p>Sales revenue is left at zero here: it comes from {@code CommercialFacade}, which has its own
 * integration coverage. What is new, and what this exercises, is the valuation and the freezing.
 *
 * <p>CI-only on dev machines (Docker incompatibility).
 */
@SpringBootTest
@Testcontainers
@Transactional
class UnitClosureIT {

  @Container
  static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

  @DynamicPropertySource
  static void props(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", POSTGRES::getUsername);
    registry.add("spring.datasource.password", POSTGRES::getPassword);
    registry.add("spring.flyway.enabled", () -> "true");
    registry.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
  }

  @Autowired private UnitClosureService unitClosureService;
  @Autowired private UnitClosureRepository unitClosureRepository;
  @Autowired private LivestockService livestockService;
  @Autowired private ProductionUnitRepository productionUnitRepository;
  @Autowired private StockMovementService stockMovementService;
  @Autowired private EntityManager em;

  private long farmId;
  private long userId;

  /** 1000 placed 45 days ago, 20 dead, 800 sold — 180 left on hand. */
  private long seedUnit() {
    User u = new User();
    u.setEmail("closure@example.com");
    u.setPasswordHash("$2a$12$abcdefghijklmnopqrstuv");
    u.setFullName("Closure");
    u.setRole(UserRole.USER);
    em.persist(u);

    Farm f = new Farm();
    f.setName("Ferme Clôture");
    f.setCreatedBy(u.getId());
    em.persist(f);
    em.flush();

    userId = u.getId();
    farmId = f.getId();

    ProductionUnit unit = new ProductionUnit();
    unit.setFarmId(farmId);
    unit.setSpecies(Species.POULTRY);
    unit.setUnitKind(UnitKind.BATCH);
    unit.setName("Bande A");
    unit.setStartDate(LocalDate.now().minusDays(45));
    unit.setCurrentCount(1000);
    unit.setStatus(UnitStatus.ACTIVE);
    long unitId = productionUnitRepository.saveAndFlush(unit).getId();

    // The CREATED event carries the initial headcount, as createUnit writes it.
    LifecycleEvent created = new LifecycleEvent();
    created.setProductionUnitId(unitId);
    created.setEventType(LivestockService.EVENT_CREATED);
    created.setQuantityDelta(1000);
    created.setReason("unit_created");
    created.setCreatedBy(userId);
    em.persist(created);
    em.flush();

    livestockService.recordMortality(unitId, 20, "heat_stress", userId);
    livestockService.consumeHeads(unitId, 800, userId);
    em.flush();
    return unitId;
  }

  /**
   * 200 kg of feed at 400 XOF, charged to the unit — priced through the article, as in real life.
   */
  private void seedConsumption(long unitId) {
    StockItem item = new StockItem();
    item.setFarmId(farmId);
    item.setArticleKey("feed.starter");
    item.setUnit("kg");
    item.setCurrentQuantity(new BigDecimal("500"));
    item.setTypicalUnitPriceXof(400);
    em.persist(item);
    em.flush();

    stockMovementService.recordMovement(
        farmId,
        new StockMovementCommand(
            item.getId(),
            MovementType.OUT,
            new BigDecimal("200"),
            MovementReason.CONSUMPTION_LOT,
            LocalDate.now(),
            unitId,
            null,
            null,
            null,
            null, // no unit price: consumption is recorded in kilos, never in XOF
            null,
            null),
        userId);
    em.flush();
  }

  private void seedExpense(long unitId, long amountXof, ExpenseSource source) {
    Expense e = new Expense();
    e.setFarmId(farmId);
    e.setCategoryKey("veterinary");
    e.setAmountXof(amountXof);
    e.setExpenseDate(LocalDate.now());
    e.setLabel("Visite véto");
    e.setProductionUnitId(unitId);
    e.setSource(source);
    e.setCreatedBy(userId);
    em.persist(e);
    em.flush();
  }

  @Test
  void close_freezesTheReport_andLaterExpensesDoNotMoveIt() {
    long unitId = seedUnit();
    seedConsumption(unitId);
    seedExpense(unitId, 90_000L, ExpenseSource.MANUAL);
    // Already counted when the stock came in — it must not be charged to the batch again.
    seedExpense(unitId, 500_000L, ExpenseSource.STOCK_ENTRY);

    UnitClosure closure =
        unitClosureService.close(farmId, unitId, 250_000L, "Fin de bande", userId);
    em.flush();
    em.clear();

    assertThat(closure.getInitialCount()).isEqualTo(1000);
    assertThat(closure.getDeaths()).isEqualTo(20); // the 800 sold are not losses
    assertThat(closure.getRemainingCount()).isEqualTo(180);
    assertThat(closure.getMortalityPercent()).isEqualByComparingTo("2.00");
    assertThat(closure.getDurationDays()).isEqualTo(45);

    assertThat(closure.getFeedCostXof()).isEqualTo(80_000L); // 200 kg x 400
    assertThat(closure.getChickCostXof()).isEqualTo(250_000L);
    assertThat(closure.getOtherExpenseXof()).isEqualTo(90_000L); // STOCK_ENTRY excluded
    assertThat(closure.getTotalCostXof()).isEqualTo(420_000L);
    assertThat(closure.getConsumedArticles()).isEqualTo(1);
    assertThat(closure.getValuedArticles()).isEqualTo(1);

    assertThat(productionUnitRepository.findById(unitId).orElseThrow().getStatus())
        .isEqualTo(UnitStatus.CLOSED);

    // A report that moved after the fact would not be a report.
    seedExpense(unitId, 300_000L, ExpenseSource.MANUAL);
    em.clear();
    UnitClosure reread = unitClosureService.get(farmId, unitId);
    assertThat(reread.getOtherExpenseXof()).isEqualTo(90_000L);
    assertThat(reread.getTotalCostXof()).isEqualTo(420_000L);
  }

  @Test
  void close_refusesASecondTime() {
    long unitId = seedUnit();
    unitClosureService.close(farmId, unitId, null, null, userId);
    em.flush();

    assertThatThrownBy(() -> unitClosureService.close(farmId, unitId, null, null, userId))
        .isInstanceOf(ConflictException.class);
  }

  @Test
  void reopen_removesTheReport_andMakesTheUnitActiveAgain() {
    long unitId = seedUnit();
    unitClosureService.close(farmId, unitId, null, null, userId);
    em.flush();

    unitClosureService.reopen(farmId, unitId);
    em.flush();
    em.clear();

    assertThat(unitClosureRepository.findByProductionUnitId(unitId)).isEmpty();
    ProductionUnit unit = productionUnitRepository.findById(unitId).orElseThrow();
    assertThat(unit.getStatus()).isEqualTo(UnitStatus.ACTIVE);
    assertThat(unit.getEndDate()).isNull();
    assertThatThrownBy(() -> unitClosureService.get(farmId, unitId))
        .isInstanceOf(NotFoundException.class);
  }

  @Test
  void unvaluedArticle_isCountedButAddsNothing() {
    long unitId = seedUnit();

    StockItem maize = new StockItem();
    maize.setFarmId(farmId);
    maize.setArticleKey("feed.maize");
    maize.setUnit("kg");
    maize.setCurrentQuantity(new BigDecimal("300"));
    maize.setTypicalUnitPriceXof(null); // never priced
    em.persist(maize);
    em.flush();

    stockMovementService.recordMovement(
        farmId,
        new StockMovementCommand(
            maize.getId(),
            MovementType.OUT,
            new BigDecimal("300"),
            MovementReason.CONSUMPTION_LOT,
            LocalDate.now(),
            unitId,
            null,
            null,
            null,
            null,
            null,
            null),
        userId);
    seedConsumption(unitId);
    em.flush();

    UnitClosure closure = unitClosureService.close(farmId, unitId, null, null, userId);

    assertThat(closure.getFeedCostXof()).isEqualTo(80_000L); // maize adds nothing
    assertThat(closure.getConsumedArticles()).isEqualTo(2);
    assertThat(closure.getValuedArticles()).isEqualTo(1); // and the report says so
  }
}
