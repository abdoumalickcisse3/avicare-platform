package com.avicare.livestock;

import static com.avicare.livestock.domain.BreedProfile.BROILER_RUSTIC;
import static com.avicare.livestock.domain.BreedProfile.LAYER_RUSTIC;
import static com.avicare.livestock.domain.Species.POULTRY;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.avicare.common.api.exception.ValidationException;
import com.avicare.livestock.domain.Breed;
import com.avicare.livestock.repository.BreedRepository;
import com.avicare.livestock.service.BreedWriteService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Proves the write path for a farmer-declared breed (spec locale-ameliorees, Tâche 2) on a real
 * PostgreSQL (Testcontainers, migrations V1–V69+): dedup against the platform set first, then
 * against the declaring farm's own custom breeds, never against another farm's; the same code can
 * exist twice under two different profiles (V69); an empty-after-slug name is refused.
 *
 * <p>CI-only — Testcontainers can't run on this dev machine (Docker 29.x incompatibility, see
 * project memory). Written and reviewed, verification deferred to CI.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers
@Import(BreedWriteService.class)
class BreedWriteServiceIT {

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

  @Autowired private BreedWriteService service;
  @Autowired private BreedRepository breedRepository;

  private static final long FARM_A = 101L;
  private static final long FARM_B = 202L;

  @Test
  void une_souche_declaree_est_visible_par_la_ferme() {
    Breed declared = service.declare(FARM_A, POULTRY, "Souche de la ferme A", BROILER_RUSTIC);

    List<Breed> visible = breedRepository.findVisible(POULTRY, List.of(FARM_A), true);

    assertThat(visible).extracting(Breed::getCode).contains(declared.getCode());
  }

  @Test
  void un_nom_deja_au_catalogue_plateforme_renvoie_la_ligne_plateforme() {
    Breed b = service.declare(FARM_A, POULTRY, "Goliath", BROILER_RUSTIC);

    assertThat(b.getFarmId()).isNull();
    assertThat(b.getCode()).isEqualTo("goliath");
  }

  @Test
  void le_meme_nom_sous_deux_profils_donne_deux_souches() {
    Breed chair = service.declare(FARM_A, POULTRY, "Ma race", BROILER_RUSTIC);
    Breed ponte = service.declare(FARM_A, POULTRY, "Ma race", LAYER_RUSTIC);

    assertThat(ponte.getId()).isNotEqualTo(chair.getId());
    assertThat(chair.getType()).isEqualTo("broiler");
    assertThat(ponte.getType()).isEqualTo("layer");
  }

  @Test
  void une_seconde_declaration_identique_ne_cree_rien() {
    Breed first = service.declare(FARM_A, POULTRY, "Souche répétée", BROILER_RUSTIC);
    Breed second = service.declare(FARM_A, POULTRY, "Souche répétée", BROILER_RUSTIC);

    assertThat(second.getId()).isEqualTo(first.getId());
  }

  @Test
  void un_nom_vide_apres_slug_est_refuse() {
    assertThatThrownBy(() -> service.declare(FARM_A, POULTRY, "— ??? —", BROILER_RUSTIC))
        .isInstanceOf(ValidationException.class);
  }

  @Test
  void la_souche_dune_autre_ferme_nest_jamais_reutilisee() {
    Breed existing = new Breed();
    existing.setSpecies(POULTRY);
    existing.setCode("ma_race");
    existing.setName("Ma race");
    existing.setType("broiler");
    existing.setProfile(BROILER_RUSTIC);
    existing.setFarmId(FARM_B);
    existing.setActive(true);
    breedRepository.save(existing);

    Breed declared = service.declare(FARM_A, POULTRY, "Ma race", BROILER_RUSTIC);

    assertThat(declared.getFarmId()).isEqualTo(FARM_A);
    assertThat(declared.getId()).isNotEqualTo(existing.getId());
  }

  @Test
  void un_farm_id_nul_cree_une_souche_plateforme() {
    Breed declared = service.declare(null, POULTRY, "Souche plateforme déclarée", BROILER_RUSTIC);

    assertThat(declared.getFarmId()).isNull();

    Breed again = service.declare(null, POULTRY, "Souche plateforme déclarée", BROILER_RUSTIC);
    assertThat(again.getId()).isEqualTo(declared.getId());
  }
}
