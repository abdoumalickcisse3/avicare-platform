package com.avicare.livestock.health.dto;

import com.avicare.livestock.domain.Severity;
import java.time.LocalDate;
import java.util.List;

/**
 * In-app health alerts for a farm (Sprint B3-4), computed on read. Sections requiring {@code
 * module.health.advanced} (withdrawals, follow-ups) are empty when that module is not active.
 */
public record AlertsResponse(
    List<VaccinationLateItem> vaccinationsLate,
    List<ActiveWithdrawalItem> activeWithdrawals,
    List<FollowUpItem> upcomingFollowUps,
    List<CriticalObservationItem> criticalObservations) {

  public record VaccinationLateItem(
      Long unitId, String unitName, String vaccineKey, LocalDate dueDate, long daysLate) {}

  public record ActiveWithdrawalItem(
      Long unitId,
      Long treatmentId,
      String treatmentKey,
      LocalDate withdrawalEndDateMeat,
      LocalDate withdrawalEndDateEggs,
      Long daysRemainingMeat,
      Long daysRemainingEggs) {}

  public record FollowUpItem(
      Long unitId, Long vetVisitId, LocalDate followUpDate, long daysUntil) {}

  public record CriticalObservationItem(
      Long unitId,
      Long observationId,
      Severity severity,
      String title,
      LocalDate observationDate) {}
}
