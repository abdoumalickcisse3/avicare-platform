package com.avicare.integrity.check;

import com.avicare.integrity.domain.Severity;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * An invoice's paid amount must equal the payments actually collected against it.
 *
 * <p>Only {@code COMPLETED} payments count: a void is reversible (D26), and counting a cancelled
 * payment would raise an alarm on every correction a farmer makes.
 */
@Component
public class InvoicePaidCheck extends SqlIntegrityCheck {

  public InvoicePaidCheck(ObjectProvider<NamedParameterJdbcTemplate> jdbc) {
    super(jdbc);
  }

  @Override
  public String key() {
    return "invoice_paid";
  }

  @Override
  public String label() {
    return "Montant payé d'une facture différent de ses paiements";
  }

  @Override
  public Severity severity() {
    return Severity.CRITICAL;
  }

  @Override
  protected String entityType() {
    return "invoice";
  }

  @Override
  protected String sql() {
    return """
        SELECT i.id      AS entity_id,
               i.farm_id AS farm_id,
               COALESCE(SUM(p.amount_xof) FILTER (WHERE p.status = 'COMPLETED'), 0)::text AS expected,
               i.amount_paid_xof::text                                                    AS actual
          FROM invoices i
          LEFT JOIN payments p ON p.invoice_id = i.id
         WHERE i.updated_at < :cutoff
           AND i.status <> 'CANCELLED'
         GROUP BY i.id, i.farm_id, i.amount_paid_xof
        HAVING i.amount_paid_xof
               <> COALESCE(SUM(p.amount_xof) FILTER (WHERE p.status = 'COMPLETED'), 0)
        """;
  }
}
