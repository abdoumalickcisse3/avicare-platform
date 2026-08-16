package com.avicare.livestock.health;

import java.util.List;

/**
 * Public, read-only surface of the health sub-domain for transverse contexts (today the assistant's
 * consultation loop). Exposes health alerts through neutral DTOs so callers never touch the health
 * services or entities. Writes stay on the health REST endpoints; this facade never mutates.
 */
public interface HealthFacade {

  /** Vaccinations that are due/overdue on the farm's lots, most late first. */
  List<VaccinationDueInfo> dueVaccinations(Long farmId);

  /**
   * All health alert conditions currently true on the farm — late vaccinations, active treatment
   * withdrawals, and recent critical observations — flattened into neutral {@link HealthAlertInfo}
   * items for the notification context (Sprint C1).
   */
  List<HealthAlertInfo> healthAlerts(Long farmId);
}
