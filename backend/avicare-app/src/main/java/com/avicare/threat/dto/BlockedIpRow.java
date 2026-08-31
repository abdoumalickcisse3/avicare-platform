package com.avicare.threat.dto;

import java.time.LocalDateTime;

/** One address currently refused, with the time left on it. */
public record BlockedIpRow(
    String ipAddress,
    LocalDateTime blockedAt,
    LocalDateTime blockedUntil,
    long minutesRemaining,
    String reason,
    String blockedBy) {}
