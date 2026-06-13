package com.avicare.livestock.health.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Assign a vaccination program to a unit (Sprint B3-4). */
public record AssignProgramRequest(@NotBlank @Size(max = 80) String programKey) {}
