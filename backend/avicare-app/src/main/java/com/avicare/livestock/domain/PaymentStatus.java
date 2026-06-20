package com.avicare.livestock.domain;

/**
 * Lifecycle of a payment (Sprint B5-4). Recorded {@code COMPLETED}; can be {@code CANCELLED}
 * (voided), which reverses its effect on the invoice and the client's receivable. Mirrored by a
 * CHECK constraint in V23.
 */
public enum PaymentStatus {
  COMPLETED,
  CANCELLED
}
