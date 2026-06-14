package com.avicare.livestock.domain;

/**
 * Lifecycle of a purchase order (Sprint B4-3). {@code DRAFT → SENT → RECEIVED}; {@code CANCELLED}
 * is reachable from {@code DRAFT} or {@code SENT} (never from {@code RECEIVED}). Reception creates
 * the stock movements; it is a terminal state alongside {@code CANCELLED}.
 */
public enum PurchaseOrderStatus {
  DRAFT,
  SENT,
  RECEIVED,
  CANCELLED
}
