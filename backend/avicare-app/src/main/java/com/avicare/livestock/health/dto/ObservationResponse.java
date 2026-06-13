package com.avicare.livestock.health.dto;

import com.avicare.livestock.domain.HealthObservation;
import com.avicare.livestock.domain.Severity;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** HTTP view of a health observation (Sprint B3-4). */
public record ObservationResponse(
    Long id,
    Long unitId,
    LocalDate observationDate,
    Severity severity,
    String title,
    String description,
    String suspectedDisease,
    Long observedByUserId,
    Long createdBy,
    LocalDateTime createdAt) {

  public static ObservationResponse from(HealthObservation o) {
    return new ObservationResponse(
        o.getId(),
        o.getProductionUnit().getId(),
        o.getObservationDate(),
        o.getSeverity(),
        o.getTitle(),
        o.getDescription(),
        o.getSuspectedDisease(),
        o.getObservedByUserId(),
        o.getCreatedBy(),
        o.getCreatedAt());
  }
}
