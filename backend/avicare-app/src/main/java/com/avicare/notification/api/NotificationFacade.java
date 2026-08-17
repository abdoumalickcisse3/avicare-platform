package com.avicare.notification.api;

import java.util.List;

/**
 * Public read surface of the notification context (Sprint C1). Designed so the assistant can later
 * surface alerts proactively without a rewrite; not called from the assistant yet.
 */
public interface NotificationFacade {

  /** Active notifications of a farm, newest first. */
  List<NotificationView> listActive(Long farmId);

  /** Number of notifications the user has not read yet on a farm. */
  long unreadCount(Long farmId, Long userId);
}
