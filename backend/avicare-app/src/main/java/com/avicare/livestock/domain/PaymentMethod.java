package com.avicare.livestock.domain;

/**
 * How a payment was tendered (Sprint B5-4): {@code CASH} (espèces), {@code MOBILE_MONEY} (Wave,
 * Orange Money…), {@code BANK_TRANSFER} (virement). Mirrored by a CHECK constraint in V23.
 */
public enum PaymentMethod {
  CASH,
  MOBILE_MONEY,
  BANK_TRANSFER
}
