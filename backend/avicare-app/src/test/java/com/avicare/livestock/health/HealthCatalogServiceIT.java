package com.avicare.livestock.health;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.avicare.common.api.exception.NotFoundException;
import com.avicare.support.RsaKeys;
import java.security.KeyPair;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Health catalog reads on a real PostgreSQL (Testcontainers, V1–V12): vaccines, treatments and
 * vaccination programs seeded in V12, filtered by breed and resolved by key. CI-only where Docker
 * is unavailable.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@Testcontainers
class HealthCatalogServiceIT {

  @Container
  static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

  private static final KeyPair KEYS = RsaKeys.generate();

  @DynamicPropertySource
  static void props(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", POSTGRES::getUsername);
    registry.add("spring.datasource.password", POSTGRES::getPassword);
    registry.add("spring.flyway.enabled", () -> "true");
    registry.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
    registry.add("avicare.security.jwt.private-key", () -> RsaKeys.privatePem(KEYS));
    registry.add("avicare.security.jwt.public-key", () -> RsaKeys.publicPem(KEYS));
  }

  @Autowired private HealthCatalogService service;

  private static final Long FARM_ID = 1L;

  @Test
  void listsTheV1Library() {
    assertThat(service.listVaccines(FARM_ID)).hasSize(10);
    assertThat(service.listTreatments(FARM_ID)).hasSize(6);
    assertThat(service.listVaccinationPrograms()).hasSize(4);
  }

  @Test
  void vaccineAndTreatmentFieldsAreParsed() {
    VaccineDto marek =
        service.listVaccines(FARM_ID).stream()
            .filter(v -> v.key().equals("marek_hvt"))
            .findFirst()
            .orElseThrow();
    assertThat(marek.disease()).isEqualTo("Marek");
    assertThat(marek.activeStrain()).isTrue();
    assertThat(marek.usage()).isEqualTo("DAY_OLD");

    TreatmentDto enro =
        service.listTreatments(FARM_ID).stream()
            .filter(t -> t.key().equals("enrofloxacin_10"))
            .findFirst()
            .orElseThrow();
    assertThat(enro.drugClass()).isEqualTo("ANTIBIOTIC");
    assertThat(enro.withdrawalDaysMeat()).isEqualTo(10);
    assertThat(enro.withdrawalDaysEggs()).isEqualTo(14);
    assertThat(enro.routes()).containsExactly("WATER");
  }

  @Test
  void filtersProgramsByBreed() {
    List<VaccinationProgramDto> broiler = service.getVaccinationProgramsForBreed("cobb_500");
    assertThat(broiler)
        .extracting(VaccinationProgramDto::key)
        .containsExactly("broiler_standard_cobb500");

    List<VaccinationProgramDto> layer = service.getVaccinationProgramsForBreed("isa_brown");
    assertThat(layer)
        .extracting(VaccinationProgramDto::key)
        .containsExactly("layer_standard_isabrown");

    assertThat(service.getVaccinationProgramsForBreed("unknown_breed")).isEmpty();
  }

  @Test
  void resolvesProgramWithDeserializedSchedule() {
    VaccinationProgramDto p = service.resolveProgramByKey("layer_standard_isabrown");
    assertThat(p.species()).isEqualTo("POULTRY");
    assertThat(p.breedKeys()).containsExactly("isa_brown");
    assertThat(p.schedule()).hasSize(7);

    VaccinationScheduleEntryDto first = p.schedule().get(0);
    assertThat(first.vaccineKey()).isEqualTo("marek_hvt");
    assertThat(first.ageValue()).isEqualTo(1);
    assertThat(first.ageUnit()).isEqualTo("DAY");
    assertThat(first.mandatory()).isTrue();

    VaccinationScheduleEntryDto last = p.schedule().get(6);
    assertThat(last.ageValue()).isEqualTo(18);
    assertThat(last.ageUnit()).isEqualTo("WEEK");
    assertThat(last.vaccineKey()).isEqualTo("newcastle_la_sota");

    assertThatThrownBy(() -> service.resolveProgramByKey("nope"))
        .isInstanceOf(NotFoundException.class);
  }
}
