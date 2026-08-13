package com.avicare.livestock.commercial;

/**
 * Public view of an open (payable) invoice: its id, human {@code invoiceNumber} and the still-due
 * {@code outstandingXof}. Exposed through {@link CommercialFacade} so the assistant can target a
 * client's oldest unpaid invoice for an encaissement without reaching into the invoice entities.
 */
public record OpenInvoiceInfo(Long invoiceId, String invoiceNumber, long outstandingXof) {}
