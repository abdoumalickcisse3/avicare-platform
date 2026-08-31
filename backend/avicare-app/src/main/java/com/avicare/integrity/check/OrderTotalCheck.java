package com.avicare.integrity.check;

import com.avicare.integrity.domain.Severity;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

/** An order's total must be the sum of its lines. Cancelled orders are left alone. */
@Component
public class OrderTotalCheck extends SqlIntegrityCheck {

  public OrderTotalCheck(ObjectProvider<NamedParameterJdbcTemplate> jdbc) {
    super(jdbc);
  }

  @Override
  public String key() {
    return "order_total";
  }

  @Override
  public String label() {
    return "Total de commande différent de la somme des lignes";
  }

  @Override
  public Severity severity() {
    return Severity.CRITICAL;
  }

  @Override
  protected String entityType() {
    return "order";
  }

  @Override
  protected String sql() {
    return """
        SELECT o.id      AS entity_id,
               o.farm_id AS farm_id,
               COALESCE(SUM(oi.line_total_xof), 0)::text AS expected,
               o.total_xof::text                         AS actual
          FROM orders o
          LEFT JOIN order_items oi ON oi.order_id = o.id
         WHERE o.updated_at < :cutoff
           AND o.status <> 'CANCELLED'
         GROUP BY o.id, o.farm_id, o.total_xof
        HAVING o.total_xof <> COALESCE(SUM(oi.line_total_xof), 0)
        """;
  }
}
