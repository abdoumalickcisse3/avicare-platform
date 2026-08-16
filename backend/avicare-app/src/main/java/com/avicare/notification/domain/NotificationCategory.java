package com.avicare.notification.domain;

/**
 * Category of a materialized notification (Sprint C1). Mirrors the {@code CHECK} constraint on
 * {@code notifications.category} (migration V34). Each category is owned by exactly one detector,
 * which is how the scanner reconciles/resolves stale notifications.
 */
public enum NotificationCategory {
  MORTALITY_ANOMALY,
  VACCINATION_LATE,
  WITHDRAWAL_ENDING,
  CRITICAL_OBSERVATION,
  LOW_STOCK,
  NEGATIVE_STOCK,
  PO_OVERDUE,
  CREDIT_EXCEEDED,
  INVOICE_OVERDUE
}
