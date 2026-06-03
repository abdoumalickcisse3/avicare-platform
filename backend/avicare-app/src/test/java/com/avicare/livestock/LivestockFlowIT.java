package com.avicare.livestock;

import static org.assertj.core.api.Assertions.assertThat;

import com.avicare.common.security.principal.UserRole;
import com.avicare.identity.domain.User;
import com.avicare.livestock.domain.ProductionUnit;
import com.avicare.livestock.domain.Species;
import com.avicare.livestock.domain.UnitKind;
import com.avicare.livestock.domain.UnitStatus;
import com.avicare.livestock.repository.ProductionUnitRepository;
import com.avicare.livestock.service.LivestockService;
import com.avicare.tenancy.domain.Farm;
import jakarta.persistence.EntityManager;
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
 * End-to-end transverse-livestock flow on a real PostgreSQL (Testcontainers): persist a production
 * unit (now concrete), record mortality (decrements the count + journals a MORTALITY event), then
 * close it. Proves the species-agnostic socle works on the parent table before any species subclass
 * exists. CI-only on dev machines (Docker incompatibility).
 */
@SpringBootTest
@Testcontainers
@Transactional
class LivestockFlowIT {

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

  @Autowired private LivestockService livestockService;
  @Autowired private ProductionUnitRepository productionUnitRepository;
  @Autowired private EntityManager em;

  private long seedFarmAndUnit(int count) {
    User u = new User();
    u.setEmail("ls@example.com");
    u.setPasswordHash("$2a$12$abcdefghijklmnopqrstuv");
    u.setFullName("LS");
    u.setRole(UserRole.USER);
    em.persist(u);
    Farm f = new Farm();
    f.setName("Ferme LS");
    f.setCreatedBy(u.getId());
    em.persist(f);
    em.flush();

    ProductionUnit unit = new ProductionUnit();
    unit.setFarmId(f.getId());
    unit.setSpecies(Species.POULTRY);
    unit.setUnitKind(UnitKind.BATCH);
    unit.setName("Lot 1");
    unit.setStartDate(LocalDate.now());
    unit.setCurrentCount(count);
    unit.setStatus(UnitStatus.ACTIVE);
    return productionUnitRepository.saveAndFlush(unit).getId();
  }

  @Test
  void recordMortality_decrementsCount_andCloseUnit() {
    long unitId = seedFarmAndUnit(500);

    livestockService.recordMortality(unitId, 15, "heat_stress", 1L);
    em.flush();
    em.clear();

    ProductionUnit reloaded = productionUnitRepository.findById(unitId).orElseThrow();
    assertThat(reloaded.getCurrentCount()).isEqualTo(485);
    assertThat(livestockService.listEvents(unitId)).hasSize(1);
    assertThat(livestockService.listEvents(unitId).get(0).getEventType())
        .isEqualTo(LivestockService.EVENT_MORTALITY);

    livestockService.closeUnit(unitId);
    em.flush();
    em.clear();

    assertThat(productionUnitRepository.findById(unitId).orElseThrow().getStatus())
        .isEqualTo(UnitStatus.CLOSED);
  }

  @Test
  void softDeletedUnit_isHiddenFromReads() {
    long unitId = seedFarmAndUnit(10);
    productionUnitRepository.delete(productionUnitRepository.findById(unitId).orElseThrow());
    productionUnitRepository.flush();
    em.clear();

    assertThat(productionUnitRepository.findById(unitId)).isEmpty();
  }
}
