package com.avicare.livestock.health.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

/** Record a vaccination administration (Sprint B3-4). */
public record VaccinationCreateRequest(
    @NotNull Long unitId,
    @NotBlank @Size(max = 80) String vaccineKey,
    @NotNull LocalDate administeredDate,
    @Size(max = 40) String route,
    BigDecimal dosePerSubject,
    @Size(max = 20) String doseUnit,
    @PositiveOrZero int subjectsCount,
    @Size(max = 80) String vaccineBatchNumber,
    LocalDate vaccineExpiryDate,
    Long administeredByUserId,
    String notes) {}
