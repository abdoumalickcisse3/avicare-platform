package com.avicare.livestock.health.dto;

import com.avicare.livestock.inventory.dto.StockConsumptionRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Record a vaccination administration (Sprint B3-4). {@code stockConsumption} is optional (Décision
 * D18): when present, the vaccine doses are drawn from stock as an automatic OUT movement; rejected
 * with 422 if {@code module.inventory} is inactive (Option α).
 */
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
    String notes,
    @Valid StockConsumptionRequest stockConsumption) {}
