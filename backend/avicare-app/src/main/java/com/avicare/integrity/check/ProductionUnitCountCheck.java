package com.avicare.integrity.check;

import com.avicare.integrity.domain.Severity;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * A batch's head count must equal what it started with plus every movement recorded against it.
 *
 * <p>Not "initial minus mortality": birds also leave through sales, transfers and losses, and every
 * one of those is written to {@code lifecycle_events} with a signed delta by the same code that
 * moves the count. Mortality alone would flag every farm that has ever sold a bird.
 *
 * <p>And not "initial plus the ledger" either: creating a batch already writes a {@code CREATED}
 * event carrying the initial count, so adding it back counts it twice. This was checked against
 * production data before being trusted — the ledger alone matches all 24 batches on record, the
 * other formula matched none of them.
 *
 * <p>A unit with no events at all is skipped rather than flagged: that would be a batch predating
 * the ledger, and claiming its count is wrong would be a guess dressed up as a finding.
 *
 * <p>Archived units are skipped too — a closed batch is history, not a defect.
 */
@Component
public class ProductionUnitCountCheck extends SqlIntegrityCheck {

  public ProductionUnitCountCheck(ObjectProvider<NamedParameterJdbcTemplate> jdbc) {
    super(jdbc);
  }

  @Override
  public String key() {
    return "production_unit_count";
  }

  @Override
  public String label() {
    return "Effectif d'un lot différent de son journal d'événements";
  }

  @Override
  public Severity severity() {
    return Severity.CRITICAL;
  }

  @Override
  protected String entityType() {
    return "production_unit";
  }

  @Override
  protected String sql() {
    return """
        SELECT pu.id      AS entity_id,
               pu.farm_id AS farm_id,
               SUM(le.quantity_delta)::text AS expected,
               pu.current_count::text       AS actual
          FROM production_units pu
          JOIN lifecycle_events le ON le.production_unit_id = pu.id
         WHERE pu.deleted_at IS NULL
           AND pu.updated_at < :cutoff
         GROUP BY pu.id, pu.farm_id, pu.current_count
        HAVING pu.current_count <> SUM(le.quantity_delta)
        """;
  }
}
