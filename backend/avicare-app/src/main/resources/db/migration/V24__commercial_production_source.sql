-- =====================================================================
-- V24 — Sell farm production (broilers from a lot, eggs from farm tray
-- stock). Décision D27. Extends article_source CHECK on the three
-- commercial line-item tables (order_items V20, sale_items / delivery_items
-- V21) to include the new PRODUCTION value, and adds production_unit_id
-- (the broiler lot FK) plus product_type (BROILER | EGGS) — both nullable
-- so existing INVENTORY / TREATMENT rows are unaffected.
-- Migration follows the V19 pattern: DROP auto-named inline CHECK, ADD
-- named CHECK, then ADD COLUMN.
-- =====================================================================

-- ── sale_items ──────────────────────────────────────────────────────
ALTER TABLE sale_items DROP CONSTRAINT sale_items_article_source_check;

ALTER TABLE sale_items ADD CONSTRAINT sale_items_article_source_check
    CHECK (article_source IN ('INVENTORY', 'TREATMENT', 'PRODUCTION'));

ALTER TABLE sale_items
    ADD COLUMN production_unit_id BIGINT NULL REFERENCES production_units(id),
    ADD COLUMN product_type       VARCHAR(20) NULL
                                    CHECK (product_type IN ('BROILER', 'EGGS'));

CREATE INDEX idx_sale_items_production_unit ON sale_items(production_unit_id);

-- ── order_items ──────────────────────────────────────────────────────
ALTER TABLE order_items DROP CONSTRAINT order_items_article_source_check;

ALTER TABLE order_items ADD CONSTRAINT order_items_article_source_check
    CHECK (article_source IN ('INVENTORY', 'TREATMENT', 'PRODUCTION'));

ALTER TABLE order_items
    ADD COLUMN production_unit_id BIGINT NULL REFERENCES production_units(id),
    ADD COLUMN product_type       VARCHAR(20) NULL
                                    CHECK (product_type IN ('BROILER', 'EGGS'));

CREATE INDEX idx_order_items_production_unit ON order_items(production_unit_id);

-- ── delivery_items ───────────────────────────────────────────────────
ALTER TABLE delivery_items DROP CONSTRAINT delivery_items_article_source_check;

ALTER TABLE delivery_items ADD CONSTRAINT delivery_items_article_source_check
    CHECK (article_source IN ('INVENTORY', 'TREATMENT', 'PRODUCTION'));

ALTER TABLE delivery_items
    ADD COLUMN production_unit_id BIGINT NULL REFERENCES production_units(id),
    ADD COLUMN product_type       VARCHAR(20) NULL
                                    CHECK (product_type IN ('BROILER', 'EGGS'));

CREATE INDEX idx_delivery_items_production_unit ON delivery_items(production_unit_id);
