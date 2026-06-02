package com.avicare.livestock.domain;

/**
 * Lifecycle status of a {@link ProductionUnit}. Mirrors the {@code production_units.status} CHECK.
 */
public enum UnitStatus {
  PLANNED,
  ACTIVE,
  CLOSED,
  CANCELLED
}
