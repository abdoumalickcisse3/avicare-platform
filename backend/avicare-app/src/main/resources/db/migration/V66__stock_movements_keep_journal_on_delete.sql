-- V66 — the stock journal never loses a line.
--
-- stock_movements backrefs were ON DELETE CASCADE: deleting the source entry (a treatment, a
-- vaccination, a daily record) deleted its movement row too, while stock_items.current_quantity
-- kept the decrement. Seen in production: a medication at -0.030 with an empty journal and
-- nothing left to explain it — a wrong number the platform could not even account for.
--
-- The services now post a compensating IN before deleting the source (StockConsumptionService
-- #reverseConsumptions), which restores the quantity. This migration is the safety net under
-- that: SET NULL instead of CASCADE, so a line of the journal survives the deletion of whatever
-- produced it, whichever path deletes it. The movement keeps its quantity, date, reason and note;
-- it only loses the pointer to a row that no longer exists.
--
-- production_unit_id, sale_id and delivery_id keep their CASCADE: deleting a lot or a sale
-- removes a whole object with its own compensation rules, which is out of this correction's
-- scope.

ALTER TABLE stock_movements
  DROP CONSTRAINT stock_movements_daily_record_id_fkey,
  ADD CONSTRAINT stock_movements_daily_record_id_fkey
    FOREIGN KEY (daily_record_id) REFERENCES daily_records (id) ON DELETE SET NULL;

ALTER TABLE stock_movements
  DROP CONSTRAINT stock_movements_vaccination_id_fkey,
  ADD CONSTRAINT stock_movements_vaccination_id_fkey
    FOREIGN KEY (vaccination_id) REFERENCES vaccinations (id) ON DELETE SET NULL;

ALTER TABLE stock_movements
  DROP CONSTRAINT stock_movements_treatment_executed_id_fkey,
  ADD CONSTRAINT stock_movements_treatment_executed_id_fkey
    FOREIGN KEY (treatment_executed_id) REFERENCES treatments_executed (id) ON DELETE SET NULL;
