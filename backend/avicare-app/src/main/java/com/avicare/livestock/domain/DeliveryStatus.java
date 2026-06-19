package com.avicare.livestock.domain;

/**
 * Lifecycle of a delivery (Sprint B5-2, Décision D22/D23). A delivery is created by converting a
 * confirmed order: it is born {@code DELIVERED} (stock decremented, order marked delivered) and can
 * only move to {@code CANCELLED}, which reverses the stock and reopens the order. Mirrored by a
 * CHECK constraint in V21.
 */
public enum DeliveryStatus {
  DELIVERED,
  CANCELLED
}
