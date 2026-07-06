package com.avicare.livestock.health;

import com.avicare.common.api.exception.NotFoundException;
import com.avicare.common.api.exception.ValidationException;
import com.avicare.finance.api.FinanceFacade;
import com.avicare.livestock.domain.LifecycleEvent;
import com.avicare.livestock.domain.ProductionUnit;
import com.avicare.livestock.domain.VetVisit;
import com.avicare.livestock.domain.Veterinarian;
import com.avicare.livestock.repository.LifecycleEventRepository;
import com.avicare.livestock.repository.VetVisitRepository;
import com.avicare.livestock.repository.VeterinarianRepository;
import com.avicare.livestock.service.LivestockService;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Recording of vet visits on a unit (Sprint B3-3). The veterinarian is optional; when supplied it
 * must belong to the unit's farm. A follow-up requires a date on or after the visit. A {@code
 * VET_VISIT_RECORDED} lifecycle event is journaled. Upcoming follow-ups feed the future in-app
 * alerts.
 */
@Service
@RequiredArgsConstructor
public class VetVisitService {

  public static final String EVENT_VET_VISIT_RECORDED = "VET_VISIT_RECORDED";

  private final VetVisitRepository vetVisitRepository;
  private final LifecycleEventRepository lifecycleEventRepository;
  private final LivestockService livestockService;
  private final VeterinarianRepository veterinarianRepository;
  private final FinanceFacade financeFacade;

  @Transactional
  public VetVisit record(Long unitId, VetVisitCommand cmd, Long userId) {
    ProductionUnit unit = livestockService.getUnit(unitId); // 404 if missing

    Veterinarian vet = resolveVet(cmd.veterinarianId(), unit.getFarmId());

    if (cmd.followUpNeeded()
        && (cmd.followUpDate() == null || cmd.followUpDate().isBefore(cmd.visitDate()))) {
      throw new ValidationException(
          "INVALID_FOLLOW_UP_DATE", "Follow-up date must be on or after the visit date");
    }

    VetVisit visit = new VetVisit();
    visit.setProductionUnit(unit);
    visit.setVeterinarian(vet);
    visit.setVisitDate(cmd.visitDate());
    visit.setReason(cmd.reason());
    visit.setDiagnosis(cmd.diagnosis());
    visit.setRecommendations(cmd.recommendations());
    visit.setCostXof(cmd.costXof());
    visit.setFollowUpNeeded(cmd.followUpNeeded());
    visit.setFollowUpDate(cmd.followUpDate());
    visit.setNotes(cmd.notes());
    visit.setCreatedBy(userId);
    VetVisit saved = vetVisitRepository.save(visit);

    LifecycleEvent event = new LifecycleEvent();
    event.setProductionUnitId(unitId);
    event.setEventType(EVENT_VET_VISIT_RECORDED);
    event.setQuantityDelta(0);
    event.setReason("vet_visit");
    event.setDetails(Map.of("visit_date", cmd.visitDate().toString(), "reason", cmd.reason()));
    event.setCreatedBy(userId);
    lifecycleEventRepository.save(event);

    if (cmd.costXof() != null && cmd.costXof() > 0) {
      financeFacade.recordVetVisitExpense(
          unit.getFarmId(),
          saved.getId(),
          "Visite vétérinaire — " + cmd.reason(),
          cmd.costXof(),
          cmd.visitDate(),
          unitId,
          userId);
    }

    return saved;
  }

  @Transactional(readOnly = true)
  public List<VetVisit> listForUnit(Long unitId) {
    return vetVisitRepository.findByProductionUnitIdOrderByVisitDateDesc(unitId);
  }

  /** Follow-ups due for the farm within {@code daysAhead} days (feeds future alerts). */
  @Transactional(readOnly = true)
  public List<VetVisit> listUpcomingFollowUps(Long farmId, int daysAhead) {
    LocalDate today = LocalDate.now();
    return vetVisitRepository.findUpcomingFollowUps(farmId, today, today.plusDays(daysAhead));
  }

  @Transactional(readOnly = true)
  public VetVisit get(Long id) {
    return vetVisitRepository.findById(id).orElseThrow(() -> NotFoundException.of("VetVisit", id));
  }

  @Transactional
  public void delete(Long id) {
    VetVisit visit = get(id);
    Long farmId = visit.getProductionUnit().getFarmId();
    financeFacade.reverseVetVisitExpense(farmId, id);
    vetVisitRepository.delete(visit);
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
}
