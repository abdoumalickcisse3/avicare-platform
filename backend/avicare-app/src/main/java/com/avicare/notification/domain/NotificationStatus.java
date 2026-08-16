package com.avicare.notification.domain;

/**
 * Lifecycle of a notification (Sprint C1). A condition materializes one {@code ACTIVE}
 * notification; when the condition disappears the scanner sets it {@code RESOLVED}, freeing the
 * {@code dedup_key} for re-arming.
 */
public enum NotificationStatus {
  ACTIVE,
  RESOLVED
}
