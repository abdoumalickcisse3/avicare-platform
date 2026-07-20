package com.avicare.livestock;

import static org.assertj.core.api.Assertions.assertThat;

import com.avicare.common.security.principal.UserRole;
import com.avicare.identity.domain.User;
import com.avicare.livestock.domain.LifecycleEvent;
import com.avicare.livestock.domain.ProductionUnit;
import com.avicare.livestock.domain.Species;
import com.avicare.livestock.domain.UnitKind;
import com.avicare.livestock.domain.UnitStatus;
import com.avicare.livestock.domain.WeighingSample;
import com.avicare.livestock.poultry.GrowthAnalysisService;
import com.avicare.livestock.poultry.PoultryBatchCreate;
import com.avicare.livestock.poultry.PoultryBatchService;
import com.avicare.livestock.poultry.WeighingCommand;
import com.avicare.livestock.repository.BreedRepository;
import com.avicare.livestock.repository.ProductionUnitRepository;
import com.avicare.livestock.repository.WeighingSampleRepository;
import com.avicare.livestock.service.LivestockService;
import com.avicare.tenancy.domain.Farm;
import jakarta.persistence.EntityManager;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
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
 * Mobile replay safety (doc 08 §9, V30): a queued mortality or weighing entry replayed with the
 * same {@code clientRef} must apply once, while web writes ({@code clientRef == null}) stay
 * append-only. CI-only on dev machines (Docker incompatibility) — see {@link LivestockFlowIT} and
 * {@link com.avicare.livestock.poultry.GrowthAnalysisServiceIT} for the same pattern.
 */
@SpringBootTest
@Testcontainers
@Transactional
class MobileIdempotencyIT {

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
  @Autowired private GrowthAnalysisService growthAnalysisService;
  @Autowired private PoultryBatchService poultryBatchService;
  @Autowired private ProductionUnitRepository productionUnitRepository;
  @Autowired private WeighingSampleRepository weighingSampleRepository;
  @Autowired private BreedRepository breedRepository;
  @Autowired private EntityManager em;

  private long userId;

  private long seedFarmAndUnit(int count) {
    User u = new User();
    u.setEmail("mi" + System.nanoTime() + "@example.com");
    u.setPasswordHash("$2a$12$abcdefghijklmnopqrstuv");
    u.setFullName("MI");
    u.setRole(UserRole.USER);
    em.persist(u);
    userId = u.getId();
    Farm f = new Farm();
    f.setName("Ferme MI");
    f.setCreatedBy(u.getId());
    em.persist(f);
    em.flush();

    ProductionUnit unit = new ProductionUnit();
    unit.setFarmId(f.getId());
    unit.setSpecies(Species.POULTRY);
    unit.setUnitKind(UnitKind.BATCH);
    unit.setName("Lot MI");
    unit.setStartDate(LocalDate.now());
    unit.setCurrentCount(count);
    unit.setStatus(UnitStatus.ACTIVE);
    return productionUnitRepository.saveAndFlush(unit).getId();
  }

  private long seedBatch(int initialCount) {
    User u = new User();
    u.setEmail("mib" + System.nanoTime() + "@example.com");
    u.setPasswordHash("$2a$12$abcdefghijklmnopqrstuv");
    u.setFullName("MIB");
    u.setRole(UserRole.USER);
    em.persist(u);
    userId = u.getId();
    Farm f = new Farm();
    f.setName("Ferme MIB");
    f.setCreatedBy(u.getId());
    em.persist(f);
    em.flush();

    long breedId =
        breedRepository
            .findBySpeciesAndCodeAndFarmId(Species.POULTRY, "cobb_500", null)
            .orElseThrow()
            .getId();
    long batchId =
        poultryBatchService
            .create(
                new PoultryBatchCreate(
                    f.getId(), breedId, "Lot MIB", LocalDate.now().minusDays(20), 2200, 42,
                    initialCount),
                u.getId())
            .getId();
    em.flush();
    return batchId;
  }

  @Test
  void recordMortality_sameClientRef_appliesOnce() {
    long unitId = seedFarmAndUnit(500);
    UUID ref = UUID.randomUUID();
    int before = livestockService.getUnit(unitId).getCurrentCount();

    LifecycleEvent first = livestockService.recordMortality(unitId, 3, "field", userId, ref);
    LifecycleEvent replay = livestockService.recordMortality(unitId, 3, "field", userId, ref);

    assertThat(replay.getId()).isEqualTo(first.getId());
    assertThat(livestockService.getUnit(unitId).getCurrentCount()).isEqualTo(before - 3);
  }

  @Test
  void recordMortality_nullClientRef_staysAppendOnly() {
    long unitId = seedFarmAndUnit(500);
    int before = livestockService.getUnit(unitId).getCurrentCount();

    livestockService.recordMortality(unitId, 2, "web", userId, null);
    livestockService.recordMortality(unitId, 2, "web", userId, null);

    assertThat(livestockService.getUnit(unitId).getCurrentCount()).isEqualTo(before - 4);
  }

  @Test
  void recordWeighing_sameClientRef_createsOneSample() {
    long batchId = seedBatch(1000);
    UUID ref = UUID.randomUUID();
    WeighingCommand cmd = new WeighingCommand(LocalDate.now(), List.of(1200, 1250, 1180), null);

    WeighingSample first = growthAnalysisService.recordWeighing(batchId, cmd, userId, ref);
    WeighingSample replay = growthAnalysisService.recordWeighing(batchId, cmd, userId, ref);

    assertThat(replay.getId()).isEqualTo(first.getId());
    assertThat(weighingSampleRepository.findByPoultryBatchIdOrderBySampleDateDesc(batchId))
        .hasSize(1);
  }
}
