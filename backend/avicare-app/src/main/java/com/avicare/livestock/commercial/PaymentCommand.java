package com.avicare.livestock.commercial;

import com.avicare.livestock.domain.PaymentMethod;
import java.time.LocalDate;

/**
 * Input to record a payment against an invoice (Sprint B5-4). {@code amountXof} is HT (D25) and
 * must be &gt; 0 and not exceed the invoice's outstanding (overpayment refused). {@code
 * paymentDate} defaults to today when null. {@code reference} is an optional external transaction
 * reference (mobile-money id, cheque number…).
 */
public record PaymentCommand(
    Long invoiceId,
    long amountXof,
    PaymentMethod method,
    LocalDate paymentDate,
    String reference,
    String notes) {}
