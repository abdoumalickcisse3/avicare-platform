-- =====================================================================
-- V17 — Purchase orders (Sprint B4-3). A per-farm purchase order (one
-- supplier, many lines) drives the workflow DRAFT → SENT → RECEIVED, with
-- CANCELLED reachable from DRAFT or SENT. On reception the service creates
-- one IN stock movement per received line (StockMovementService), so the
-- backref FK stock_movements.purchase_order_id deferred in V16 is added
-- here. order_number is generated BC-YYYY-NNN per farm per year.
-- =====================================================================

CREATE TABLE purchase_orders (
    id                     BIGSERIAL PRIMARY KEY,
    farm_id                BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    order_number           VARCHAR(40) NOT NULL,
    supplier_id            BIGINT NOT NULL REFERENCES suppliers(id),
    status                 VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
                             CHECK (status IN ('DRAFT', 'SENT', 'RECEIVED', 'CANCELLED')),
    order_date             DATE NOT NULL,
    expected_delivery_date DATE,
    actual_delivery_date   DATE,
    total_xof              BIGINT,

    created_by             BIGINT REFERENCES users(id),
    sent_by                BIGINT REFERENCES users(id),
    sent_at                TIMESTAMP,
    received_by            BIGINT REFERENCES users(id),
    received_at            TIMESTAMP,
    cancelled_by           BIGINT REFERENCES users(id),
    cancelled_at           TIMESTAMP,
    cancellation_reason    TEXT,

    notes                  TEXT,
    created_at             TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_po_order_number_format CHECK (order_number ~ '^BC-\d{4}-\d+$'),
    UNIQUE (farm_id, order_number)
);

CREATE INDEX idx_po_farm_status ON purchase_orders(farm_id, status);
CREATE INDEX idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX idx_po_dates ON purchase_orders(farm_id, order_date DESC);

CREATE TRIGGER trg_purchase_orders_updated_at
    BEFORE UPDATE ON purchase_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE purchase_order_items (
    id                     BIGSERIAL PRIMARY KEY,
    purchase_order_id      BIGINT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,

    article_key            VARCHAR(80) NOT NULL,
    article_source         VARCHAR(20) NOT NULL
                             CHECK (article_source IN ('INVENTORY', 'TREATMENT')),
    article_label_snapshot VARCHAR(150),
    unit                   VARCHAR(20),

    ordered_quantity       NUMERIC(14,3) NOT NULL CHECK (ordered_quantity > 0),
    received_quantity      NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (received_quantity >= 0),

    unit_price_xof         INTEGER NOT NULL CHECK (unit_price_xof >= 0),
    line_total_xof         BIGINT NOT NULL CHECK (line_total_xof >= 0),

    notes                  TEXT,
    created_at             TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_po_items_po ON purchase_order_items(purchase_order_id);
CREATE INDEX idx_po_items_article ON purchase_order_items(article_source, article_key);

CREATE TRIGGER trg_purchase_order_items_updated_at
    BEFORE UPDATE ON purchase_order_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Backfill the FK deferred in V16 now that purchase_orders exists.
ALTER TABLE stock_movements
    ADD CONSTRAINT fk_stock_movements_purchase_order
    FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id);
