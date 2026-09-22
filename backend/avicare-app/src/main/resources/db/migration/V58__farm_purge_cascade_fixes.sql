-- Self-service account deletion (App Store rule 5.1.1(v)) purges a farm with a single
-- `DELETE FROM farms WHERE id = ?` and relies on ON DELETE CASCADE all the way down. Every table's
-- *primary* parent link already cascades (production_units -> farms, sale_items -> sales, etc.),
-- but the *secondary* cross-references between sibling farm-scoped tables were left at Postgres's
-- default NO ACTION — nobody ever wrote ON DELETE on them. Any farm with real activity (a sale
-- tied to a lot, an expense tied to a purchase order, a vet visit) hits one of these and the whole
-- purge 500s: "violates foreign key constraint ... still referenced from table ...".
--
-- Every table on both sides of each constraint below already cascades from `farms` (verified
-- against pg_constraint on the live schema before writing this), so CASCADE here never reaches
-- outside the farm being deleted — it only lets Postgres finish a delete it was already going to
-- perform via the row's primary parent.

ALTER TABLE stock_movements DROP CONSTRAINT stock_movements_production_unit_id_fkey;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_production_unit_id_fkey
  FOREIGN KEY (production_unit_id) REFERENCES production_units(id) ON DELETE CASCADE;

ALTER TABLE order_items DROP CONSTRAINT order_items_production_unit_id_fkey;
ALTER TABLE order_items ADD CONSTRAINT order_items_production_unit_id_fkey
  FOREIGN KEY (production_unit_id) REFERENCES production_units(id) ON DELETE CASCADE;

ALTER TABLE sale_items DROP CONSTRAINT sale_items_production_unit_id_fkey;
ALTER TABLE sale_items ADD CONSTRAINT sale_items_production_unit_id_fkey
  FOREIGN KEY (production_unit_id) REFERENCES production_units(id) ON DELETE CASCADE;

ALTER TABLE delivery_items DROP CONSTRAINT delivery_items_production_unit_id_fkey;
ALTER TABLE delivery_items ADD CONSTRAINT delivery_items_production_unit_id_fkey
  FOREIGN KEY (production_unit_id) REFERENCES production_units(id) ON DELETE CASCADE;

ALTER TABLE expenses DROP CONSTRAINT expenses_production_unit_id_fkey;
ALTER TABLE expenses ADD CONSTRAINT expenses_production_unit_id_fkey
  FOREIGN KEY (production_unit_id) REFERENCES production_units(id) ON DELETE CASCADE;

ALTER TABLE stock_movements DROP CONSTRAINT stock_movements_daily_record_id_fkey;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_daily_record_id_fkey
  FOREIGN KEY (daily_record_id) REFERENCES daily_records(id) ON DELETE CASCADE;

ALTER TABLE stock_movements DROP CONSTRAINT stock_movements_vaccination_id_fkey;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_vaccination_id_fkey
  FOREIGN KEY (vaccination_id) REFERENCES vaccinations(id) ON DELETE CASCADE;

ALTER TABLE treatments_executed DROP CONSTRAINT treatments_executed_veterinarian_id_fkey;
ALTER TABLE treatments_executed ADD CONSTRAINT treatments_executed_veterinarian_id_fkey
  FOREIGN KEY (veterinarian_id) REFERENCES veterinarians(id) ON DELETE CASCADE;

ALTER TABLE vet_visits DROP CONSTRAINT vet_visits_veterinarian_id_fkey;
ALTER TABLE vet_visits ADD CONSTRAINT vet_visits_veterinarian_id_fkey
  FOREIGN KEY (veterinarian_id) REFERENCES veterinarians(id) ON DELETE CASCADE;

ALTER TABLE stock_movements DROP CONSTRAINT stock_movements_treatment_executed_id_fkey;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_treatment_executed_id_fkey
  FOREIGN KEY (treatment_executed_id) REFERENCES treatments_executed(id) ON DELETE CASCADE;

ALTER TABLE purchase_orders DROP CONSTRAINT purchase_orders_supplier_id_fkey;
ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_supplier_id_fkey
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE;

ALTER TABLE stock_movements DROP CONSTRAINT fk_stock_movements_purchase_order;
ALTER TABLE stock_movements ADD CONSTRAINT fk_stock_movements_purchase_order
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE;

ALTER TABLE expenses DROP CONSTRAINT expenses_purchase_order_id_fkey;
ALTER TABLE expenses ADD CONSTRAINT expenses_purchase_order_id_fkey
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE;

ALTER TABLE expenses DROP CONSTRAINT expenses_stock_movement_id_fkey;
ALTER TABLE expenses ADD CONSTRAINT expenses_stock_movement_id_fkey
  FOREIGN KEY (stock_movement_id) REFERENCES stock_movements(id) ON DELETE CASCADE;

ALTER TABLE expenses DROP CONSTRAINT fk_expenses_salary;
ALTER TABLE expenses ADD CONSTRAINT fk_expenses_salary
  FOREIGN KEY (salary_id) REFERENCES salaries(id) ON DELETE CASCADE;

ALTER TABLE orders DROP CONSTRAINT orders_client_id_fkey;
ALTER TABLE orders ADD CONSTRAINT orders_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

ALTER TABLE sales DROP CONSTRAINT sales_client_id_fkey;
ALTER TABLE sales ADD CONSTRAINT sales_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

ALTER TABLE deliveries DROP CONSTRAINT deliveries_client_id_fkey;
ALTER TABLE deliveries ADD CONSTRAINT deliveries_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

ALTER TABLE invoices DROP CONSTRAINT invoices_client_id_fkey;
ALTER TABLE invoices ADD CONSTRAINT invoices_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

ALTER TABLE payments DROP CONSTRAINT payments_client_id_fkey;
ALTER TABLE payments ADD CONSTRAINT payments_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

ALTER TABLE deliveries DROP CONSTRAINT deliveries_order_id_fkey;
ALTER TABLE deliveries ADD CONSTRAINT deliveries_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

ALTER TABLE stock_movements DROP CONSTRAINT stock_movements_sale_id_fkey;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_sale_id_fkey
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE;

ALTER TABLE invoices DROP CONSTRAINT invoices_sale_id_fkey;
ALTER TABLE invoices ADD CONSTRAINT invoices_sale_id_fkey
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE;

ALTER TABLE stock_movements DROP CONSTRAINT stock_movements_delivery_id_fkey;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_delivery_id_fkey
  FOREIGN KEY (delivery_id) REFERENCES deliveries(id) ON DELETE CASCADE;

ALTER TABLE invoices DROP CONSTRAINT invoices_delivery_id_fkey;
ALTER TABLE invoices ADD CONSTRAINT invoices_delivery_id_fkey
  FOREIGN KEY (delivery_id) REFERENCES deliveries(id) ON DELETE CASCADE;

ALTER TABLE payments DROP CONSTRAINT payments_invoice_id_fkey;
ALTER TABLE payments ADD CONSTRAINT payments_invoice_id_fkey
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE;
