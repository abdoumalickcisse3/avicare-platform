package com.avicare.integrity.service;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.common.api.exception.NotFoundException;
import java.math.BigDecimal;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Rebuilds a derived figure from the records it is derived from.
 *
 * <p><b>What this is allowed to touch, and nothing else:</b> aggregates the platform itself
 * maintains — a stock quantity, an invoice's collected amount, a client's receivable. It never
 * rewrites something a human typed: a movement quantity, a payment amount, a line total. Those are
 * statements about the real world, and no arithmetic here is entitled to overrule them. A defect in
 * that direction is a support conversation, not a button.
 *
 * <p>Every entry point is dry-run by default. Applying takes a written reason and is audited: this
 * writes to a farmer's live data, and the person doing it at 3am should have to say why.
 *
 * <p>The expected-value expressions mirror those of the matching {@code IntegrityCheck}. What
 * guarantees they agree is {@code IntegrityFlowIT}: it injects an inconsistency, watches the check
 * find it, recomputes, and re-runs the check to see it gone.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class RecomputeService {

  private static final Set<String> RECOMPUTABLE = Set.of("stock_item", "invoice", "client");

  /**
   * Optional, like every other JDBC user here: the DB-less test contexts boot the web layer without
   * a {@code DataSource}. Unlike a check, though, a recompute asked for with no database is a wiring
   * mistake and says so rather than quietly returning zeros.
   */
  private final ObjectProvider<NamedParameterJdbcTemplate> jdbcProvider;

  @Transactional
  public RecomputeResult recomputeStockQuantity(Long stockItemId, boolean dryRun) {
    BigDecimal before =
        scalar(
            "SELECT current_quantity FROM stock_items WHERE id = :id", stockItemId, "stock_item");
    BigDecimal after =
        scalar(
            """
            SELECT COALESCE((SELECT sm.quantity_after
                               FROM stock_movements sm
                              WHERE sm.stock_item_id = :id
                              ORDER BY sm.created_at DESC, sm.id DESC
                              LIMIT 1), si.current_quantity)
              FROM stock_items si WHERE si.id = :id
            """,
            stockItemId,
            "stock_item");

    if (!dryRun) {
      update(
          "UPDATE stock_items SET current_quantity = :value, updated_at = NOW() WHERE id = :id",
          stockItemId,
          after);
    }
    return result("stock_item", stockItemId, before, after, dryRun);
  }

  @Transactional
  public RecomputeResult recomputeInvoicePaid(Long invoiceId, boolean dryRun) {
    BigDecimal before =
        scalar("SELECT amount_paid_xof FROM invoices WHERE id = :id", invoiceId, "invoice");
    BigDecimal after =
        scalar(
            """
            SELECT COALESCE(SUM(p.amount_xof) FILTER (WHERE p.status = 'COMPLETED'), 0)
              FROM payments p WHERE p.invoice_id = :id
            """,
            invoiceId,
            "invoice");

    if (!dryRun) {
      update(
          "UPDATE invoices SET amount_paid_xof = :value, updated_at = NOW() WHERE id = :id",
          invoiceId,
          after);
    }
    return result("invoice", invoiceId, before, after, dryRun);
  }

  @Transactional
  public RecomputeResult recomputeClientBalance(Long clientId, boolean dryRun) {
    BigDecimal before =
        scalar("SELECT current_balance_xof FROM clients WHERE id = :id", clientId, "client");
    BigDecimal after =
        scalar(
            """
            SELECT COALESCE(SUM(due), 0) FROM (
              SELECT i.total_xof
                       - COALESCE(SUM(p.amount_xof) FILTER (WHERE p.status = 'COMPLETED'), 0) AS due
                FROM invoices i
                LEFT JOIN payments p ON p.invoice_id = i.id
               WHERE i.client_id = :id
                 AND i.status <> 'CANCELLED'
               GROUP BY i.id, i.total_xof
            ) per_invoice
            """,
            clientId,
            "client");

    if (!dryRun) {
      update(
          "UPDATE clients SET current_balance_xof = :value, updated_at = NOW() WHERE id = :id",
          clientId,
          after);
    }
    return result("client", clientId, before, after, dryRun);
  }

  /** Dispatch by the entity type a finding names — the console never has to know the method. */
  @Transactional
  public RecomputeResult recompute(String entityType, Long entityId, boolean dryRun) {
    return switch (entityType) {
      case "stock_item" -> recomputeStockQuantity(entityId, dryRun);
      case "invoice" -> recomputeInvoicePaid(entityId, dryRun);
      case "client" -> recomputeClientBalance(entityId, dryRun);
      default ->
          throw new BusinessRuleException(
              "RECOMPUTE_NOT_SUPPORTED",
              "No recompute exists for "
                  + entityType
                  + " — it is not a derived figure, so correcting it is a business decision");
    };
  }

  /** Whether the console should offer the button at all. */
  public boolean supports(String entityType) {
    return RECOMPUTABLE.contains(entityType);
  }

  private NamedParameterJdbcTemplate jdbc() {
    NamedParameterJdbcTemplate jdbc = jdbcProvider.getIfAvailable();
    if (jdbc == null) {
      throw new IllegalStateException("No DataSource: a recompute cannot run without a database");
    }
    return jdbc;
  }

  private BigDecimal scalar(String sql, Long id, String entityType) {
    try {
      BigDecimal value =
          jdbc().queryForObject(sql, new MapSqlParameterSource("id", id), BigDecimal.class);
      if (value == null) {
        throw NotFoundException.of(entityType, id);
      }
      return value;
    } catch (org.springframework.dao.EmptyResultDataAccessException e) {
      throw NotFoundException.of(entityType, id);
    }
  }

  private void update(String sql, Long id, BigDecimal value) {
    jdbc().update(sql, new MapSqlParameterSource("id", id).addValue("value", value));
  }

  private static RecomputeResult result(
      String entityType, Long entityId, BigDecimal before, BigDecimal after, boolean dryRun) {
    return new RecomputeResult(
        entityType,
        entityId,
        before.stripTrailingZeros().toPlainString(),
        after.stripTrailingZeros().toPlainString(),
        after.subtract(before).stripTrailingZeros().toPlainString(),
        !dryRun);
  }
}
