package com.avicare.livestock.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.Map;

/** Record a generic lifecycle event on a production unit. */
public record LifecycleEventRequest(
    @NotBlank @Size(max = 50) String eventType,
    int quantityDelta,
    @Size(max = 100) String reason,
    Map<String, Object> details) {}
