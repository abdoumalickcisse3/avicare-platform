package com.avicare.notification.domain;

/**
 * Severity of a notification, ordered from least to most severe. Ordinal order matters: preference
 * resolution keeps a notification only when its severity is {@code >=} the user's {@code
 * minSeverity} for the channel (Sprint C1).
 */
public enum NotificationSeverity {
  INFO,
  WARNING,
  CRITICAL;

  /** True when this severity is at least as severe as {@code min}. */
  public boolean atLeast(NotificationSeverity min) {
    return this.ordinal() >= min.ordinal();
  }
}
