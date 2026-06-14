-- =====================================================================
-- V19 — Extend stock_movements.reason for cross-context consumption
-- (Sprint B4-5, Décision D18). Adds CONSUMPTION_VACCINATION and
-- CONSUMPTION_TREATMENT so a vaccination/treatment can optionally draw its
-- vaccine/medication from stock, alongside the existing CONSUMPTION_LOT
-- (kept for DailyRecord feed consumption). No data change — only the CHECK.
-- =====================================================================

ALTER TABLE stock_movements DROP CONSTRAINT stock_movements_reason_check;

ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_reason_check
    CHECK (reason IN (
      'RECEPTION_PURCHASE', 'GIFT', 'RETURN_SUPPLIER',
      'CONSUMPTION_LOT', 'CONSUMPTION_VACCINATION', 'CONSUMPTION_TREATMENT',
      'LOSS', 'SALE', 'THEFT',
      'INVENTORY_PHYSICAL', 'ERROR_CORRECTION'));
