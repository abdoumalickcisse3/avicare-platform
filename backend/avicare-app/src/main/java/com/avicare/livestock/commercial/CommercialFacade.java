package com.avicare.livestock.commercial;

import com.avicare.common.api.dto.ActivityItem;
import com.avicare.livestock.commercial.dto.CommercialStats;
import java.time.LocalDate;
import java.util.List;

/**
 * Public contract of the {@code commercial} sub-domain (doc 03 §4.9). Other parts of the app —
 * finance (B6), reporting, the REST layer (B5-5) — read commercial state through this facade rather
 * than the individual services, so the sub-domain keeps a small, stable public surface. All reads
 * are farm-scoped (multi-tenant).
 */
public interface CommercialFacade {

  /** Credit standing of a client, for credit-overshoot alerts. */
  ClientCreditInfo getClientCredit(Long farmId, Long clientId);

  /** Summary of an invoice (totals, status, outstanding). */
  InvoiceInfo findInvoiceById(Long farmId, Long invoiceId);

  /**
   * Aggregated dashboard stats for a farm over the inclusive period [{@code from}, {@code to}].
   * Period KPIs (revenue, series, topClients) honour the window; snapshot KPIs (outstanding,
   * overdue, worklist counts, topDebtors) reflect the current state. Task 1.1, Spec B.
   */
  CommercialStats commercialStats(Long farmId, LocalDate from, LocalDate to);

  /** Total revenue (COMPLETED sales) attributed to a production unit. */
  long revenueByProductionUnit(Long farmId, Long productionUnitId);

  /** Σ des ventes directes COMPLETED de la ferme (lifetime), pour le P&L finance. */
  long totalSalesRevenue(Long farmId);

  /** Σ des montants encaissés sur les factures de LIVRAISON non annulées (lifetime). */
  long totalPaidFromDeliveryInvoices(Long farmId);

  /** Up to {@code limit} most recent commercial activity items (sales + payments). */
  List<ActivityItem> recentActivity(Long farmId, int limit);
}
