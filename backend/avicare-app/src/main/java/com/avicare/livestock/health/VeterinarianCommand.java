package com.avicare.livestock.health;

/** Input to create/update a veterinarian directory entry (Sprint B3-3). */
public record VeterinarianCommand(
    String fullName,
    String phone,
    String email,
    String speciality,
    String licenseNumber,
    String location,
    String notes) {}
