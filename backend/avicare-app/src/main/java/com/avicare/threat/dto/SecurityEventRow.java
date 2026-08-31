package com.avicare.threat.dto;

import com.avicare.threat.domain.SecurityEventType;
import com.avicare.threat.domain.ThreatSeverity;
import java.time.LocalDateTime;
import java.util.Map;

/** One line of the security timeline. */
public record SecurityEventRow(
    Long id,
    SecurityEventType eventType,
    ThreatSeverity severity,
    String ipAddress,
    String email,
    String userAgent,
    Map<String, Object> details,
    String actionTaken,
    LocalDateTime createdAt) {}
