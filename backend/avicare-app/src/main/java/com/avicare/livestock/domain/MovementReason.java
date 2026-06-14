package com.avicare.livestock.domain;

/**
 * Business reason for a stock movement (Sprint B4-2). Kept as an open enum (no type↔reason
 * compatibility enforced in V1 — the farmer chooses). Mirrored by a CHECK constraint in V16.
 */
public enum MovementReason {
  RECEPTION_PURCHASE,
  GIFT,
  RETURN_SUPPLIER,
  CONSUMPTION_LOT,
  CONSUMPTION_VACCINATION,
  CONSUMPTION_TREATMENT,
  LOSS,
  SALE,
  THEFT,
  INVENTORY_PHYSICAL,
  ERROR_CORRECTION
}
