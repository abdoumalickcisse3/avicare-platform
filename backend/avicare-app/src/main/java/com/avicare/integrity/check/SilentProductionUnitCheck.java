package com.avicare.integrity.check;

import com.avicare.integrity.domain.Severity;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * An open batch nobody has recorded anything on for a month.
 *
 * <p>Usually not a bug at all: a farmer stopped entering data, or a batch was left open after being
 * emptied. It is here because both cases end the same way — figures the farm still trusts, quietly
 * drifting from reality. INFO, and per farm rather than per platform: it is a nudge for support,
 * not an incident.
 */
@Component
public class SilentProductionUnitCheck extends SqlIntegrityCheck {

  public SilentProductionUnitCheck(ObjectProvider<NamedParameterJdbcTemplate> jdbc) {
    super(jdbc);
  }

  @Value("${avicare.integrity.silent-unit-days:30}")
  private int silentDays;

  @Override
  public String key() {
    return "silent_production_unit";
  }

  @Override
  public String label() {
    return "Lot ouvert sans aucune saisie depuis 30 jours";
  }

  @Override
  public Severity severity() {
    return Severity.INFO;
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
               CONCAT('une saisie depuis ', %d, ' jours') AS expected,
               COALESCE(MAX(dr.record_date)::text, 'aucune saisie')  AS actual
          FROM production_units pu
          LEFT JOIN daily_records dr ON dr.production_unit_id = pu.id
         WHERE pu.deleted_at IS NULL
           AND pu.status = 'ACTIVE'
           AND pu.start_date < CURRENT_DATE - %d
           AND pu.updated_at < :cutoff
         GROUP BY pu.id, pu.farm_id
        HAVING COALESCE(MAX(dr.record_date), pu.start_date) < CURRENT_DATE - %d
        """
        .formatted(silentDays, silentDays, silentDays);
  }
}
