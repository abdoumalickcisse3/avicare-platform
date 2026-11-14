package com.avicare.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import com.avicare.common.security.principal.UserRole;
import com.avicare.identity.domain.User;
import com.avicare.livestock.domain.Breed;
import com.avicare.livestock.domain.BreedProfile;
import com.avicare.livestock.domain.LifecycleEvent;
import com.avicare.livestock.domain.Species;
import com.avicare.livestock.repository.BreedRepository;
import com.avicare.livestock.repository.LifecycleEventRepository;
import com.avicare.tenancy.domain.Farm;
import jakarta.persistence.EntityManager;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Proves the V5 livestock-socle migration runs on a clean PostgreSQL (on top of V1–V4) and that the
 * livestock JPA mappings agree with the schema (Hibernate {@code ddl-auto=validate}). Checks the
 * seeded platform breeds — the five mirrored from the A4 catalog and the rustic strains V69 seeds
 * directly — a LifecycleEvent round-trip, and that the parent {@code production_units} table exists
 * with its key columns. {@code ProductionUnit} is abstract (its only table is the parent until a
 * species subclass lands in B1), so no instance is persisted here. CI-only on dev machines where
 * Testcontainers can't reach Docker (see project memory).
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

  /**
   * This test used to freeze the count at five and require every breed to carry a catalogue row.
   * V69 seeds the rustic strains straight into {@code breeds} with {@code catalog_item_id NULL}, so
   * both assertions described a schema that no longer exists — and neither was worth keeping: the
   * next spec that adds a strain would break a count assertion while teaching nothing.
   *
   * <p>What must hold is the invariant this sprint exists for: no platform breed without a family.
   * A breed with no profile has no reference curve to serve, which is exactly the silence a farmer
   * met when their typed strain produced no growth curve at all.
   */
  @Test
  void everyPlatformPoultryBreedDeclaresItsFamily() {
    var poultry = breedRepository.findBySpecies(Species.POULTRY);

    assertThat(poultry).isNotEmpty().allSatisfy(b -> assertThat(b.getProfile()).isNotNull());

    // The five V5 breeds still mirror `catalog_items`, and still resolve by code.
    assertThat(breedRepository.findBySpeciesAndCodeAndFarmId(Species.POULTRY, "cobb_500", null))
        .get()
        .satisfies(
            b -> {
              assertThat(b.getCatalogItemId()).isNotNull();
              assertThat(b.getProfile()).isEqualTo(BreedProfile.BROILER_FAST);
            });

    // The rustic strains are seeded directly, carry no catalogue row, and are the reason a rustic
    // flock stops being measured against an industrial curve.
    assertThat(poultry)
        .filteredOn(b -> b.getProfile() == BreedProfile.BROILER_RUSTIC)
        .isNotEmpty()
        .allSatisfy(b -> assertThat(b.getCatalogItemId()).isNull());

    // One code, two families. A farmer raising "locale améliorée" for eggs must be able to pick it
    // too, so `uq_breeds_identity` keeps the profile in the key. A later "cleanup" that narrows
    // that index back to (species, code, farm_id) would silently delete the layer option — this
    // assertion is what stops it.
    assertThat(poultry)
        .filteredOn(b -> "locale_amelioree".equals(b.getCode()))
        .extracting(Breed::getProfile)
        .containsExactlyInAnyOrder(BreedProfile.BROILER_RUSTIC, BreedProfile.LAYER_RUSTIC);
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
