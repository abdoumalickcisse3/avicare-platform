package com.avicare.livestock.health;

import com.avicare.common.api.exception.NotFoundException;
import com.avicare.common.api.exception.ValidationException;
import com.avicare.livestock.domain.LifecycleEvent;
import com.avicare.livestock.domain.ProductionUnit;
import com.avicare.livestock.domain.TreatmentExecuted;
import com.avicare.livestock.domain.Veterinarian;
import com.avicare.livestock.repository.LifecycleEventRepository;
import com.avicare.livestock.repository.TreatmentExecutedRepository;
import com.avicare.livestock.repository.VeterinarianRepository;
import com.avicare.livestock.service.LivestockService;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Recording of treatments executed on a unit (Sprint B3-3, health.advanced). {@link #record}
 * validates the treatment against the catalog, SNAPSHOTS its withdrawal days at save time (frozen
 * against later catalog changes), and computes {@code endDate} and the withdrawal end dates. The
 * withdrawal is exposed (see {@link #getActiveWithdrawals}) but NEVER enforced — no endpoint is
 * blocked (V1 = warning only, farmer responsible). A {@code TREATMENT_ADMINISTERED} lifecycle event
 * is journaled (no head-count change — a treatment does not kill subjects).
 */
@Service
@RequiredArgsConstructor
public class TreatmentExecutedService {

  public static final String EVENT_TREATMENT_ADMINISTERED = "TREATMENT_ADMINISTERED";

  private final TreatmentExecutedRepository treatmentRepository;
  private final LifecycleEventRepository lifecycleEventRepository;
  private final LivestockService livestockService;
  private final HealthCatalogService healthCatalogService;
  private final VeterinarianRepository veterinarianRepository;

  @Transactional
  public TreatmentExecuted record(Long unitId, TreatmentCommand cmd, Long userId) {
    ProductionUnit unit = livestockService.getUnit(unitId); // 404 if missing

    TreatmentDto treatment =
        healthCatalogService.listTreatments().stream()
            .filter(t -> t.key().equals(cmd.treatmentKey()))
            .findFirst()
            .orElseThrow(
                () ->
                    new ValidationException(
                        "UNKNOWN_TREATMENT",
                        "Treatment '" + cmd.treatmentKey() + "' is not in the catalog"));

    if (cmd.subjectsCount() < 0) {
      throw new ValidationException("INVALID_SUBJECTS_COUNT", "Subjects count must be >= 0");
    }

    Veterinarian vet = resolveVet(cmd.veterinarianId(), unit.getFarmId());

    LocalDate endDate = cmd.startDate().plusDays(cmd.durationDays() - 1L);

    TreatmentExecuted t = new TreatmentExecuted();
    t.setProductionUnit(unit);
    t.setTreatmentKey(cmd.treatmentKey());
    t.setStartDate(cmd.startDate());
    t.setDurationDays(cmd.durationDays());
    t.setEndDate(endDate);
    t.setDoseAmount(cmd.doseAmount());
    t.setDoseUnit(cmd.doseUnit());
    t.setRoute(cmd.route());
    t.setSubjectsCount(cmd.subjectsCount());
    t.setReason(cmd.reason());
    t.setPrescribedBy(cmd.prescribedBy());
    t.setVeterinarian(vet);
    // Snapshot the withdrawal days from the catalog at record time.
    t.setWithdrawalDaysMeat(treatment.withdrawalDaysMeat());
    t.setWithdrawalDaysEggs(treatment.withdrawalDaysEggs());
    t.setWithdrawalEndDateMeat(withdrawalEnd(endDate, treatment.withdrawalDaysMeat()));
    t.setWithdrawalEndDateEggs(withdrawalEnd(endDate, treatment.withdrawalDaysEggs()));
    t.setNotes(cmd.notes());
    t.setAdministeredByUserId(cmd.administeredByUserId());
    t.setCreatedBy(userId);
    TreatmentExecuted saved = treatmentRepository.save(t);

    Map<String, Object> details = new HashMap<>();
    details.put("treatment_key", cmd.treatmentKey());
    details.put("start_date", cmd.startDate().toString());
    details.put("end_date", endDate.toString());
    details.put("subjects_count", cmd.subjectsCount());
    if (saved.getWithdrawalEndDateMeat() != null) {
      details.put("withdrawal_end_date_meat", saved.getWithdrawalEndDateMeat().toString());
    }
    LifecycleEvent event = new LifecycleEvent();
    event.setProductionUnitId(unitId);
    event.setEventType(EVENT_TREATMENT_ADMINISTERED);
    event.setQuantityDelta(0);
    event.setReason("treatment");
    event.setDetails(details);
    event.setCreatedBy(userId);
    lifecycleEventRepository.save(event);

    return saved;
  }

  @Transactional(readOnly = true)
  public List<TreatmentExecuted> listForUnit(Long unitId) {
    return treatmentRepository.findByProductionUnitIdOrderByStartDateDesc(unitId);
  }

  /**
   * Treatments whose meat or eggs withdrawal is still running on {@code today} (exposed, not
   * enforced).
   */
  @Transactional(readOnly = true)
  public List<TreatmentExecuted> getActiveWithdrawals(Long unitId, LocalDate today) {
    return treatmentRepository.findActiveWithdrawals(unitId, today);
  }

  @Transactional(readOnly = true)
  public TreatmentExecuted get(Long id) {
    return treatmentRepository
        .findById(id)
        .orElseThrow(() -> NotFoundException.of("TreatmentExecuted", id));
  }

  @Transactional
  public void delete(Long id) {
    treatmentRepository.delete(get(id));
  }

  private Veterinarian resolveVet(Long vetId, Long unitFarmId) {
    if (vetId == null) {
      return null;
    }
    Veterinarian vet =
        veterinarianRepository
            .findById(vetId)
            .orElseThrow(
                () -> new ValidationException("UNKNOWN_VETERINARIAN", "Veterinarian " + vetId));
    if (!vet.getFarmId().equals(unitFarmId)) {
      throw new ValidationException(
          "VET_WRONG_FARM", "Veterinarian " + vetId + " belongs to another farm");
    }
    return vet;
  }

  private static LocalDate withdrawalEnd(LocalDate endDate, Integer withdrawalDays) {
    return withdrawalDays != null ? endDate.plusDays(withdrawalDays) : null;
  }
}
