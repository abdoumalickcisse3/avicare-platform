package com.avicare.livestock.health.dto;

import com.avicare.livestock.inventory.dto.StockConsumptionRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
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
    // Positif, pas « positif ou zéro » : vacciner zéro sujet ne veut rien dire, et le contrôle
    // d'intégrité le signalait déjà comme un défaut. Autant que l'API refuse ce qu'elle-même
    // qualifie d'anomalie plutôt que de l'accepter puis de s'en plaindre la nuit suivante.
    @Positive int subjectsCount,
    @Size(max = 80) String vaccineBatchNumber,
    LocalDate vaccineExpiryDate,
    Long administeredByUserId,
    String notes,
    @Valid StockConsumptionRequest stockConsumption) {}
