package com.avicare.integrity.check;

import com.avicare.integrity.domain.Severity;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * A client's receivable must equal what they still owe.
 *
 * <p>The formula is derived from the writers, not from intuition. The balance moves by deltas:
 * issuing an invoice adds its total, a payment subtracts its amount, cancelling an invoice
 * subtracts only what was <i>still outstanding</i>, and voiding a payment adds it back. Replaying
 * that sequence gives: a cancelled invoice contributes nothing at all — its collected payments
 * included — and every other invoice contributes what remains unpaid on it.
 *
 * <p>The obvious "sum of invoices minus sum of payments" is wrong: on an invoice of 1000 cancelled
 * after 400 was paid, it reports −400 where 0 is correct.
 */
@Component
public class ClientBalanceCheck extends SqlIntegrityCheck {

  public ClientBalanceCheck(ObjectProvider<NamedParameterJdbcTemplate> jdbc) {
    super(jdbc);
  }

  @Override
  public String key() {
    return "client_balance";
  }

  @Override
  public String label() {
    return "Encours client différent du reste dû";
  }

  @Override
  public Severity severity() {
    return Severity.CRITICAL;
  }

  @Override
  protected String entityType() {
    return "client";
  }

  @Override
  protected String sql() {
    return """
        WITH outstanding AS (
          SELECT i.client_id,
                 i.total_xof
                   - COALESCE(SUM(p.amount_xof) FILTER (WHERE p.status = 'COMPLETED'), 0) AS due
            FROM invoices i
            LEFT JOIN payments p ON p.invoice_id = i.id
           WHERE i.status <> 'CANCELLED'
             AND i.client_id IS NOT NULL
           GROUP BY i.id, i.client_id, i.total_xof
        )
        SELECT c.id      AS entity_id,
               c.farm_id AS farm_id,
               COALESCE(SUM(o.due), 0)::text AS expected,
               c.current_balance_xof::text   AS actual
          FROM clients c
          LEFT JOIN outstanding o ON o.client_id = c.id
         WHERE c.updated_at < :cutoff
         GROUP BY c.id, c.farm_id, c.current_balance_xof
        HAVING c.current_balance_xof <> COALESCE(SUM(o.due), 0)
        """;
  }
}
