package com.avicare.livestock.health.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Create/update a veterinarian directory entry (Sprint B3-4). */
public record VeterinarianRequest(
    @NotBlank @Size(max = 150) String fullName,
    @Size(max = 40) String phone,
    @Size(max = 120) String email,
    @Size(max = 100) String speciality,
    @Size(max = 80) String licenseNumber,
    @Size(max = 150) String location,
    String notes) {}
