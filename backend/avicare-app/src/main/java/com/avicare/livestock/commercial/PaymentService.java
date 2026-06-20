package com.avicare.livestock.commercial;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.common.api.exception.NotFoundException;
import com.avicare.common.api.exception.ValidationException;
import com.avicare.livestock.domain.Invoice;
import com.avicare.livestock.domain.Payment;
import com.avicare.livestock.domain.PaymentStatus;
import com.avicare.livestock.repository.PaymentRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Payments received against invoices (Sprint B5-4). Recording a payment applies it to its invoice
 * through {@link InvoiceService#registerPayment} (raises {@code amount_paid}, moves the invoice to
 * PARTIALLY_PAID / PAID, refuses overpayment & cancelled invoices) and lowers the client's
 * receivable (encours, D26). One payment targets exactly one invoice. Voiding a payment reverses
 * both effects and marks it CANCELLED. Numbers are minted {@code P-YYYY-NNN} per farm per year
 * (D24); amounts are HT (D25). RBAC is enforced at the controller layer (B5-5).
 */
@Service
@RequiredArgsConstructor
public class PaymentService {

  private final PaymentRepository paymentRepository;
  private final InvoiceService invoiceService;
  private final ClientService clientService;

  @Transactional
  public Payment record(Long farmId, PaymentCommand cmd, Long userId) {
    if (cmd.amountXof() <= 0) {
      throw new ValidationException("PAYMENT_AMOUNT", "Payment amount must be greater than 0");
    }
    if (cmd.method() == null) {
      throw new ValidationException("PAYMENT_METHOD", "Payment method is required");
    }

    // Apply to the invoice first — this validates (not cancelled, no overpayment) and updates it.
    Invoice invoice = invoiceService.registerPayment(farmId, cmd.invoiceId(), cmd.amountXof());
    Long clientId = invoice.getClient() != null ? invoice.getClient().getId() : null;
    if (clientId != null) {
      clientService.adjustBalance(farmId, clientId, -cmd.amountXof()); // D26: encours down
    }

    Payment payment = new Payment();
    payment.setFarmId(farmId);
    payment.setInvoiceId(cmd.invoiceId());
    payment.setClientId(clientId);
    payment.setAmountXof(cmd.amountXof());
    payment.setMethod(cmd.method());
    payment.setStatus(PaymentStatus.COMPLETED);
    payment.setPaymentDate(cmd.paymentDate() != null ? cmd.paymentDate() : LocalDate.now());
    payment.setReference(cmd.reference());
    payment.setNotes(cmd.notes());
    payment.setCreatedBy(userId);
    payment.setPaymentNumber(generatePaymentNumber(farmId, payment.getPaymentDate().getYear()));
    return paymentRepository.save(payment);
  }

  /** Void a payment: reverse it on the invoice and restore the client's receivable. */
  @Transactional
  public Payment voidPayment(Long farmId, Long paymentId, String reason, Long userId) {
    Payment payment = load(farmId, paymentId);
    if (payment.getStatus() != PaymentStatus.COMPLETED) {
      throw new BusinessRuleException(
          "INVALID_PAYMENT_TRANSITION", "Cannot void a payment in status " + payment.getStatus());
    }
    invoiceService.reversePayment(farmId, payment.getInvoiceId(), payment.getAmountXof());
    if (payment.getClientId() != null) {
      clientService.adjustBalance(farmId, payment.getClientId(), payment.getAmountXof());
    }
    payment.setStatus(PaymentStatus.CANCELLED);
    payment.setCancelledBy(userId);
    payment.setCancelledAt(LocalDateTime.now());
    payment.setCancellationReason(reason);
    return payment;
  }

  @Transactional(readOnly = true)
  public Payment getById(Long farmId, Long paymentId) {
    return load(farmId, paymentId);
  }

  @Transactional(readOnly = true)
  public List<Payment> listForInvoice(Long farmId, Long invoiceId) {
    return paymentRepository.findByFarmIdAndInvoiceIdOrderById(farmId, invoiceId);
  }

  @Transactional(readOnly = true)
  public List<Payment> listForFarm(Long farmId) {
    return paymentRepository.findByFarmIdOrderByPaymentDateDescIdDesc(farmId);
  }

  // --- internals ------------------------------------------------------

  private Payment load(Long farmId, Long paymentId) {
    return paymentRepository
        .findByFarmIdAndId(farmId, paymentId)
        .orElseThrow(() -> NotFoundException.of("Payment", paymentId));
  }

  private String generatePaymentNumber(Long farmId, int year) {
    int next = paymentRepository.findMaxSequence(farmId, "P-" + year + "-%") + 1;
    return String.format("P-%d-%03d", year, next);
  }
}
