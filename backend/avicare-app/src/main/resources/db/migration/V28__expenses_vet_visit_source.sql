-- Étend les sources de dépense pour couvrir les visites vétérinaires (coût auto-comptabilisé),
-- et ajoute le lien vers la visite d'origine (référencement par id, comme purchase_order_id).

ALTER TABLE expenses DROP CONSTRAINT expenses_source_check;
ALTER TABLE expenses ADD CONSTRAINT expenses_source_check
    CHECK (source IN ('MANUAL', 'PURCHASE', 'STOCK_ENTRY', 'SALARY', 'VET_VISIT'));

ALTER TABLE expenses ADD COLUMN vet_visit_id BIGINT REFERENCES vet_visits(id) ON DELETE SET NULL;
CREATE INDEX idx_expenses_vet_visit ON expenses(vet_visit_id);
