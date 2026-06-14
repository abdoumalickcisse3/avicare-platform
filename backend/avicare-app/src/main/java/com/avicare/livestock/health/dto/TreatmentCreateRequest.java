package com.avicare.livestock.health.dto;

import com.avicare.livestock.inventory.dto.StockConsumptionRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Record an executed treatment (Sprint B3-4). {@code stockConsumption} is optional (Décision D18):
 * when present, the medication is drawn from stock as an automatic OUT movement; rejected with 422
 * if {@code module.inventory} is inactive (Option α).
 */
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
    Long administeredByUserId,
    @Valid StockConsumptionRequest stockConsumption) {}
