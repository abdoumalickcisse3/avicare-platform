-- =====================================================================
-- V23 — Commercial: payments (Sprint B5-4). A payment is received against
-- one invoice (invoice_id NOT NULL, Décision B5-4) by a method (cash,
-- mobile money, bank transfer). payment_number is minted P-YYYY-NNN per
-- farm per year (D24); amount is HT (D25) and the service forbids
-- overpayment (amount <= invoice outstanding). Recording a payment raises
-- invoices.amount_paid_xof (→ PARTIALLY_PAID / PAID) and lowers the
-- client's receivable (encours, D26); voiding (status CANCELLED) reverses
-- both. client_id is null for a walk-in invoice.
-- =====================================================================

CREATE TABLE payments (
    id                  BIGSERIAL PRIMARY KEY,
    farm_id             BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    payment_number      VARCHAR(40) NOT NULL,
    invoice_id          BIGINT NOT NULL REFERENCES invoices(id),
    client_id           BIGINT REFERENCES clients(id),
    amount_xof          BIGINT NOT NULL CHECK (amount_xof > 0),
    method              VARCHAR(20) NOT NULL
                          CHECK (method IN ('CASH', 'MOBILE_MONEY', 'BANK_TRANSFER')),
    status              VARCHAR(20) NOT NULL DEFAULT 'COMPLETED'
                          CHECK (status IN ('COMPLETED', 'CANCELLED')),
    payment_date        DATE NOT NULL,
    reference           VARCHAR(150),

    created_by          BIGINT REFERENCES users(id),
    cancelled_by        BIGINT REFERENCES users(id),
    cancelled_at        TIMESTAMP,
    cancellation_reason TEXT,

    notes               TEXT,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_payment_number_format CHECK (payment_number ~ '^P-\d{4}-\d+$'),
    UNIQUE (farm_id, payment_number)
);

CREATE INDEX idx_payments_farm_status ON payments(farm_id, status);
CREATE INDEX idx_payments_invoice ON payments(invoice_id);
CREATE INDEX idx_payments_client ON payments(client_id);
CREATE INDEX idx_payments_dates ON payments(farm_id, payment_date DESC);

CREATE TRIGGER trg_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
