package com.avicare.livestock.health.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

/** Record a vet visit (Sprint B3-4). {@code veterinarianId} is optional (anonymous visit). */
public record VetVisitCreateRequest(
    @NotNull Long unitId,
    Long veterinarianId,
    @NotNull LocalDate visitDate,
    @NotBlank String reason,
    String diagnosis,
    String recommendations,
    Integer costXof,
    boolean followUpNeeded,
    LocalDate followUpDate,
    String notes) {}
