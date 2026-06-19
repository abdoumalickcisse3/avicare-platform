-- =====================================================================
-- V21 — Commercial: sales + deliveries (Sprint B5-2). The two flows that
-- decrement product stock (Décision D22): a direct cash SALE (client
-- optional — walk-in allowed) and a DELIVERY converted from a confirmed
-- order (order_id NOT NULL in V1). Both create OUT stock movements
-- (reason SALE, D21) via StockMovementService; cancelling reverses the
-- stock with compensating IN movements. Numbers are generated
-- V-YYYY-NNN (sales) / LIV-YYYY-NNN (deliveries) per farm per year (D24).
-- Amounts are HT only, no VAT in V1 (D25). The client balance is NOT
-- touched here (only by payments, B5-4, D26). Mirrors the orders /
-- order_items shape. stock_movements gains sale_id / delivery_id backrefs
-- (like purchase_order_id in V17); reason CHECK already includes SALE.
-- =====================================================================

CREATE TABLE sales (
    id                  BIGSERIAL PRIMARY KEY,
    farm_id             BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    sale_number         VARCHAR(40) NOT NULL,
    client_id           BIGINT REFERENCES clients(id),
    status              VARCHAR(20) NOT NULL DEFAULT 'COMPLETED'
                          CHECK (status IN ('COMPLETED', 'CANCELLED')),
    sale_date           DATE NOT NULL,
    payment_method      VARCHAR(40),
    total_xof           BIGINT NOT NULL DEFAULT 0,

    created_by          BIGINT REFERENCES users(id),
    cancelled_by        BIGINT REFERENCES users(id),
    cancelled_at        TIMESTAMP,
    cancellation_reason TEXT,

    notes               TEXT,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_sale_number_format CHECK (sale_number ~ '^V-\d{4}-\d+$'),
    UNIQUE (farm_id, sale_number)
);

CREATE INDEX idx_sales_farm_status ON sales(farm_id, status);
CREATE INDEX idx_sales_client ON sales(client_id);
CREATE INDEX idx_sales_dates ON sales(farm_id, sale_date DESC);

CREATE TRIGGER trg_sales_updated_at
    BEFORE UPDATE ON sales
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE sale_items (
    id                     BIGSERIAL PRIMARY KEY,
    sale_id                BIGINT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,

    article_key            VARCHAR(80) NOT NULL,
    article_source         VARCHAR(20) NOT NULL DEFAULT 'INVENTORY'
                             CHECK (article_source IN ('INVENTORY', 'TREATMENT')),
    article_label_snapshot VARCHAR(150),
    unit                   VARCHAR(20) NOT NULL,

    quantity               NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
    unit_price_xof         INTEGER NOT NULL CHECK (unit_price_xof >= 0),
    line_total_xof         BIGINT NOT NULL CHECK (line_total_xof >= 0),

    notes                  TEXT,
    created_at             TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_sale_items_article ON sale_items(article_source, article_key);

CREATE TRIGGER trg_sale_items_updated_at
    BEFORE UPDATE ON sale_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE deliveries (
    id                  BIGSERIAL PRIMARY KEY,
    farm_id             BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    delivery_number     VARCHAR(40) NOT NULL,
    order_id            BIGINT NOT NULL REFERENCES orders(id),
    client_id           BIGINT REFERENCES clients(id),
    status              VARCHAR(20) NOT NULL DEFAULT 'DELIVERED'
                          CHECK (status IN ('DELIVERED', 'CANCELLED')),
    delivery_date       DATE NOT NULL,
    carrier             VARCHAR(150),
    total_xof           BIGINT NOT NULL DEFAULT 0,

    created_by          BIGINT REFERENCES users(id),
    cancelled_by        BIGINT REFERENCES users(id),
    cancelled_at        TIMESTAMP,
    cancellation_reason TEXT,

    notes               TEXT,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_delivery_number_format CHECK (delivery_number ~ '^LIV-\d{4}-\d+$'),
    UNIQUE (farm_id, delivery_number)
);

CREATE INDEX idx_deliveries_farm_status ON deliveries(farm_id, status);
CREATE INDEX idx_deliveries_order ON deliveries(order_id);
CREATE INDEX idx_deliveries_dates ON deliveries(farm_id, delivery_date DESC);

CREATE TRIGGER trg_deliveries_updated_at
    BEFORE UPDATE ON deliveries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE delivery_items (
    id                     BIGSERIAL PRIMARY KEY,
    delivery_id            BIGINT NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,

    article_key            VARCHAR(80) NOT NULL,
    article_source         VARCHAR(20) NOT NULL DEFAULT 'INVENTORY'
                             CHECK (article_source IN ('INVENTORY', 'TREATMENT')),
    article_label_snapshot VARCHAR(150),
    unit                   VARCHAR(20) NOT NULL,

    quantity               NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
    unit_price_xof         INTEGER NOT NULL CHECK (unit_price_xof >= 0),
    line_total_xof         BIGINT NOT NULL CHECK (line_total_xof >= 0),

    notes                  TEXT,
    created_at             TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_delivery_items_delivery ON delivery_items(delivery_id);
CREATE INDEX idx_delivery_items_article ON delivery_items(article_source, article_key);

CREATE TRIGGER trg_delivery_items_updated_at
    BEFORE UPDATE ON delivery_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Traceability backrefs on the stock journal (mirrors purchase_order_id, V17).
ALTER TABLE stock_movements
    ADD COLUMN sale_id     BIGINT REFERENCES sales(id),
    ADD COLUMN delivery_id BIGINT REFERENCES deliveries(id);

CREATE INDEX idx_stock_movements_sale ON stock_movements(sale_id) WHERE sale_id IS NOT NULL;
CREATE INDEX idx_stock_movements_delivery ON stock_movements(delivery_id) WHERE delivery_id IS NOT NULL;
