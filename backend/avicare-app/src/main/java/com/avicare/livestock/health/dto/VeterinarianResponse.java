package com.avicare.livestock.health.dto;

import com.avicare.livestock.domain.Veterinarian;
import java.time.LocalDateTime;

/** HTTP view of a veterinarian directory entry (Sprint B3-4). */
public record VeterinarianResponse(
    Long id,
    Long farmId,
    String fullName,
    String phone,
    String email,
    String speciality,
    String licenseNumber,
    String location,
    String notes,
    boolean active,
    LocalDateTime createdAt) {

  public static VeterinarianResponse from(Veterinarian v) {
    return new VeterinarianResponse(
        v.getId(),
        v.getFarmId(),
        v.getFullName(),
        v.getPhone(),
        v.getEmail(),
        v.getSpeciality(),
        v.getLicenseNumber(),
        v.getLocation(),
        v.getNotes(),
        v.isActive(),
        v.getCreatedAt());
  }
}
