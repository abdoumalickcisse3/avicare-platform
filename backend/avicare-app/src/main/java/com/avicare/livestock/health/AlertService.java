package com.avicare.livestock.health;

import com.avicare.livestock.domain.ProductionUnit;
import com.avicare.livestock.health.dto.AlertsResponse;
import com.avicare.livestock.health.dto.AlertsResponse.ActiveWithdrawalItem;
import com.avicare.livestock.health.dto.AlertsResponse.CriticalObservationItem;
import com.avicare.livestock.health.dto.AlertsResponse.FollowUpItem;
import com.avicare.livestock.health.dto.AlertsResponse.VaccinationLateItem;
import com.avicare.livestock.service.LivestockService;
import com.avicare.subscription.api.SubscriptionFacade;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Computes in-app health alerts for a farm on read (Sprint B3-4, no notification table — V1). The
 * basic sections (late vaccinations, critical observations) are always computed; the advanced
 * sections (active withdrawals, upcoming follow-ups) are included only when {@code
 * module.health.advanced} is really active for the farm (checked via {@link SubscriptionFacade},
 * not the dev gating bypass).
 */
@Service
@RequiredArgsConstructor
public class AlertService {

  private static final int OBSERVATION_WINDOW_DAYS = 7;
  private static final int FOLLOW_UP_WINDOW_DAYS = 30;
  private static final String MODULE_ADVANCED = "module.health.advanced";

  private final LivestockService livestockService;
  private final VaccinationProgramAssignmentService programService;
  private final TreatmentExecutedService treatmentService;
  private final VetVisitService vetVisitService;
  private final HealthObservationService observationService;
  private final SubscriptionFacade subscriptionFacade;

  @Transactional(readOnly = true)
  public AlertsResponse computeAlertsForFarm(Long farmId) {
    LocalDate today = LocalDate.now();
    List<ProductionUnit> units = livestockService.listByFarm(farmId);
    boolean advanced = subscriptionFacade.isModuleEnabled(farmId, MODULE_ADVANCED);

    List<VaccinationLateItem> late = new ArrayList<>();
    List<CriticalObservationItem> critical = new ArrayList<>();
    for (ProductionUnit unit : units) {
      programService.computeScheduleStatus(unit.getId()).stream()
          .filter(s -> s.status() == ScheduleStatusDto.Status.LATE)
          .forEach(
              s ->
                  late.add(
                      new VaccinationLateItem(
                          unit.getId(),
                          unit.getName(),
                          s.vaccineKey(),
                          s.dueDate(),
                          ChronoUnit.DAYS.between(s.dueDate(), today))));

      LocalDate since = today.minusDays(OBSERVATION_WINDOW_DAYS);
      observationService.listCriticalObservations(unit.getId()).stream()
          .filter(o -> !o.getObservationDate().isBefore(since))
          .forEach(
              o ->
                  critical.add(
                      new CriticalObservationItem(
                          unit.getId(),
                          o.getId(),
                          o.getSeverity(),
                          o.getTitle(),
                          o.getObservationDate())));
    }

    List<ActiveWithdrawalItem> withdrawals = new ArrayList<>();
    List<FollowUpItem> followUps = new ArrayList<>();
    if (advanced) {
      for (ProductionUnit unit : units) {
        treatmentService.getActiveWithdrawals(unit.getId(), today).stream()
            .forEach(
                t ->
                    withdrawals.add(
                        new ActiveWithdrawalItem(
                            unit.getId(),
                            t.getId(),
                            t.getTreatmentKey(),
                            t.getWithdrawalEndDateMeat(),
                            t.getWithdrawalEndDateEggs(),
                            daysUntil(today, t.getWithdrawalEndDateMeat()),
                            daysUntil(today, t.getWithdrawalEndDateEggs()))));
      }
      vetVisitService.listUpcomingFollowUps(farmId, FOLLOW_UP_WINDOW_DAYS).stream()
          .forEach(
              v ->
                  followUps.add(
                      new FollowUpItem(
                          v.getProductionUnit().getId(),
                          v.getId(),
                          v.getFollowUpDate(),
                          ChronoUnit.DAYS.between(today, v.getFollowUpDate()))));
    }

    return new AlertsResponse(late, withdrawals, followUps, critical);
  }

  private static Long daysUntil(LocalDate today, LocalDate date) {
    return date != null ? ChronoUnit.DAYS.between(today, date) : null;
  }
}
