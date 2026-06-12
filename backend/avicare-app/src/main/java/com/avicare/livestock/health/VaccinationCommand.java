package com.avicare.livestock.health;

import java.math.BigDecimal;
import java.time.LocalDate;

/** Input to record a vaccination administration (Sprint B3-2). */
public record VaccinationCommand(
    String vaccineKey,
    LocalDate administeredDate,
    String route,
    BigDecimal dosePerSubject,
    String doseUnit,
    int subjectsCount,
    String vaccineBatchNumber,
    LocalDate vaccineExpiryDate,
    Long administeredByUserId,
    String notes) {}
