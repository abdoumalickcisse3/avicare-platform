package com.avicare.livestock.health.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

/** Record an executed treatment (Sprint B3-4). */
public record TreatmentCreateRequest(
    @NotNull Long unitId,
    @NotBlank @Size(max = 80) String treatmentKey,
    @NotNull LocalDate startDate,
    @Positive int durationDays,
    @NotNull BigDecimal doseAmount,
    @NotBlank @Size(max = 20) String doseUnit,
    @NotBlank @Size(max = 40) String route,
    @PositiveOrZero int subjectsCount,
    String reason,
    @Size(max = 40) String prescribedBy,
    Long veterinarianId,
    String notes,
    Long administeredByUserId) {}
