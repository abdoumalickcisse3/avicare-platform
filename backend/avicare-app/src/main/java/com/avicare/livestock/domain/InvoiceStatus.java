package com.avicare.livestock.domain;

/**
 * Lifecycle of an invoice (Sprint B5-3). Created {@code ISSUED}; payments (B5-4) move it to {@code
 * PARTIALLY_PAID} then {@code PAID}; it can be {@code CANCELLED} while not fully paid. "Overdue" is
 * NOT a stored status — it is derived (due date passed and not yet PAID/CANCELLED). Mirrored by a
 * CHECK constraint in V22.
 */
public enum InvoiceStatus {
  ISSUED,
  PARTIALLY_PAID,
  PAID,
  CANCELLED
}
