package com.avicare.livestock.health.dto;

import com.avicare.livestock.domain.Severity;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

/** Record a health observation (Sprint B3-4). */
public record ObservationCreateRequest(
    @NotNull Long unitId,
    @NotNull LocalDate observationDate,
    Severity severity,
    @NotBlank @Size(max = 200) String title,
    String description,
    @Size(max = 100) String suspectedDisease,
    Long observedByUserId) {}
