package com.avicare.livestock.poultry;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.avicare.common.api.exception.NotFoundException;
import com.avicare.common.security.principal.UserRole;
import com.avicare.identity.domain.User;
import com.avicare.livestock.domain.PoultryBatch;
import com.avicare.livestock.domain.Species;
import com.avicare.livestock.domain.UnitStatus;
import com.avicare.livestock.repository.BreedRepository;
import com.avicare.livestock.repository.LifecycleEventRepository;
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
 * Integration test for {@link PoultryBatchService} on a real PostgreSQL (Testcontainers, V1–V6).
 * Proves a broiler batch persists across the JOINED parent + child tables, seeds the count and
 * journals a CREATED event. CI-only on dev machines where Docker is unavailable.
 */
@SpringBootTest
@Testcontainers
@Transactional
class PoultryBatchServiceIT {

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

  @Autowired private PoultryBatchService poultryBatchService;
  @Autowired private LivestockService livestockService;
  @Autowired private BreedRepository breedRepository;
  @Autowired private LifecycleEventRepository lifecycleEventRepository;
  @Autowired private EntityManager em;

  private long userId;

  private long cobbBreedId() {
    return breedRepository
        .findBySpeciesAndCodeAndFarmId(Species.POULTRY, "cobb_500", null)
        .orElseThrow()
        .getId();
  }

  private long seedFarm() {
    User u = new User();
    u.setEmail("pb@example.com");
    u.setPasswordHash("$2a$12$abcdefghijklmnopqrstuv");
    u.setFullName("PB");
    u.setRole(UserRole.USER);
    em.persist(u);
    userId = u.getId();
    Farm f = new Farm();
    f.setName("Ferme PB");
    f.setCreatedBy(u.getId());
    em.persist(f);
    em.flush();
    return f.getId();
  }

  @Test
  void create_persistsBatch_seedsCount_andJournalsCreatedEvent() {
    long farmId = seedFarm();

    PoultryBatch batch =
        poultryBatchService.create(
            new PoultryBatchCreate(farmId, cobbBreedId(), "Lot A", LocalDate.now(), 2200, 42, 1000),
            userId);
    Long id = batch.getId();
    em.flush();
    em.clear();

    PoultryBatch reloaded = poultryBatchService.get(id);
    assertThat(reloaded.getInitialCount()).isEqualTo(1000);
    assertThat(reloaded.getCurrentCount()).isEqualTo(1000);
    assertThat(reloaded.getStatus()).isEqualTo(UnitStatus.ACTIVE);
    assertThat(reloaded.getSpecies()).isEqualTo(Species.POULTRY);
    assertThat(reloaded.getBreed().getCode()).isEqualTo("cobb_500");
    // parent column also set so the transverse ProductionUnitResponse stays consistent
    assertThat(reloaded.getBreedId()).isEqualTo(cobbBreedId());

    var events = lifecycleEventRepository.findByProductionUnitId(id);
    assertThat(events).hasSize(1);
    assertThat(events.get(0).getEventType()).isEqualTo(PoultryBatchService.EVENT_CREATED);
    assertThat(events.get(0).getQuantityDelta()).isEqualTo(1000);
  }

  @Test
  void list_filtersByFarmAndStatus_andGetThrowsForUnknown() {
    long farmId = seedFarm();
    poultryBatchService.create(
        new PoultryBatchCreate(farmId, cobbBreedId(), "Lot B", LocalDate.now(), null, null, 500),
        userId);
    em.flush();
    em.clear();

    assertThat(poultryBatchService.list(farmId, null)).hasSize(1);
    assertThat(poultryBatchService.list(farmId, UnitStatus.ACTIVE)).hasSize(1);
    assertThat(poultryBatchService.list(farmId, UnitStatus.CLOSED)).isEmpty();

    assertThatThrownBy(() -> poultryBatchService.get(999_999L))
        .isInstanceOf(NotFoundException.class);
  }

  @Test
  void create_rejectsNonPoultryBreed() {
    long farmId = seedFarm();
    // No OVINE breed is seeded, so create one to exercise the species guard.
    com.avicare.livestock.domain.Breed ovine = new com.avicare.livestock.domain.Breed();
    ovine.setSpecies(Species.OVINE);
    ovine.setCode("ladoum");
    ovine.setName("Ladoum");
    long ovineId = breedRepository.saveAndFlush(ovine).getId();

    assertThatThrownBy(
            () ->
                poultryBatchService.create(
                    new PoultryBatchCreate(farmId, ovineId, "Lot", LocalDate.now(), null, null, 10),
                    userId))
        .hasMessageContaining("POULTRY");
  }
}
