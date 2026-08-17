package com.avicare.notification.dto;

import com.avicare.notification.domain.Notification;
import java.time.LocalDateTime;
import java.util.Map;

/** API view of a notification for the bell feed (Sprint C1). */
public record NotificationResponse(
    Long id,
    String category,
    String severity,
    String title,
    String body,
    Map<String, Object> sourceRef,
    String status,
    boolean read,
    LocalDateTime createdAt) {

  public static NotificationResponse of(Notification n, boolean read) {
    return new NotificationResponse(
        n.getId(),
        n.getCategory().name(),
        n.getSeverity().name(),
        n.getTitle(),
        n.getBody(),
        n.getSourceRef(),
        n.getStatus().name(),
        read,
        n.getCreatedAt());
  }
}
