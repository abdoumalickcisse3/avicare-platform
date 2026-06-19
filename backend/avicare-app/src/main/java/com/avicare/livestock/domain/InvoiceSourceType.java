package com.avicare.livestock.domain;

/**
 * What an invoice was generated from (Sprint B5-3, Décision D22): a direct {@link Sale} or a {@link
 * Delivery}. Exactly one of {@code sale_id} / {@code delivery_id} is set accordingly. Mirrored by a
 * CHECK constraint in V22.
 */
public enum InvoiceSourceType {
  SALE,
  DELIVERY
}
