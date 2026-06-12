package com.avicare.livestock.health;

import com.avicare.livestock.domain.Severity;
import java.time.LocalDate;

/** Input to record a free-form health observation (Sprint B3-2). */
public record HealthObservationCommand(
    LocalDate observationDate,
    Severity severity,
    String title,
    String description,
    String suspectedDisease,
    Long observedByUserId) {}
