package com.avicare.integrity.check;

import com.avicare.integrity.domain.Severity;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Health entries that were saved but say nothing.
 *
 * <p>A vaccination on zero subjects, or a treatment at zero dose, is not a data corruption — it is
 * a form that went through when it should not have. Worth surfacing (it usually points at a UI that
 * lets an empty field pass), never worth waking anyone. On the production data this found 16 real
 * cases, all of them a {@code dose_per_subject} left null by the form.
 */
@Component
public class HealthEntryQualityCheck extends SqlIntegrityCheck {

  public HealthEntryQualityCheck(ObjectProvider<NamedParameterJdbcTemplate> jdbc) {
    super(jdbc);
  }

  @Override
  public String key() {
    return "health_entry_quality";
  }

  @Override
  public String label() {
    return "Saisie sanitaire vide (dose ou effectif à zéro)";
  }

  @Override
  public Severity severity() {
    return Severity.INFO;
  }

  @Override
  protected String entityType() {
    return "row";
  }

  @Override
  protected String sql() {
    return """
        SELECT 'vaccination' AS entity_type, v.id AS entity_id, pu.farm_id AS farm_id,
               '> 0'                                  AS expected,
               CONCAT('dose ', COALESCE(v.dose_per_subject::text, 'non renseignée'),
                      ' × ', COALESCE(v.subjects_count::text, 'non renseigné')) AS actual
          FROM vaccinations v
          JOIN production_units pu ON pu.id = v.production_unit_id
         WHERE v.updated_at < :cutoff
           AND (v.dose_per_subject = 0 OR COALESCE(v.subjects_count, 0) = 0)
        UNION ALL
        SELECT 'treatment', t.id, pu.farm_id,
               '> 0',
               CONCAT('dose ', COALESCE(t.dose_amount::text, 'non renseignée'),
                      ' × ', COALESCE(t.subjects_count::text, 'non renseigné'))
          FROM treatments_executed t
          JOIN production_units pu ON pu.id = t.production_unit_id
         WHERE t.updated_at < :cutoff
           AND (t.dose_amount = 0 OR COALESCE(t.subjects_count, 0) = 0)
        """;
  }
}
