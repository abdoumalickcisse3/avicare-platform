package com.avicare.livestock.dto.request;

import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.util.UUID;

/**
 * Record mortality on a production unit: a positive head count and an optional reason. {@code
 * clientRef} is an optional mobile replay key (doc 08 §9) — the web client leaves it null.
 */
public record RecordMortalityRequest(
    @Positive int count, @Size(max = 100) String reason, UUID clientRef) {}
