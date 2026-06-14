package com.avicare.livestock.health;

import com.avicare.livestock.inventory.StockConsumption;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Input to record an executed treatment (Sprint B3-3). {@code stockConsumption} is optional
 * (Décision D18): when set, the medication is drawn from stock as an automatic OUT movement.
 */
public record TreatmentCommand(
    String treatmentKey,
    LocalDate startDate,
    int durationDays,
    BigDecimal doseAmount,
    String doseUnit,
    String route,
    int subjectsCount,
    String reason,
    String prescribedBy,
    Long veterinarianId,
    String notes,
    Long administeredByUserId,
    StockConsumption stockConsumption) {}
