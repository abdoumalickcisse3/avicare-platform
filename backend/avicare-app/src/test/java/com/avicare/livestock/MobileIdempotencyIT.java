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
import com.avicare.livestock.repository.LifecycleEventRepository;
import com.avicare.livestock.repository.ProductionUnitRepository;
import com.avicare.livestock.repository.WeighingSampleRepository;
import com.avicare.livestock.service.LivestockService;
import com.avicare.tenancy.domain.Farm;
import jakarta.persistence.EntityManager;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.transaction.TestTransaction;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Mobile replay safety (doc 08 §9, V30): a queued mortality or weighing entry replayed with the
 * same {@code clientRef} must apply once, while web writes ({@code clientRef == null}) stay
 * append-only. CI-only on dev machines (Docker incompatibility) — see {@link LivestockFlowIT} and
 * {@link com.avicare.livestock.poultry.GrowthAnalysisServiceIT} for the same pattern.
 *
 * <p>The two {@code *_concurrentSameClientRef_*} tests below exercise the actual race that the
 * REQUIRES_NEW recovery pattern in {@code LivestockService}/{@code GrowthAnalysisService} exists
 * for: two real threads submit the same replay simultaneously, so the {@code uq_*_client_ref}
 * partial unique index rejects the loser's insert with a {@code DataIntegrityViolationException}
 * instead of both threads simply missing an empty lookup sequentially. Seed data is committed via
 * {@link TestTransaction#flagForCommit()} + {@link TestTransaction#end()} before spawning threads,
 * since a class-level {@code @Transactional} test would otherwise keep the seed invisible (READ
 * COMMITTED) to the worker threads' own connections.
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
  @Autowired private LifecycleEventRepository lifecycleEventRepository;
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
                    f.getId(),
                    breedId,
                    "Lot MIB",
                    LocalDate.now().minusDays(20),
                    2200,
                    42,
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

  /**
   * Two threads replay the same {@code clientRef} at the same instant. Without the REQUIRES_NEW
   * recovery path, the loser's {@code DataIntegrityViolationException} would surface as an
   * unhandled 500 (falls through the generic {@code @ExceptionHandler(Exception.class)}); with the
   * fix, the loser recovers by re-reading the winner's already-committed row in a fresh
   * transaction. Both futures must complete normally (no exception) and agree on one row id.
   */
  @Test
  void recordMortality_concurrentSameClientRef_appliesOnce() throws Exception {
    long unitId = seedFarmAndUnit(500);
    // Commit the seed so the two worker threads (separate connections) can see it — a
    // class-level @Transactional test would otherwise keep it uncommitted and invisible to them.
    TestTransaction.flagForCommit();
    TestTransaction.end();

    UUID ref = UUID.randomUUID();
    CountDownLatch ready = new CountDownLatch(2);
    CountDownLatch go = new CountDownLatch(1);
    Callable<LifecycleEvent> replay =
        () -> {
          ready.countDown();
          go.await();
          return livestockService.recordMortality(unitId, 3, "field-race", userId, ref);
        };

    ExecutorService pool = Executors.newFixedThreadPool(2);
    try {
      Future<LifecycleEvent> f1 = pool.submit(replay);
      Future<LifecycleEvent> f2 = pool.submit(replay);
      ready.await(5, TimeUnit.SECONDS);
      go.countDown();

      LifecycleEvent r1 = f1.get(10, TimeUnit.SECONDS);
      LifecycleEvent r2 = f2.get(10, TimeUnit.SECONDS);

      assertThat(r1.getId()).isEqualTo(r2.getId());
    } finally {
      pool.shutdown();
    }

    TestTransaction.start();
    assertThat(lifecycleEventRepository.findByProductionUnitId(unitId)).hasSize(1);
    assertThat(livestockService.getUnit(unitId).getCurrentCount()).isEqualTo(497);
  }

  /** Same race as {@link #recordMortality_concurrentSameClientRef_appliesOnce}, for weighings. */
  @Test
  void recordWeighing_concurrentSameClientRef_createsOneSample() throws Exception {
    long batchId = seedBatch(1000);
    TestTransaction.flagForCommit();
    TestTransaction.end();

    UUID ref = UUID.randomUUID();
    WeighingCommand cmd = new WeighingCommand(LocalDate.now(), List.of(1200, 1250, 1180), null);
    CountDownLatch ready = new CountDownLatch(2);
    CountDownLatch go = new CountDownLatch(1);
    Callable<WeighingSample> replay =
        () -> {
          ready.countDown();
          go.await();
          return growthAnalysisService.recordWeighing(batchId, cmd, userId, ref);
        };

    ExecutorService pool = Executors.newFixedThreadPool(2);
    try {
      Future<WeighingSample> f1 = pool.submit(replay);
      Future<WeighingSample> f2 = pool.submit(replay);
      ready.await(5, TimeUnit.SECONDS);
      go.countDown();

      WeighingSample r1 = f1.get(10, TimeUnit.SECONDS);
      WeighingSample r2 = f2.get(10, TimeUnit.SECONDS);

      assertThat(r1.getId()).isEqualTo(r2.getId());
    } finally {
      pool.shutdown();
    }

    TestTransaction.start();
    assertThat(weighingSampleRepository.findByPoultryBatchIdOrderBySampleDateDesc(batchId))
        .hasSize(1);
  }
}
