package com.avicare.integrity.check;

import com.avicare.integrity.domain.Severity;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * A terminal state must carry the evidence that it was reached.
 *
 * <p>Nothing is miscounted here, which is why it is a warning rather than a critical: an order
 * marked delivered with no delivery date is a workflow that skipped a step — a bug to chase, not
 * money to correct.
 */
@Component
public class WorkflowStateCheck extends SqlIntegrityCheck {

  public WorkflowStateCheck(ObjectProvider<NamedParameterJdbcTemplate> jdbc) {
    super(jdbc);
  }

  @Override
  public String key() {
    return "workflow_state";
  }

  @Override
  public String label() {
    return "État de workflow incohérent avec ses champs";
  }

  @Override
  public Severity severity() {
    return Severity.WARNING;
  }

  @Override
  protected String entityType() {
    return "row";
  }

  @Override
  protected String sql() {
    return """
        SELECT 'order' AS entity_type, o.id AS entity_id, o.farm_id AS farm_id,
               'delivered_at et delivered_by renseignés' AS expected,
               'DELIVERED sans trace de livraison'       AS actual
          FROM orders o
         WHERE o.updated_at < :cutoff
           AND o.status = 'DELIVERED'
           AND (o.delivered_at IS NULL OR o.delivered_by IS NULL)
        UNION ALL
        SELECT 'invoice', i.id, i.farm_id,
               i.total_xof::text,
               i.amount_paid_xof::text
          FROM invoices i
         WHERE i.updated_at < :cutoff
           AND i.status = 'PAID'
           AND i.amount_paid_xof <> i.total_xof
        UNION ALL
        SELECT 'invoice', i.id, i.farm_id,
               'statut PAID'                          AS expected,
               'ISSUED alors que tout est payé'       AS actual
          FROM invoices i
         WHERE i.updated_at < :cutoff
           AND i.status IN ('ISSUED', 'PARTIALLY_PAID')
           AND i.total_xof > 0
           AND i.amount_paid_xof >= i.total_xof
        """;
  }
}
