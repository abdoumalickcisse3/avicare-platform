package com.avicare.livestock.commercial.dto;

import com.avicare.livestock.commercial.PaymentCommand;
import com.avicare.livestock.domain.PaymentMethod;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

/** Record a payment against an invoice (Sprint B5-5). {@code amountXof} HT, must not exceed due. */
public record PaymentRequest(
    @NotNull Long invoiceId,
    @NotNull @Positive Long amountXof,
    @NotNull PaymentMethod method,
    LocalDate paymentDate,
    @Size(max = 150) String reference,
    @Size(max = 2000) String notes) {

  public PaymentCommand toCommand() {
    return new PaymentCommand(invoiceId, amountXof, method, paymentDate, reference, notes);
  }
}
