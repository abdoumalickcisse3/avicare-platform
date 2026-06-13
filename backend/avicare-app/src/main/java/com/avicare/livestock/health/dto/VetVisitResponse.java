package com.avicare.livestock.health.dto;

import com.avicare.livestock.domain.VetVisit;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** HTTP view of a vet visit (Sprint B3-4). */
public record VetVisitResponse(
    Long id,
    Long unitId,
    Long veterinarianId,
    LocalDate visitDate,
    String reason,
    String diagnosis,
    String recommendations,
    Integer costXof,
    boolean followUpNeeded,
    LocalDate followUpDate,
    String notes,
    Long createdBy,
    LocalDateTime createdAt) {

  public static VetVisitResponse from(VetVisit v) {
    return new VetVisitResponse(
        v.getId(),
        v.getProductionUnit().getId(),
        v.getVeterinarian() != null ? v.getVeterinarian().getId() : null,
        v.getVisitDate(),
        v.getReason(),
        v.getDiagnosis(),
        v.getRecommendations(),
        v.getCostXof(),
        v.isFollowUpNeeded(),
        v.getFollowUpDate(),
        v.getNotes(),
        v.getCreatedBy(),
        v.getCreatedAt());
  }
}
