-- V27 — Correctif : la source PRODUCTION (D27, ajoutée en V24 à sale_items /
-- order_items / delivery_items) avait été oubliée sur invoice_items, si bien que
-- facturer une vente de production (ex. poulets vifs, œufs) violait le CHECK et
-- renvoyait un 500. On aligne invoice_items sur les trois autres tables.

ALTER TABLE invoice_items DROP CONSTRAINT invoice_items_article_source_check;
ALTER TABLE invoice_items ADD CONSTRAINT invoice_items_article_source_check
    CHECK (article_source IN ('INVENTORY', 'TREATMENT', 'PRODUCTION'));
