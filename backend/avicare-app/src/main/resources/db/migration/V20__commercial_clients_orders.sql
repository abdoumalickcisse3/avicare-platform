-- =====================================================================
-- V20 — Commercial: clients + sales orders (Sprint B5-1). A per-farm
-- client directory (with an indicative, non-blocking credit limit, D26)
-- and a per-farm sales order (one client, many lines) driving the strict
-- 5-state workflow PENDING → CONFIRMED → IN_PROGRESS → DELIVERED, with
-- CANCELLED reachable from any non-terminal state (D23). order_number is
-- generated ORD-YYYY-NNN per farm per year (D24). Amounts are HT only,
-- no VAT in V1 (D25). Stock is NOT touched here — the delivery → stock
-- cascade lands in B5-2. Mirrors the suppliers / purchase_orders shape.
-- =====================================================================

CREATE TABLE clients (
    id                    BIGSERIAL PRIMARY KEY,
    farm_id               BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    client_type           VARCHAR(20) NOT NULL
                            CHECK (client_type IN ('INDIVIDUAL', 'BUSINESS', 'WHOLESALER')),
    display_name          VARCHAR(150) NOT NULL,
    legal_name            VARCHAR(150),
    phone                 VARCHAR(40),
    email                 VARCHAR(120),
    address               TEXT,
    city                  VARCHAR(100),
    credit_limit_xof      BIGINT CHECK (credit_limit_xof >= 0),
    current_balance_xof   BIGINT NOT NULL DEFAULT 0,
    default_payment_terms VARCHAR(80),
    notes                 TEXT,
    active                BOOLEAN NOT NULL DEFAULT TRUE,
    created_by            BIGINT REFERENCES users(id),
    created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clients_farm ON clients(farm_id) WHERE active = TRUE;

CREATE TRIGGER trg_clients_updated_at
    BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE orders (
    id                        BIGSERIAL PRIMARY KEY,
    farm_id                   BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    order_number              VARCHAR(40) NOT NULL,
    client_id                 BIGINT NOT NULL REFERENCES clients(id),
    status                    VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                                CHECK (status IN ('PENDING', 'CONFIRMED', 'IN_PROGRESS',
                                                  'DELIVERED', 'CANCELLED')),
    order_date                DATE NOT NULL,
    expected_delivery_date    DATE,
    actual_delivery_date      DATE,
    delivery_address          TEXT,
    delivery_notes            TEXT,
    expected_payment_method   VARCHAR(40),
    expected_payment_due_date DATE,
    total_xof                 BIGINT NOT NULL DEFAULT 0,

    created_by                BIGINT REFERENCES users(id),
    confirmed_by              BIGINT REFERENCES users(id),
    confirmed_at              TIMESTAMP,
    delivered_by              BIGINT REFERENCES users(id),
    delivered_at              TIMESTAMP,
    cancelled_by              BIGINT REFERENCES users(id),
    cancelled_at              TIMESTAMP,
    cancellation_reason       TEXT,

    notes                     TEXT,
    created_at                TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_order_number_format CHECK (order_number ~ '^ORD-\d{4}-\d+$'),
    UNIQUE (farm_id, order_number)
);

CREATE INDEX idx_orders_farm_status ON orders(farm_id, status);
CREATE INDEX idx_orders_client ON orders(client_id);
CREATE INDEX idx_orders_dates ON orders(farm_id, order_date DESC);

CREATE TRIGGER trg_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE order_items (
    id                     BIGSERIAL PRIMARY KEY,
    order_id               BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

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

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_article ON order_items(article_source, article_key);

CREATE TRIGGER trg_order_items_updated_at
    BEFORE UPDATE ON order_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
