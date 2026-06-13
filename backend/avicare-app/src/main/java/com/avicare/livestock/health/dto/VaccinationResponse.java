package com.avicare.livestock.health.dto;

import com.avicare.livestock.domain.Vaccination;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** HTTP view of a recorded vaccination (Sprint B3-4). */
public record VaccinationResponse(
    Long id,
    Long unitId,
    String vaccineKey,
    LocalDate administeredDate,
    String route,
    BigDecimal dosePerSubject,
    String doseUnit,
    int subjectsCount,
    String vaccineBatchNumber,
    LocalDate vaccineExpiryDate,
    Long administeredByUserId,
    String notes,
    Long createdBy,
    LocalDateTime createdAt) {

  public static VaccinationResponse from(Vaccination v) {
    return new VaccinationResponse(
        v.getId(),
        v.getProductionUnit().getId(),
        v.getVaccineKey(),
        v.getAdministeredDate(),
        v.getRoute(),
        v.getDosePerSubject(),
        v.getDoseUnit(),
        v.getSubjectsCount(),
        v.getVaccineBatchNumber(),
        v.getVaccineExpiryDate(),
        v.getAdministeredByUserId(),
        v.getNotes(),
        v.getCreatedBy(),
        v.getCreatedAt());
  }
}
