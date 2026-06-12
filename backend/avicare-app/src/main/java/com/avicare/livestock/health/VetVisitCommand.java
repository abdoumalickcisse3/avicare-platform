package com.avicare.livestock.health;

import java.time.LocalDate;

/** Input to record a vet visit (Sprint B3-3). {@code veterinarianId} is optional (anonymous). */
public record VetVisitCommand(
    Long veterinarianId,
    LocalDate visitDate,
    String reason,
    String diagnosis,
    String recommendations,
    Integer costXof,
    boolean followUpNeeded,
    LocalDate followUpDate,
    String notes) {}
