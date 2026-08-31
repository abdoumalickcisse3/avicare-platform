package com.avicare.integrity.check;

import com.avicare.integrity.domain.Severity;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * A child row must belong to the same farm — and the same client — as its parent.
 *
 * <p>This replaces the "orphan foreign keys" idea, which cannot fire: {@code deliveries.order_id}
 * and {@code payments.invoice_id} are NOT NULL behind foreign keys, so the database already refuses
 * the orphan. What it does <i>not</i> refuse is a child carrying a different {@code farm_id} from
 * its parent — two independent columns that must agree. That is the shape a tenant-isolation bug
 * would take, and it is worth a nightly look precisely because nothing else would catch it.
 */
@Component
public class TenantCoherenceCheck extends SqlIntegrityCheck {

  public TenantCoherenceCheck(ObjectProvider<NamedParameterJdbcTemplate> jdbc) {
    super(jdbc);
  }

  @Override
  public String key() {
    return "tenant_coherence";
  }

  @Override
  public String label() {
    return "Ligne rattachée à une ferme ou un client différent de son parent";
  }

  @Override
  public Severity severity() {
    return Severity.CRITICAL;
  }

  @Override
  protected String entityType() {
    return "row";
  }

  @Override
  protected String sql() {
    return """
        SELECT 'delivery' AS entity_type, d.id AS entity_id, d.farm_id AS farm_id,
               o.farm_id::text AS expected, d.farm_id::text AS actual
          FROM deliveries d JOIN orders o ON o.id = d.order_id
         WHERE d.updated_at < :cutoff AND d.farm_id <> o.farm_id
        UNION ALL
        SELECT 'payment', p.id, p.farm_id, i.farm_id::text, p.farm_id::text
          FROM payments p JOIN invoices i ON i.id = p.invoice_id
         WHERE p.updated_at < :cutoff AND p.farm_id <> i.farm_id
        UNION ALL
        SELECT 'payment', p.id, p.farm_id, i.client_id::text, p.client_id::text
          FROM payments p JOIN invoices i ON i.id = p.invoice_id
         WHERE p.updated_at < :cutoff
           AND p.client_id IS NOT NULL AND i.client_id IS NOT NULL
           AND p.client_id <> i.client_id
        UNION ALL
        SELECT 'invoice', i.id, i.farm_id, s.farm_id::text, i.farm_id::text
          FROM invoices i JOIN sales s ON s.id = i.sale_id
         WHERE i.updated_at < :cutoff AND i.farm_id <> s.farm_id
        UNION ALL
        SELECT 'invoice', i.id, i.farm_id, d.farm_id::text, i.farm_id::text
          FROM invoices i JOIN deliveries d ON d.id = i.delivery_id
         WHERE i.updated_at < :cutoff AND i.farm_id <> d.farm_id
        """;
  }
}
