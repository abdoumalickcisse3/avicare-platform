package com.avicare.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import com.avicare.common.security.principal.UserRole;
import com.avicare.identity.domain.User;
import com.avicare.livestock.domain.Breed;
import com.avicare.livestock.domain.LifecycleEvent;
import com.avicare.livestock.domain.Species;
import com.avicare.livestock.repository.BreedRepository;
import com.avicare.livestock.repository.LifecycleEventRepository;
import com.avicare.tenancy.domain.Farm;
import jakarta.persistence.EntityManager;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Proves the V5 livestock-socle migration runs on a clean PostgreSQL (on top of V1–V4) and that the
 * livestock JPA mappings agree with the schema (Hibernate {@code ddl-auto=validate}). Checks the
 * breeds seeded from the A4 catalog, a LifecycleEvent round-trip, and that the parent {@code
 * production_units} table exists with its key columns. {@code ProductionUnit} is abstract (its only
 * table is the parent until a species subclass lands in B1), so no instance is persisted here.
 * CI-only on dev machines where Testcontainers can't reach Docker (see project memory).
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers
class LivestockMappingIT {

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

  @Autowired private BreedRepository breedRepository;
  @Autowired private LifecycleEventRepository lifecycleEventRepository;
  @Autowired private EntityManager em;

  @Test
  void poultryBreedsSeededFromCatalog() {
    var poultry = breedRepository.findBySpecies(Species.POULTRY);
    assertThat(poultry).hasSize(5);
    assertThat(poultry).allSatisfy(b -> assertThat(b.getCatalogItemId()).isNotNull());
    assertThat(breedRepository.findBySpeciesAndCodeAndFarmId(Species.POULTRY, "cobb_500", null))
        .isPresent();
  }

  @Test
  void farmCustomBreed_roundTrips() {
    Breed breed = new Breed();
    breed.setSpecies(Species.POULTRY);
    breed.setCode("local_breed");
    breed.setName("Poulet du pays");
    breed.setFarmId(null);
    breed.setGrowthCurve(Map.of("d7", 180, "d35", 1900));
    Long id = breedRepository.saveAndFlush(breed).getId();
    em.clear();

    Breed reloaded = breedRepository.findById(id).orElseThrow();
    assertThat(reloaded.getGrowthCurve()).containsEntry("d7", 180);
    assertThat(reloaded.getCreatedAt()).isNotNull();
  }

  @Test
  void lifecycleEvent_roundTripsWithJsonbDetails() {
    LifecycleEvent event = new LifecycleEvent();
    event.setProductionUnitId(seedProductionUnit()); // satisfy the NOT NULL FK to production_units
    event.setEventType("MORTALITY");
    event.setQuantityDelta(-3);
    event.setReason("heat");
    event.setDetails(Map.of("cause", "heat_stress"));
    Long id = lifecycleEventRepository.saveAndFlush(event).getId();
    em.clear();

    LifecycleEvent reloaded = lifecycleEventRepository.findById(id).orElseThrow();
    assertThat(reloaded.getQuantityDelta()).isEqualTo(-3);
    assertThat(reloaded.getDetails()).containsEntry("cause", "heat_stress");
    assertThat(reloaded.getOccurredAt()).isNotNull();
  }

  /** Insert the minimal user → farm → production_unit chain and return the unit id. */
  private long seedProductionUnit() {
    User u = new User();
    u.setEmail("map" + System.nanoTime() + "@example.com");
    u.setPasswordHash("$2a$12$abcdefghijklmnopqrstuv");
    u.setFullName("MAP");
    u.setRole(UserRole.USER);
    em.persist(u);
    Farm f = new Farm();
    f.setName("Ferme MAP");
    f.setCreatedBy(u.getId());
    em.persist(f);
    em.flush();
    Number unitId =
        (Number)
            em.createNativeQuery(
                    "INSERT INTO production_units (farm_id, species, unit_kind, start_date) "
                        + "VALUES (?, 'POULTRY', 'BATCH', CURRENT_DATE) RETURNING id")
                .setParameter(1, f.getId())
                .getSingleResult();
    return unitId.longValue();
  }

  @Test
  void productionUnitsParentTableExists() {
    Object count =
        em.createNativeQuery(
                "SELECT count(*) FROM information_schema.columns "
                    + "WHERE table_name = 'production_units' "
                    + "AND column_name IN ('species','unit_kind','breed_id','current_count','status')")
            .getSingleResult();
    assertThat(((Number) count).intValue()).isEqualTo(5);
  }
}
