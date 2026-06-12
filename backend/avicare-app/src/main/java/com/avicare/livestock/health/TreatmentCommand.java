package com.avicare.livestock.health;

import java.math.BigDecimal;
import java.time.LocalDate;

/** Input to record an executed treatment (Sprint B3-3). */
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
    Long administeredByUserId) {}
