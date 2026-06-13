package com.avicare.livestock.health.dto;

import com.avicare.livestock.domain.VaccinationProgramLot;
import java.time.LocalDateTime;

/** HTTP view of a unit's assigned vaccination program (Sprint B3-4). */
public record ProgramAssignmentResponse(
    Long unitId, String programKey, Long assignedBy, LocalDateTime assignedAt) {

  public static ProgramAssignmentResponse from(VaccinationProgramLot lot) {
    return new ProgramAssignmentResponse(
        lot.getProductionUnit().getId(),
        lot.getProgramKey(),
        lot.getAssignedBy(),
        lot.getCreatedAt());
  }
}
