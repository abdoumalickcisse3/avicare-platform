-- Expose the breed type (broiler | layer) as a first-class column, denormalised
-- from the A4 catalog (catalog_items.value->>'type'), mirroring how V5 copied
-- species/name/code onto breeds. Lets the API filter breeds by type without a
-- cross-context lookup. Nullable: non-poultry / typeless breeds keep NULL.
ALTER TABLE breeds ADD COLUMN type VARCHAR(20);

UPDATE breeds b
SET type = ci.value ->> 'type'
FROM catalog_items ci
WHERE b.catalog_item_id = ci.id
  AND ci.value ? 'type';
