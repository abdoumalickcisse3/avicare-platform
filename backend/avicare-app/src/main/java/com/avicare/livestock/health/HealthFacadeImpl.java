package com.avicare.livestock.health;

import com.avicare.livestock.health.dto.AlertsResponse.VaccinationLateItem;
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

  private static VaccinationDueInfo toInfo(VaccinationLateItem item) {
    return new VaccinationDueInfo(
        item.unitName(), item.vaccineKey(), item.dueDate(), item.daysLate());
  }
}
