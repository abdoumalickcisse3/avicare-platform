package com.avicare.notification.detect;

import com.avicare.notification.domain.NotificationCategory;
import com.avicare.notification.domain.NotificationSeverity;
import java.util.Map;

/**
 * A single alert condition currently true on a farm, as reported by an {@link AlertDetector}
 * (Sprint C1). The scanner materializes one ACTIVE {@code Notification} per {@code dedupKey} and
 * resolves those whose key is no longer reported.
 *
 * @param sourceRef deep-link payload persisted to {@code notifications.source_ref} (jsonb), e.g.
 *     {@code {"unitId": 3}} or {@code {"itemId": 42}}.
 */
public record DetectedCondition(
    NotificationCategory category,
    NotificationSeverity severity,
    String dedupKey,
    String title,
    String body,
    Map<String, Object> sourceRef) {}
