package com.avicare.livestock.health;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import com.avicare.common.api.exception.NotFoundException;
import com.avicare.parameters.api.ParametersFacade;
import com.avicare.parameters.api.dto.CatalogEntryInfo;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

/**
 * Unit test for {@link HealthCatalogService} JSON→DTO mapping (facade mocked). Runs in surefire
 * (CI) — unlike the Testcontainers {@code HealthCatalogServiceIT}, which needs Docker.
 */
class HealthCatalogServiceTest {

  private ParametersFacade facade;
  private HealthCatalogService service;

  @BeforeEach
  void setUp() {
    facade = Mockito.mock(ParametersFacade.class);
    service = new HealthCatalogService(facade);
  }

  private static CatalogEntryInfo entry(String key, Map<String, Object> value) {
    return new CatalogEntryInfo("x", key, value, false);
  }

  @Test
  void parsesVaccineFields() {
    when(facade.listPlatform("vaccines"))
        .thenReturn(
            List.of(
                entry(
                    "marek_hvt",
                    Map.of(
                        "label", "Marek HVT",
                        "disease", "Marek",
                        "route", "INJECTION",
                        "active_strain", true,
                        "usage", "DAY_OLD",
                        "wave", "V1"))));

    VaccineDto v = service.listVaccines().get(0);
    assertThat(v.key()).isEqualTo("marek_hvt");
    assertThat(v.disease()).isEqualTo("Marek");
    assertThat(v.route()).isEqualTo("INJECTION");
    assertThat(v.activeStrain()).isTrue();
    assertThat(v.usage()).isEqualTo("DAY_OLD");
  }

  @Test
  void parsesTreatmentFieldsAndRoutes() {
    when(facade.listPlatform("treatments"))
        .thenReturn(
            List.of(
                entry(
                    "enrofloxacin_10",
                    Map.of(
                        "label",
                        "Enrofloxacine 10%",
                        "molecule",
                        "Enrofloxacine",
                        "class",
                        "ANTIBIOTIC",
                        "withdrawal_days_meat",
                        10,
                        "withdrawal_days_eggs",
                        14,
                        "routes",
                        List.of("WATER")))));

    TreatmentDto t = service.listTreatments().get(0);
    assertThat(t.drugClass()).isEqualTo("ANTIBIOTIC");
    assertThat(t.withdrawalDaysMeat()).isEqualTo(10);
    assertThat(t.withdrawalDaysEggs()).isEqualTo(14);
    assertThat(t.routes()).containsExactly("WATER");
  }

  @Test
  void parsesProgramScheduleWithGenericAge() {
    when(facade.listPlatform("vaccination_programs"))
        .thenReturn(List.of(entry("layer_standard_isabrown", layerProgramValue())));

    VaccinationProgramDto p = service.resolveProgramByKey("layer_standard_isabrown");
    assertThat(p.breedKeys()).containsExactly("isa_brown");
    assertThat(p.schedule()).hasSize(2);

    VaccinationScheduleEntryDto day1 = p.schedule().get(0);
    assertThat(day1.vaccineKey()).isEqualTo("marek_hvt");
    assertThat(day1.ageValue()).isEqualTo(1);
    assertThat(day1.ageUnit()).isEqualTo("DAY");
    assertThat(day1.mandatory()).isTrue();

    VaccinationScheduleEntryDto wk6 = p.schedule().get(1);
    assertThat(wk6.ageValue()).isEqualTo(6);
    assertThat(wk6.ageUnit()).isEqualTo("WEEK");
    assertThat(wk6.mandatory()).isFalse();
  }

  @Test
  void filtersProgramsByBreed() {
    when(facade.listPlatform("vaccination_programs"))
        .thenReturn(List.of(entry("layer_standard_isabrown", layerProgramValue())));

    assertThat(service.getVaccinationProgramsForBreed("isa_brown")).hasSize(1);
    assertThat(service.getVaccinationProgramsForBreed("cobb_500")).isEmpty();
  }

  @Test
  void unknownProgram_throwsNotFound() {
    when(facade.listPlatform("vaccination_programs")).thenReturn(List.of());
    assertThatThrownBy(() -> service.resolveProgramByKey("nope"))
        .isInstanceOf(NotFoundException.class);
  }

  private static Map<String, Object> layerProgramValue() {
    return Map.of(
        "label",
        "Programme Ponte Standard - ISA Brown",
        "species",
        "POULTRY",
        "breed_keys",
        List.of("isa_brown"),
        "schedule",
        List.of(
            Map.of(
                "age",
                Map.of("value", 1, "unit", "DAY"),
                "vaccine_key",
                "marek_hvt",
                "route",
                "INJECTION",
                "mandatory",
                true),
            Map.of(
                "age", Map.of("value", 6, "unit", "WEEK"),
                "vaccine_key", "newcastle_clone30",
                "route", "WATER")));
  }
}
