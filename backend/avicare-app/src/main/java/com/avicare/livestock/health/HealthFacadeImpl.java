package com.avicare.livestock.health;

import com.avicare.livestock.health.dto.AlertsResponse;
import com.avicare.livestock.health.dto.AlertsResponse.ActiveWithdrawalItem;
import com.avicare.livestock.health.dto.AlertsResponse.CriticalObservationItem;
import com.avicare.livestock.health.dto.AlertsResponse.VaccinationLateItem;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Default {@link HealthFacade} implementation, delegating to {@link AlertService} and mapping its
 * alert items to the public {@link VaccinationDueInfo} so transverse contexts never touch the
 * health DTOs/entities.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class HealthFacadeImpl implements HealthFacade {

  private final AlertService alertService;

  @Override
  public List<VaccinationDueInfo> dueVaccinations(Long farmId) {
    return alertService.computeAlertsForFarm(farmId).vaccinationsLate().stream()
        .map(HealthFacadeImpl::toInfo)
        .toList();
  }

  @Override
  public List<HealthAlertInfo> healthAlerts(Long farmId) {
    AlertsResponse alerts = alertService.computeAlertsForFarm(farmId);
    List<HealthAlertInfo> out = new ArrayList<>();
    for (VaccinationLateItem v : alerts.vaccinationsLate()) {
      out.add(
          new HealthAlertInfo(
              "VACCINATION_LATE", v.unitId(), null, v.vaccineKey(), v.vaccineKey(), v.daysLate()));
    }
    for (ActiveWithdrawalItem w : alerts.activeWithdrawals()) {
      long days =
          w.daysRemainingMeat() != null
              ? w.daysRemainingMeat()
              : (w.daysRemainingEggs() != null ? w.daysRemainingEggs() : 0L);
      out.add(
          new HealthAlertInfo(
              "WITHDRAWAL_ENDING",
              w.unitId(),
              w.treatmentId(),
              w.treatmentKey(),
              w.treatmentKey(),
              days));
    }
    for (CriticalObservationItem o : alerts.criticalObservations()) {
      out.add(
          new HealthAlertInfo(
              "CRITICAL_OBSERVATION", o.unitId(), o.observationId(), null, o.title(), 0L));
    }
    return out;
  }

  private static VaccinationDueInfo toInfo(VaccinationLateItem item) {
    return new VaccinationDueInfo(
        item.unitName(), item.vaccineKey(), item.dueDate(), item.daysLate());
  }
}
