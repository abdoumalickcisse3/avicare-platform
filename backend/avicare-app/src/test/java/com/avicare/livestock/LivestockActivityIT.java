package com.avicare.livestock;

import static org.assertj.core.api.Assertions.assertThat;

import com.avicare.common.api.dto.ActivityItem;
import com.avicare.common.security.principal.UserRole;
import com.avicare.identity.domain.User;
import com.avicare.livestock.api.LivestockFacade;
import com.avicare.livestock.domain.LifecycleEvent;
import com.avicare.livestock.domain.MovementReason;
import com.avicare.livestock.domain.MovementType;
import com.avicare.livestock.domain.ProductionUnit;
import com.avicare.livestock.domain.Species;
import com.avicare.livestock.domain.StockItem;
import com.avicare.livestock.domain.StockMovement;
import com.avicare.livestock.domain.UnitKind;
import com.avicare.livestock.domain.UnitStatus;
import com.avicare.livestock.repository.LifecycleEventRepository;
import com.avicare.livestock.repository.ProductionUnitRepository;
import com.avicare.livestock.repository.StockItemRepository;
import com.avicare.livestock.repository.StockMovementRepository;
import com.avicare.tenancy.domain.Farm;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** Verifies LivestockFacade.recentActivity whitelist + ordering on a real DB. CI-only. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@Testcontainers
class LivestockActivityIT {

  @Container
  static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

  @DynamicPropertySource
  static void props(DynamicPropertyRegistry r) {
    r.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    r.add("spring.datasource.username", POSTGRES::getUsername);
    r.add("spring.datasource.password", POSTGRES::getPassword);
    r.add("spring.flyway.enabled", () -> "true");
    r.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
  }

  @Autowired private LivestockFacade livestockFacade;
  @Autowired private ProductionUnitRepository productionUnitRepository;
  @Autowired private LifecycleEventRepository lifecycleEventRepository;
  @Autowired private StockItemRepository stockItemRepository;
  @Autowired private StockMovementRepository stockMovementRepository;
  @Autowired private EntityManager em;

  private long seedFarm() {
    User u = new User();
    u.setEmail("seed" + System.nanoTime() + "@example.com");
    u.setPasswordHash("$2a$12$abcdefghijklmnopqrstuv");
    u.setFullName("Seed");
    u.setRole(UserRole.USER);
    em.persist(u);
    Farm f = new Farm();
    f.setName("Ferme seed");
    f.setCreatedBy(u.getId());
    em.persist(f);
    em.flush();
    return f.getId();
  }

  private Long unit(long farmId) {
    ProductionUnit u = new ProductionUnit();
    u.setFarmId(farmId);
    u.setSpecies(Species.POULTRY);
    u.setUnitKind(UnitKind.BATCH);
    u.setName("Lot");
    u.setStartDate(java.time.LocalDate.now().minusDays(5));
    u.setCurrentCount(100);
    u.setStatus(UnitStatus.ACTIVE);
    return productionUnitRepository.save(u).getId();
  }

  private void event(Long unitId, String type, int delta) {
    LifecycleEvent e = new LifecycleEvent();
    e.setProductionUnitId(unitId);
    e.setEventType(type);
    e.setQuantityDelta(delta);
    lifecycleEventRepository.save(e);
  }

  private Long stockMovement(long farmId, LocalDate movementDate) {
    StockItem item = new StockItem();
    item.setFarmId(farmId);
    item.setArticleKey("feed_starter_broiler");
    item = stockItemRepository.save(item);

    StockMovement movement = new StockMovement();
    movement.setStockItem(item);
    movement.setMovementType(MovementType.IN);
    movement.setMovementDate(movementDate);
    movement.setQuantity(new BigDecimal("50"));
    movement.setQuantityBefore(BigDecimal.ZERO);
    movement.setQuantityAfter(new BigDecimal("50"));
    movement.setReason(MovementReason.RECEPTION_PURCHASE);
    return stockMovementRepository.save(movement).getId();
  }

  @Test
  void recentActivity_whitelistsMeaningfulEvents_andExcludesGuards() {
    long farmId = seedFarm();
    Long unitId = unit(farmId);
    event(unitId, "MORTALITY", -5);
    event(unitId, "VET_VISIT_RECORDED", 0);
    event(unitId, "INVALID_MORTALITY_COUNT", 0); // guard marker → excluded
    event(unitId, "DAILY_RECORD", 0); // noisy → excluded (not in whitelist)

    List<ActivityItem> items = livestockFacade.recentActivity(farmId, 20);

    assertThat(items)
        .extracting(ActivityItem::kind)
        .contains("MORTALITY", "VET_VISIT_RECORDED")
        .doesNotContain("INVALID_MORTALITY_COUNT", "DAILY_RECORD");
    assertThat(items)
        .extracting(ActivityItem::label)
        .anyMatch(l -> l.equals("Mortalité : 5 sujets"));
  }

  @Test
  void recentActivity_mergesStockMovements_andSortsMostRecentFirst() {
    long farmId = seedFarm();
    Long unitId = unit(farmId);
    // lifecycle events land "now" (occurred_at is DB-defaulted to NOW()).
    event(unitId, "MORTALITY", -3);
    event(unitId, "VET_VISIT_RECORDED", 0);
    // stock movement dated clearly in the future so it is unambiguously the most recent entry.
    stockMovement(farmId, LocalDate.now().plusDays(2));

    List<ActivityItem> items = livestockFacade.recentActivity(farmId, 20);

    assertThat(items).extracting(ActivityItem::kind).anyMatch(k -> k.startsWith("STOCK_"));
    assertThat(items).isSortedAccordingTo(Comparator.comparing(ActivityItem::at).reversed());
    assertThat(items.get(0).kind()).isEqualTo("STOCK_IN");
  }
}
