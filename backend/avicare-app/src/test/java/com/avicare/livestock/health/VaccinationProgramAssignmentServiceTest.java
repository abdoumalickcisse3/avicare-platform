package com.avicare.livestock.health;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.avicare.livestock.domain.ProductionUnit;
import com.avicare.livestock.domain.Vaccination;
import com.avicare.livestock.domain.VaccinationProgramLot;
import com.avicare.livestock.repository.LifecycleEventRepository;
import com.avicare.livestock.repository.VaccinationProgramLotRepository;
import com.avicare.livestock.repository.VaccinationRepository;
import com.avicare.livestock.service.LivestockService;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

/**
 * Unit test for {@link VaccinationProgramAssignmentService#computeScheduleStatus} — the critical
 * DONE/LATE/UPCOMING logic (all collaborators mocked). Runs in surefire/CI (no Docker).
 */
class VaccinationProgramAssignmentServiceTest {

  private VaccinationProgramLotRepository programLotRepository;
  private VaccinationRepository vaccinationRepository;
  private LivestockService livestockService;
  private HealthCatalogService healthCatalogService;
  private VaccinationProgramAssignmentService service;

  @BeforeEach
  void setUp() {
    programLotRepository = Mockito.mock(VaccinationProgramLotRepository.class);
    vaccinationRepository = Mockito.mock(VaccinationRepository.class);
    livestockService = Mockito.mock(LivestockService.class);
    healthCatalogService = Mockito.mock(HealthCatalogService.class);
    service =
        new VaccinationProgramAssignmentService(
            programLotRepository,
            vaccinationRepository,
            Mockito.mock(LifecycleEventRepository.class),
            livestockService,
            healthCatalogService);
  }

  private static VaccinationScheduleEntryDto entry(int day, String key) {
    return new VaccinationScheduleEntryDto(day, "DAY", key, "WATER", false);
  }

  private static Vaccination done(String key) {
    Vaccination v = new Vaccination();
    v.setVaccineKey(key);
    return v;
  }

  @Test
  void computesDoneLateUpcoming() {
    long unitId = 9L;
    // Unit started 28 days ago → J28 falls exactly today.
    ProductionUnit unit = new ProductionUnit();
    unit.setStartDate(LocalDate.now().minusDays(28));
    when(livestockService.getUnit(unitId)).thenReturn(unit);

    VaccinationProgramLot lot = new VaccinationProgramLot();
    lot.setProgramKey("broiler_standard_cobb500");
    when(programLotRepository.findByProductionUnitId(unitId)).thenReturn(Optional.of(lot));

    when(healthCatalogService.resolveProgramByKey("broiler_standard_cobb500"))
        .thenReturn(
            new VaccinationProgramDto(
                "broiler_standard_cobb500",
                "Cobb 500",
                "POULTRY",
                List.of("cobb_500"),
                List.of(
                    entry(1, "marek_hvt"),
                    entry(7, "newcastle_la_sota"),
                    entry(14, "gumboro_d78"),
                    entry(21, "newcastle_clone30"),
                    entry(28, "gumboro_228e"))));

    // J7 and J14 administered.
    when(vaccinationRepository.findByProductionUnitIdOrderByAdministeredDateDesc(unitId))
        .thenReturn(List.of(done("newcastle_la_sota"), done("gumboro_d78")));

    List<ScheduleStatusDto> status = service.computeScheduleStatus(unitId);

    assertThat(status).hasSize(5);
    assertThat(status)
        .extracting(ScheduleStatusDto::vaccineKey, ScheduleStatusDto::status)
        .containsExactly(
            org.assertj.core.groups.Tuple.tuple("marek_hvt", ScheduleStatusDto.Status.LATE),
            org.assertj.core.groups.Tuple.tuple("newcastle_la_sota", ScheduleStatusDto.Status.DONE),
            org.assertj.core.groups.Tuple.tuple("gumboro_d78", ScheduleStatusDto.Status.DONE),
            org.assertj.core.groups.Tuple.tuple("newcastle_clone30", ScheduleStatusDto.Status.LATE),
            org.assertj.core.groups.Tuple.tuple("gumboro_228e", ScheduleStatusDto.Status.UPCOMING));
  }

  @Test
  void noProgramAssigned_returnsEmpty() {
    when(programLotRepository.findByProductionUnitId(1L)).thenReturn(Optional.empty());
    assertThat(service.computeScheduleStatus(1L)).isEmpty();
  }
}
