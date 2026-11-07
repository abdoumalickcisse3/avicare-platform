package com.avicare.livestock;

import static org.assertj.core.api.Assertions.assertThat;

import com.avicare.livestock.domain.Breed;
import com.avicare.livestock.domain.BreedProfile;
import com.avicare.livestock.domain.Species;
import com.avicare.livestock.repository.BreedRepository;
import com.avicare.parameters.repository.CatalogItemRepository;
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
 * Proves the V69 migration (profil de production des souches) : la colonne {@code profile} existe
 * et est renseignée pour les souches semées, l'unicité par expression remplace la contrainte V5
 * sans rien casser, et le catalogue {@code breed_profiles} porte les quatre profils. Patron de
 * {@link com.avicare.persistence.LivestockMappingIT}. CI-only sur cette machine (Testcontainers
 * indisponible, cf. mémoire projet).
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers
class BreedProfileMigrationIT {

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
  @Autowired private CatalogItemRepository catalogItemRepository;

  private Breed byCode(String code) {
    return breedRepository.findBySpecies(Species.POULTRY).stream()
        .filter(b -> code.equals(b.getCode()) && b.getFarmId() == null)
        .findFirst()
        .orElseThrow();
  }

  @Test
  void les_cinq_souches_semees_portent_un_profil() {
    assertThat(breedRepository.findBySpecies(Species.POULTRY))
        .filteredOn(b -> b.getFarmId() == null)
        .allSatisfy(b -> assertThat(b.getProfile()).isNotNull());
  }

  @Test
  void cobb_est_rapide_et_isa_brown_est_industrielle() {
    assertThat(byCode("cobb_500").getProfile()).isEqualTo(BreedProfile.BROILER_FAST);
    assertThat(byCode("isa_brown").getProfile()).isEqualTo(BreedProfile.LAYER_INDUSTRIAL);
  }

  @Test
  void goliath_et_kuroiler_sont_au_catalogue_en_chair_rustique() {
    assertThat(byCode("goliath").getProfile()).isEqualTo(BreedProfile.BROILER_RUSTIC);
    assertThat(byCode("kuroiler").getType()).isEqualTo("broiler");
  }

  @Test
  void locale_amelioree_existe_en_chair_et_en_ponte_sous_le_meme_code() {
    assertThat(breedRepository.findBySpecies(Species.POULTRY))
        .filteredOn(b -> "locale_amelioree".equals(b.getCode()))
        .extracting(Breed::getProfile)
        .containsExactlyInAnyOrder(BreedProfile.BROILER_RUSTIC, BreedProfile.LAYER_RUSTIC);
  }

  @Test
  void les_quatre_profils_sont_parametres_au_catalogue() {
    assertThat(catalogItemRepository.findByCategory("breed_profiles")).hasSize(4);
  }
}
