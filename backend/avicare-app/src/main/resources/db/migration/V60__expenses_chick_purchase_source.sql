-- =====================================================================
-- V60 — Extend expense sources to cover chick purchases (recorded at
-- batch reception or corrected later), plus the matching catalog category.
-- =====================================================================

ALTER TABLE expenses DROP CONSTRAINT expenses_source_check;
ALTER TABLE expenses ADD CONSTRAINT expenses_source_check
    CHECK (source IN ('MANUAL', 'PURCHASE', 'STOCK_ENTRY', 'SALARY', 'VET_VISIT', 'CHICK_PURCHASE'));

INSERT INTO catalog_items (category, key, value, locale) VALUES
  ('expense_categories', 'chicks', '{"label":"Poussins"}'::jsonb, NULL);
