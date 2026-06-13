-- =====================================================================
-- V16 — Stock movements (Sprint B4-2). Append-only journal of every change
-- to a stock_items row (IN / OUT / ADJUSTMENT) with before/after snapshots.
-- Each movement cascades to stock_items.current_quantity in the service,
-- atomically (@Transactional). current_quantity MAY go negative on OUT
-- (Décision 19 — non-blocking warning), so no guard here.
--
-- Cross-context backrefs (production_unit / daily_record / vaccination /
-- treatment_executed) are nullable soft references kept for traceability;
-- the SQL FKs do the existence check, no further cross-context validation
-- in V1. purchase_order_id has NO FK yet — purchase_orders arrives in B4-3,
-- the FK will be added by ALTER in V17.
--
-- This table IS the stock journal; no LifecycleEvent is emitted for stock
-- movements (lifecycle_events is production-unit/head-count scoped).
-- =====================================================================

CREATE TABLE stock_movements (
    id                    BIGSERIAL PRIMARY KEY,
    stock_item_id         BIGINT NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
    movement_type         VARCHAR(20) NOT NULL
                            CHECK (movement_type IN ('IN', 'OUT', 'ADJUSTMENT')),
    movement_date         DATE NOT NULL,
    -- Always the magnitude of the change (> 0); the direction is read from
    -- movement_type and the before/after snapshots. For ADJUSTMENT this is
    -- |target - before|; a no-op adjustment (target == before) is rejected
    -- in the service, so the > 0 invariant holds.
    quantity              NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
    quantity_before       NUMERIC(14,3) NOT NULL,
    quantity_after        NUMERIC(14,3) NOT NULL,
    reason                VARCHAR(40) NOT NULL
                            CHECK (reason IN (
                              'RECEPTION_PURCHASE', 'GIFT', 'RETURN_SUPPLIER',
                              'CONSUMPTION_LOT', 'LOSS', 'SALE', 'THEFT',
                              'INVENTORY_PHYSICAL', 'ERROR_CORRECTION')),

    -- Cross-context soft references (nullable, traceability only).
    production_unit_id    BIGINT REFERENCES production_units(id),
    purchase_order_id     BIGINT,                                       -- FK added in V17 (B4-3)
    daily_record_id       BIGINT REFERENCES daily_records(id),
    vaccination_id        BIGINT REFERENCES vaccinations(id),
    treatment_executed_id BIGINT REFERENCES treatments_executed(id),

    unit_price_xof        INTEGER,
    total_value_xof       BIGINT,
    notes                 TEXT,

    performed_by_user_id  BIGINT REFERENCES users(id),
    created_by            BIGINT REFERENCES users(id),
    created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stock_movements_item_date
    ON stock_movements(stock_item_id, movement_date DESC);
CREATE INDEX idx_stock_movements_unit
    ON stock_movements(production_unit_id) WHERE production_unit_id IS NOT NULL;
CREATE INDEX idx_stock_movements_daily_record
    ON stock_movements(daily_record_id) WHERE daily_record_id IS NOT NULL;
CREATE INDEX idx_stock_movements_vaccination
    ON stock_movements(vaccination_id) WHERE vaccination_id IS NOT NULL;
CREATE INDEX idx_stock_movements_treatment
    ON stock_movements(treatment_executed_id) WHERE treatment_executed_id IS NOT NULL;

CREATE TRIGGER trg_stock_movements_updated_at
    BEFORE UPDATE ON stock_movements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
