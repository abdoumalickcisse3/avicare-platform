-- V25 — Finance P1 (Sprint B6) : registre des dépenses.
-- expenses.salary_id reste sans FK ici : la table salaries arrive en V26 (P2),
-- qui ajoutera la contrainte. Sources: MANUAL (saisie), PURCHASE (réception bon),
-- STOCK_ENTRY (entrée de stock valorisée), SALARY (paie, P2).

CREATE TABLE expenses (
    id                  BIGSERIAL PRIMARY KEY,
    farm_id             BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    category_key        VARCHAR(100) NOT NULL,
    amount_xof          BIGINT NOT NULL CHECK (amount_xof > 0),
    expense_date        DATE NOT NULL,
    label               VARCHAR(200) NOT NULL,
    notes               TEXT,
    production_unit_id  BIGINT REFERENCES production_units(id),
    source              VARCHAR(20) NOT NULL CHECK (source IN ('MANUAL','PURCHASE','STOCK_ENTRY','SALARY')),
    purchase_order_id   BIGINT REFERENCES purchase_orders(id),
    stock_movement_id   BIGINT REFERENCES stock_movements(id),
    salary_id           BIGINT,
    created_by          BIGINT NOT NULL REFERENCES users(id),
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMP
);

CREATE INDEX idx_expenses_farm_date ON expenses(farm_id, expense_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_expenses_unit ON expenses(production_unit_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_expenses_po ON expenses(purchase_order_id);
CREATE INDEX idx_expenses_movement ON expenses(stock_movement_id);

CREATE TRIGGER trg_expenses_updated_at
    BEFORE UPDATE ON expenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
