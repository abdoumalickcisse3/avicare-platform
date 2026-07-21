package com.avicare.livestock.dto.request;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Record a sample weighing (the individual gram weights of the sampled birds). {@code clientRef} is
 * an optional mobile replay key (doc 08 §9) — the web client leaves it null.
 */
public record WeighingRequest(
    @NotNull LocalDate sampleDate,
    @NotEmpty List<@Positive Integer> individualWeights,
    @Size(max = 2000) String notes,
    UUID clientRef) {}
