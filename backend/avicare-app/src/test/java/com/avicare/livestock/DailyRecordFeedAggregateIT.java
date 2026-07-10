package com.avicare.livestock;

import static org.assertj.core.api.Assertions.assertThat;

import com.avicare.common.security.principal.UserRole;
import com.avicare.identity.domain.User;
import com.avicare.livestock.domain.DailyRecord;
import com.avicare.livestock.domain.ProductionUnit;
import com.avicare.livestock.domain.Species;
import com.avicare.livestock.domain.UnitKind;
import com.avicare.livestock.domain.UnitStatus;
import com.avicare.livestock.repository.DailyRecordRepository;
import com.avicare.livestock.repository.ProductionUnitRepository;
import com.avicare.tenancy.domain.Farm;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** Slice IT for the farm+period feed aggregates on DailyRecordRepository. CI-only (Docker). */
@DataJpaTest(properties = "spring.jpa.hibernate.ddl-auto=validate")
@Testcontainers
class DailyRecordFeedAggregateIT {

  @Container
  static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

  @DynamicPropertySource
  static void props(DynamicPropertyRegistry r) {
    r.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    r.add("spring.datasource.username", POSTGRES::getUsername);
    r.add("spring.datasource.password", POSTGRES::getPassword);
    r.add("spring.flyway.enabled", () -> "true");
  }

  @Autowired private DailyRecordRepository dailyRecordRepository;
  @Autowired private ProductionUnitRepository productionUnitRepository;
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
    u.setStartDate(LocalDate.now().minusDays(10));
    u.setCurrentCount(100);
    u.setStatus(UnitStatus.ACTIVE);
    return productionUnitRepository.save(u).getId();
  }

  private void record(Long unitId, LocalDate date, String feedKg) {
    DailyRecord d = new DailyRecord();
    d.setProductionUnit(productionUnitRepository.findById(unitId).orElseThrow());
    d.setRecordDate(date);
    d.setMortalityCount(0);
    d.setFeedKg(new BigDecimal(feedKg));
    dailyRecordRepository.save(d);
  }

  @Test
  void sumsFeedAcrossUnits_andCountsDistinctDays() {
    long farmId = seedFarm();
    Long u1 = unit(farmId);
    Long u2 = unit(farmId);
    LocalDate d1 = LocalDate.now().minusDays(1);
    LocalDate d2 = LocalDate.now();
    record(u1, d1, "10");
    record(u2, d1, "5"); // same day, second unit
    record(u1, d2, "12");
    LocalDate from = LocalDate.now().minusDays(6);
    LocalDate to = LocalDate.now();

    assertThat(dailyRecordRepository.sumFeedKgByFarmAndPeriod(farmId, from, to))
        .isEqualByComparingTo("27"); // 10+5+12
    assertThat(dailyRecordRepository.countFeedDaysByFarmAndPeriod(farmId, from, to))
        .isEqualTo(2L); // d1, d2
  }
}
