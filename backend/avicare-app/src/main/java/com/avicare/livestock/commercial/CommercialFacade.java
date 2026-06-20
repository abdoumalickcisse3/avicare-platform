package com.avicare.livestock.commercial;

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
}
