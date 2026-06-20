package com.avicare.livestock.commercial.dto;

import com.avicare.livestock.domain.Payment;
import com.avicare.livestock.domain.PaymentMethod;
import com.avicare.livestock.domain.PaymentStatus;
import java.time.LocalDate;

/** A payment (Sprint B5-5). */
public record PaymentResponse(
    Long id,
    Long farmId,
    String paymentNumber,
    Long invoiceId,
    Long clientId,
    Long amountXof,
    PaymentMethod method,
    PaymentStatus status,
    LocalDate paymentDate,
    String reference,
    String notes) {

  public static PaymentResponse from(Payment p) {
    return new PaymentResponse(
        p.getId(),
        p.getFarmId(),
        p.getPaymentNumber(),
        p.getInvoiceId(),
        p.getClientId(),
        p.getAmountXof(),
        p.getMethod(),
        p.getStatus(),
        p.getPaymentDate(),
        p.getReference(),
        p.getNotes());
  }
}
