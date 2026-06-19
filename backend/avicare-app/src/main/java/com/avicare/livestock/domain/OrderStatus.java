package com.avicare.livestock.domain;

/**
 * Lifecycle of a sales order (Sprint B5-1, Décision D23). Strict 5-state machine, no skipping:
 * {@code PENDING → CONFIRMED → IN_PROGRESS → DELIVERED}; {@code CANCELLED} is reachable from any
 * non-terminal state (PENDING / CONFIRMED / IN_PROGRESS), never from DELIVERED. No {@code
 * PARTIALLY_DELIVERED} in V1. Mirrored by a CHECK constraint in V20.
 */
public enum OrderStatus {
  PENDING,
  CONFIRMED,
  IN_PROGRESS,
  DELIVERED,
  CANCELLED
}
