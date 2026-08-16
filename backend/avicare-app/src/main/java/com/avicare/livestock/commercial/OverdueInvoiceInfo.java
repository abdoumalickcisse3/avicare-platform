package com.avicare.livestock.commercial;

/**
 * Neutral, cross-context view of an overdue invoice (ISSUED/PARTIALLY_PAID past its due date, D24),
 * exposed through {@link CommercialFacade#overdueInvoices(Long)} for the notification context
 * (Sprint C1).
 */
public record OverdueInvoiceInfo(
    Long invoiceId, Long clientId, String clientName, long outstandingXof, long daysOverdue) {}
