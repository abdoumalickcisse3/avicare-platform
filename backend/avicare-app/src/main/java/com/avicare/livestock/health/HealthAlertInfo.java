package com.avicare.livestock.health;

/**
 * Neutral, cross-context view of one health alert condition, exposed through {@link
 * HealthFacade#healthAlerts(Long)} so the notification context can materialize alerts without
 * touching the health services/DTOs (Sprint C1).
 *
 * @param kind one of {@code VACCINATION_LATE}, {@code WITHDRAWAL_ENDING}, {@code
 *     CRITICAL_OBSERVATION}
 * @param unitId production unit the alert relates to (deep-link)
 * @param refId treatment id (WITHDRAWAL_ENDING) or observation id (CRITICAL_OBSERVATION); null for
 *     vaccinations
 * @param refKey vaccine key (VACCINATION_LATE) or treatment key (WITHDRAWAL_ENDING); null otherwise
 * @param label human label for the message
 * @param days days late (VACCINATION_LATE) or days remaining (WITHDRAWAL_ENDING); 0 otherwise
 */
public record HealthAlertInfo(
    String kind, Long unitId, Long refId, String refKey, String label, long days) {}
