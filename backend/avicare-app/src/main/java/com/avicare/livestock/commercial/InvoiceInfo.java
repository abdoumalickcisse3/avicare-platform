package com.avicare.livestock.commercial;

import com.avicare.livestock.domain.InvoiceStatus;
import java.time.LocalDate;

/**
 * Public, read-only view of an invoice (doc 03 §4.9), exposed through {@link CommercialFacade}.
 * {@code clientId} is null for a walk-in (client-less) invoice. {@code outstandingXof} = {@code
 * totalXof - amountPaidXof}. Amounts are HT only (D25).
 */
public record InvoiceInfo(
    Long id,
    String invoiceNumber,
    Long clientId,
    InvoiceStatus status,
    long totalXof,
    long amountPaidXof,
    long outstandingXof,
    LocalDate issueDate,
    LocalDate dueDate) {}
