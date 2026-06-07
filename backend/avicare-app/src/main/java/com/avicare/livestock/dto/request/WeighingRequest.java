package com.avicare.livestock.dto.request;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;

/** Record a sample weighing (the individual gram weights of the sampled birds). */
public record WeighingRequest(
    @NotNull LocalDate sampleDate,
    @NotEmpty List<@Positive Integer> individualWeights,
    @Size(max = 2000) String notes) {}
