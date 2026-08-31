package com.avicare.integrity.check;

import java.util.Map;

/**
 * One inconsistency a check is claiming, before it is matched against what is already known.
 *
 * <p>{@code entityType} travels with the candidate rather than with the check: a single check can
 * legitimately span several tables — the farm-id coherence one walks every child-to-parent link
 * there is.
 */
public record FindingCandidate(
    String entityType,
    Long entityId,
    Long farmId,
    String expectedValue,
    String actualValue,
    Map<String, Object> details) {}
