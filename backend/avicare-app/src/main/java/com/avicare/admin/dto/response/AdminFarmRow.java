package com.avicare.admin.dto.response;

import java.time.LocalDateTime;

/**
 * One farm in the back-office directory. {@code lastActivityAt} is null when the farm has never
 * recorded anything — a real state (a freshly signed-up account), not a zero date.
 */
public record AdminFarmRow(
    Long farmId,
    String name,
    boolean active,
    long memberCount,
    long activeUnitCount,
    LocalDateTime lastActivityAt) {}
