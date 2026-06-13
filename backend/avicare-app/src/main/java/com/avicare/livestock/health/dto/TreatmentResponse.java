package com.avicare.livestock.health.dto;

import com.avicare.livestock.domain.TreatmentExecuted;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** HTTP view of an executed treatment with its computed withdrawal end dates (Sprint B3-4). */
public record TreatmentResponse(
    Long id,
    Long unitId,
    String treatmentKey,
    LocalDate startDate,
    int durationDays,
    LocalDate endDate,
    BigDecimal doseAmount,
    String doseUnit,
    String route,
    int subjectsCount,
    String reason,
    String prescribedBy,
    Long veterinarianId,
    Integer withdrawalDaysMeat,
    Integer withdrawalDaysEggs,
    LocalDate withdrawalEndDateMeat,
    LocalDate withdrawalEndDateEggs,
    String notes,
    Long createdBy,
    LocalDateTime createdAt) {

  public static TreatmentResponse from(TreatmentExecuted t) {
    return new TreatmentResponse(
        t.getId(),
        t.getProductionUnit().getId(),
        t.getTreatmentKey(),
        t.getStartDate(),
        t.getDurationDays(),
        t.getEndDate(),
        t.getDoseAmount(),
        t.getDoseUnit(),
        t.getRoute(),
        t.getSubjectsCount(),
        t.getReason(),
        t.getPrescribedBy(),
        t.getVeterinarian() != null ? t.getVeterinarian().getId() : null,
        t.getWithdrawalDaysMeat(),
        t.getWithdrawalDaysEggs(),
        t.getWithdrawalEndDateMeat(),
        t.getWithdrawalEndDateEggs(),
        t.getNotes(),
        t.getCreatedBy(),
        t.getCreatedAt());
  }
}
