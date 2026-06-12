package com.avicare.livestock.health;

import com.avicare.common.api.exception.NotFoundException;
import com.avicare.livestock.domain.LifecycleEvent;
import com.avicare.livestock.domain.ProductionUnit;
import com.avicare.livestock.domain.Vaccination;
import com.avicare.livestock.domain.VaccinationProgramLot;
import com.avicare.livestock.repository.LifecycleEventRepository;
import com.avicare.livestock.repository.VaccinationProgramLotRepository;
import com.avicare.livestock.repository.VaccinationRepository;
import com.avicare.livestock.service.LivestockService;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Assignment of a standard vaccination program to a unit and the computation of its schedule status
 * (Sprint B3-2). One program per unit (upsert). {@link #computeScheduleStatus} compares the catalog
 * program's schedule (due date = {@code unit.startDate + age}) against the recorded vaccinations to
 * flag each step DONE / LATE / UPCOMING. {@code schedule_overrides} is stored but not yet applied
 * here (B3-3+).
 */
@Service
@RequiredArgsConstructor
public class VaccinationProgramAssignmentService {

  public static final String EVENT_PROGRAM_ASSIGNED = "PROGRAM_ASSIGNED";
  public static final String EVENT_PROGRAM_REMOVED = "PROGRAM_REMOVED";

  private final VaccinationProgramLotRepository programLotRepository;
  private final VaccinationRepository vaccinationRepository;
  private final LifecycleEventRepository lifecycleEventRepository;
  private final LivestockService livestockService;
  private final HealthCatalogService healthCatalogService;

  /** Assign (or replace) the unit's vaccination program. Validates the key against the catalog. */
  @Transactional
  public VaccinationProgramLot assignProgram(Long unitId, String programKey, Long userId) {
    ProductionUnit unit = livestockService.getUnit(unitId); // 404 if missing
    healthCatalogService.resolveProgramByKey(programKey); // 404 if unknown program

    VaccinationProgramLot lot =
        programLotRepository.findByProductionUnitId(unitId).orElseGet(VaccinationProgramLot::new);
    lot.setProductionUnit(unit);
    lot.setProgramKey(programKey);
    lot.setAssignedBy(userId);
    VaccinationProgramLot saved = programLotRepository.save(lot);

    journal(unitId, EVENT_PROGRAM_ASSIGNED, programKey, userId);
    return saved;
  }

  /** Remove the unit's assigned program (404 if none). */
  @Transactional
  public void removeProgram(Long unitId, Long userId) {
    VaccinationProgramLot lot =
        programLotRepository
            .findByProductionUnitId(unitId)
            .orElseThrow(
                () ->
                    new NotFoundException(
                        "NO_PROGRAM_ASSIGNED", "No program assigned to unit " + unitId));
    programLotRepository.delete(lot);
    journal(unitId, EVENT_PROGRAM_REMOVED, lot.getProgramKey(), userId);
  }

  @Transactional(readOnly = true)
  public Optional<VaccinationProgramLot> getAssignedProgram(Long unitId) {
    return programLotRepository.findByProductionUnitId(unitId);
  }

  /**
   * Status of every scheduled vaccine for the unit's assigned program. Empty if no program is
   * assigned. Due date is {@code unit.startDate + age}; a step is DONE when a vaccination with the
   * same key exists, LATE when its due date is strictly before today, UPCOMING otherwise.
   */
  @Transactional(readOnly = true)
  public List<ScheduleStatusDto> computeScheduleStatus(Long unitId) {
    Optional<VaccinationProgramLot> assigned = programLotRepository.findByProductionUnitId(unitId);
    if (assigned.isEmpty()) {
      return List.of();
    }
    ProductionUnit unit = livestockService.getUnit(unitId);
    VaccinationProgramDto program =
        healthCatalogService.resolveProgramByKey(assigned.get().getProgramKey());

    Set<String> done =
        vaccinationRepository.findByProductionUnitIdOrderByAdministeredDateDesc(unitId).stream()
            .map(Vaccination::getVaccineKey)
            .collect(Collectors.toSet());
    LocalDate today = LocalDate.now();

    return program.schedule().stream()
        .map(
            e -> {
              LocalDate due = dueDate(unit.getStartDate(), e.ageValue(), e.ageUnit());
              ScheduleStatusDto.Status status =
                  done.contains(e.vaccineKey())
                      ? ScheduleStatusDto.Status.DONE
                      : due.isBefore(today)
                          ? ScheduleStatusDto.Status.LATE
                          : ScheduleStatusDto.Status.UPCOMING;
              return new ScheduleStatusDto(
                  e.vaccineKey(), e.ageValue(), e.ageUnit(), due, status, e.mandatory());
            })
        .toList();
  }

  private static LocalDate dueDate(LocalDate startDate, int ageValue, String ageUnit) {
    return "WEEK".equals(ageUnit) ? startDate.plusWeeks(ageValue) : startDate.plusDays(ageValue);
  }

  private void journal(Long unitId, String eventType, String programKey, Long userId) {
    LifecycleEvent event = new LifecycleEvent();
    event.setProductionUnitId(unitId);
    event.setEventType(eventType);
    event.setQuantityDelta(0);
    event.setReason("vaccination_program");
    event.setDetails(Map.of("program_key", programKey));
    event.setCreatedBy(userId);
    lifecycleEventRepository.save(event);
  }
}
