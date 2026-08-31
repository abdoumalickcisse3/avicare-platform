package com.avicare.integrity.dto;

import com.avicare.integrity.domain.Severity;
import java.time.LocalDateTime;
import java.util.Map;

/**
 * One finding as the console shows it.
 *
 * @param recomputable whether a derived figure backs it — the console only offers the button when
 *     the platform is entitled to correct the value itself
 * @param openForDays how long it has been wrong, which is usually the first thing worth knowing
 */
public record FindingRow(
    Long id,
    String checkKey,
    String label,
    Severity severity,
    String entityType,
    Long entityId,
    Long farmId,
    String expectedValue,
    String actualValue,
    Map<String, Object> details,
    LocalDateTime detectedAt,
    LocalDateTime lastSeenAt,
    long openForDays,
    boolean recomputable) {}
