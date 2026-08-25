package com.avicare.partner.domain;

/**
 * Lifecycle of a partner alert: {@code ACTIVE} while the condition holds, {@code RESOLVED} once it
 * clears — which re-arms the dedup key for a future episode.
 */
public enum AlertStatus {
  ACTIVE,
  RESOLVED
}
