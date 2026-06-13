package com.avicare.livestock.health;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.common.api.exception.NotFoundException;
import com.avicare.common.api.exception.ValidationException;
import com.avicare.livestock.domain.LifecycleEvent;
import com.avicare.livestock.domain.ProductionUnit;
import com.avicare.livestock.domain.Vaccination;
import com.avicare.livestock.repository.LifecycleEventRepository;
import com.avicare.livestock.repository.VaccinationRepository;
import com.avicare.livestock.service.LivestockService;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Recording of vaccinations administered on a production unit (Sprint B3-2). {@link #record}
 * validates the vaccine against the platform catalog ({@link HealthCatalogService}) and the treated
 * head count against the unit's count (+20% field buffer), then inserts one row — a second
 * administration of the same vaccine on the same day is rejected (UNIQUE unit/vaccine/date). A
 * {@code VACCINATION_ADMINISTERED} lifecycle event is journaled (no head-count change).
 */
@Service
@RequiredArgsConstructor
public class VaccinationService {

  public static final String EVENT_VACCINATION_ADMINISTERED = "VACCINATION_ADMINISTERED";

  /** Field tolerance over the recorded head count for the number of treated subjects. */
  private static final double SUBJECTS_BUFFER = 1.2;

  private final VaccinationRepository vaccinationRepository;
  private final LifecycleEventRepository lifecycleEventRepository;
  private final LivestockService livestockService;
  private final HealthCatalogService healthCatalogService;

  @Transactional
  public Vaccination record(Long unitId, VaccinationCommand cmd, Long userId) {
    ProductionUnit unit = livestockService.getUnit(unitId); // 404 if missing

    boolean known =
        healthCatalogService.listVaccines().stream()
            .anyMatch(v -> v.key().equals(cmd.vaccineKey()));
    if (!known) {
      throw new ValidationException(
          "UNKNOWN_VACCINE", "Vaccine '" + cmd.vaccineKey() + "' is not in the catalog");
    }

    long maxSubjects = Math.round(unit.getCurrentCount() * SUBJECTS_BUFFER);
    if (cmd.subjectsCount() < 0 || cmd.subjectsCount() > maxSubjects) {
      throw new ValidationException(
          "INVALID_SUBJECTS_COUNT",
          "Subjects count "
              + cmd.subjectsCount()
              + " is out of range (0.."
              + maxSubjects
              + " for current count "
              + unit.getCurrentCount()
              + ")");
    }

    vaccinationRepository
        .findByProductionUnitIdAndVaccineKeyAndAdministeredDate(
            unitId, cmd.vaccineKey(), cmd.administeredDate())
        .ifPresent(
            existing -> {
              throw new BusinessRuleException(
                  "VACCINATION_ALREADY_RECORDED",
                  "'" + cmd.vaccineKey() + "' is already recorded for this unit on this date");
            });

    Vaccination v = new Vaccination();
    v.setProductionUnit(unit);
    v.setVaccineKey(cmd.vaccineKey());
    v.setAdministeredDate(cmd.administeredDate());
    v.setRoute(cmd.route());
    v.setDosePerSubject(cmd.dosePerSubject());
    v.setDoseUnit(cmd.doseUnit());
    v.setSubjectsCount(cmd.subjectsCount());
    v.setVaccineBatchNumber(cmd.vaccineBatchNumber());
    v.setVaccineExpiryDate(cmd.vaccineExpiryDate());
    v.setAdministeredByUserId(cmd.administeredByUserId());
    v.setNotes(cmd.notes());
    v.setCreatedBy(userId);
    Vaccination saved = vaccinationRepository.save(v);

    LifecycleEvent event = new LifecycleEvent();
    event.setProductionUnitId(unitId);
    event.setEventType(EVENT_VACCINATION_ADMINISTERED);
    event.setQuantityDelta(0);
    event.setReason("vaccination");
    event.setDetails(
        Map.of(
            "vaccine_key", cmd.vaccineKey(),
            "administered_date", cmd.administeredDate().toString(),
            "subjects_count", cmd.subjectsCount()));
    event.setCreatedBy(userId);
    lifecycleEventRepository.save(event);

    return saved;
  }

  @Transactional(readOnly = true)
  public List<Vaccination> listForUnit(Long unitId) {
    return vaccinationRepository.findByProductionUnitIdOrderByAdministeredDateDesc(unitId);
  }

  @Transactional(readOnly = true)
  public List<Vaccination> getByVaccineKey(Long unitId, String vaccineKey) {
    return vaccinationRepository.findByProductionUnitIdAndVaccineKey(unitId, vaccineKey);
  }

  @Transactional(readOnly = true)
  public Vaccination get(Long id) {
    return vaccinationRepository
        .findById(id)
        .orElseThrow(() -> NotFoundException.of("Vaccination", id));
  }

  @Transactional
  public void delete(Long id) {
    vaccinationRepository.delete(get(id));
  }
}
