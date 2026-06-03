package com.avicare.livestock.dto.response;

import java.time.LocalDateTime;
import java.util.Map;

/** HTTP view of a lifecycle event. */
public record LifecycleEventResponse(
    Long id,
    Long productionUnitId,
    String eventType,
    int quantityDelta,
    String reason,
    Map<String, Object> details,
    LocalDateTime occurredAt) {}
