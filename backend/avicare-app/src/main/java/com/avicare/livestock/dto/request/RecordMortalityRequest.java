package com.avicare.livestock.dto.request;

import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

/** Record mortality on a production unit: a positive head count and an optional reason. */
public record RecordMortalityRequest(@Positive int count, @Size(max = 100) String reason) {}
