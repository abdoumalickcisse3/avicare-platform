-- =====================================================================
-- V22 — Commercial: invoices (Sprint B5-3). An invoice is generated from
-- a direct sale OR a delivery (Décision D22): source_type says which, and
-- exactly one of sale_id / delivery_id is set. invoice_number is minted
-- F-YYYY-NNN per farm per year (D24); amounts are HT only (D25). Issuing
-- an invoice raises the client's receivable (encours); amount_paid_xof is
-- moved by payments (B5-4), which also drive the status transitions.
-- "Overdue" is NOT stored — it is derived (due_date passed and not yet
-- PAID/CANCELLED). One invoice per source (partial-unique on sale_id /
-- delivery_id) prevents double invoicing.
-- =====================================================================

CREATE TABLE invoices (
    id                  BIGSERIAL PRIMARY KEY,
    farm_id             BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    invoice_number      VARCHAR(40) NOT NULL,
    client_id           BIGINT REFERENCES clients(id),
    source_type         VARCHAR(20) NOT NULL CHECK (source_type IN ('SALE', 'DELIVERY')),
    sale_id             BIGINT REFERENCES sales(id),
    delivery_id         BIGINT REFERENCES deliveries(id),
    status              VARCHAR(20) NOT NULL DEFAULT 'ISSUED'
                          CHECK (status IN ('ISSUED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED')),
    issue_date          DATE NOT NULL,
    due_date            DATE,
    total_xof           BIGINT NOT NULL DEFAULT 0,
    amount_paid_xof     BIGINT NOT NULL DEFAULT 0 CHECK (amount_paid_xof >= 0),

    created_by          BIGINT REFERENCES users(id),
    cancelled_by        BIGINT REFERENCES users(id),
    cancelled_at        TIMESTAMP,
    cancellation_reason TEXT,

    notes               TEXT,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_invoice_number_format CHECK (invoice_number ~ '^F-\d{4}-\d+$'),
    -- exactly one source, matching source_type
    CONSTRAINT chk_invoice_source CHECK (
        (source_type = 'SALE'     AND sale_id IS NOT NULL AND delivery_id IS NULL) OR
        (source_type = 'DELIVERY' AND delivery_id IS NOT NULL AND sale_id IS NULL)
    ),
    UNIQUE (farm_id, invoice_number)
);

CREATE INDEX idx_invoices_farm_status ON invoices(farm_id, status);
CREATE INDEX idx_invoices_client ON invoices(client_id);
CREATE INDEX idx_invoices_due ON invoices(farm_id, due_date);
-- one invoice per source (no double invoicing)
CREATE UNIQUE INDEX ux_invoices_sale ON invoices(sale_id) WHERE sale_id IS NOT NULL;
CREATE UNIQUE INDEX ux_invoices_delivery ON invoices(delivery_id) WHERE delivery_id IS NOT NULL;

CREATE TRIGGER trg_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE invoice_items (
    id                     BIGSERIAL PRIMARY KEY,
    invoice_id             BIGINT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,

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

CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);

CREATE TRIGGER trg_invoice_items_updated_at
    BEFORE UPDATE ON invoice_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
