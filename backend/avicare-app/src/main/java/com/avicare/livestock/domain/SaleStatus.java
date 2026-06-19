package com.avicare.livestock.domain;

/**
 * Lifecycle of a direct sale (Sprint B5-2, Décision D22). A sale is immediate: it is born {@code
 * COMPLETED} (stock already decremented) and can only move to {@code CANCELLED}, which reverses the
 * stock (compensating IN movement). Mirrored by a CHECK constraint in V21.
 */
public enum SaleStatus {
  COMPLETED,
  CANCELLED
}
