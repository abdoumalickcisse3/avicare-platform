-- Compte-courant fournisseur : ce que la ferme doit, ce qu'elle a payé.
-- Un seul journal chronologique, la colonne `direction` porte le sens.
-- La table ne connaît PAS les dépenses : la charge est enregistrée ailleurs
-- (bon d'achat reçu, entrée de stock). Voir la spec §1.6.
CREATE TABLE supplier_ledger_entries (
    id                BIGSERIAL PRIMARY KEY,
    farm_id           BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    supplier_id       BIGINT NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    direction         VARCHAR(10) NOT NULL CHECK (direction IN ('DEBIT', 'CREDIT')),
    source            VARCHAR(20) NOT NULL CHECK (source IN ('PURCHASE_ORDER', 'MANUAL')),
    amount_xof        BIGINT NOT NULL CHECK (amount_xof > 0),
    entry_date        DATE NOT NULL,
    label             VARCHAR(200),
    method            VARCHAR(20),
    reference         VARCHAR(100),
    notes             TEXT,
    purchase_order_id BIGINT REFERENCES purchase_orders(id) ON DELETE SET NULL,
    created_by        BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at        TIMESTAMP NULL
);

CREATE INDEX idx_supplier_ledger_farm_supplier
    ON supplier_ledger_entries(farm_id, supplier_id) WHERE deleted_at IS NULL;

CREATE INDEX idx_supplier_ledger_farm
    ON supplier_ledger_entries(farm_id) WHERE deleted_at IS NULL;

-- Un bon d'achat n'endette qu'une fois, gravé dans la base et pas seulement
-- dans le service.
CREATE UNIQUE INDEX uq_supplier_ledger_purchase_order
    ON supplier_ledger_entries(purchase_order_id)
    WHERE purchase_order_id IS NOT NULL AND deleted_at IS NULL;

CREATE TRIGGER trg_supplier_ledger_entries_updated_at
    BEFORE UPDATE ON supplier_ledger_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
