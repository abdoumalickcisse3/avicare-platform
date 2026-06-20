package com.avicare.livestock.commercial;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatExceptionOfType;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.common.api.exception.ValidationException;
import com.avicare.livestock.domain.Client;
import com.avicare.livestock.domain.ClientType;
import com.avicare.livestock.domain.Invoice;
import com.avicare.livestock.domain.InvoiceStatus;
import com.avicare.livestock.domain.Payment;
import com.avicare.livestock.domain.PaymentMethod;
import com.avicare.livestock.domain.PaymentStatus;
import com.avicare.livestock.repository.PaymentRepository;
import java.time.LocalDate;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

/**
 * Unit test for {@link PaymentService} — recording a payment (numbering, applying it to the invoice
 * via {@link InvoiceService}, lowering the client receivable D26) and voiding it (reversal). All
 * collaborators mocked; runs in surefire/CI (no Docker).
 */
class PaymentServiceTest {

  private PaymentRepository paymentRepository;
  private InvoiceService invoiceService;
  private ClientService clientService;
  private PaymentService service;

  @BeforeEach
  void setUp() {
    paymentRepository = Mockito.mock(PaymentRepository.class);
    invoiceService = Mockito.mock(InvoiceService.class);
    clientService = Mockito.mock(ClientService.class);
    service = new PaymentService(paymentRepository, invoiceService, clientService);

    when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> inv.getArgument(0));
    when(paymentRepository.findMaxSequence(eq(7L), any())).thenReturn(0);
  }

  // --- record ---------------------------------------------------------

  @Test
  void record_appliesToInvoice_lowersReceivable_andNumbers() {
    when(invoiceService.registerPayment(7L, 50L, 10_000L))
        .thenReturn(invoice(50L, client(3L), 42_500L, 10_000L));

    Payment payment =
        service.record(
            7L,
            new PaymentCommand(
                50L, 10_000L, PaymentMethod.MOBILE_MONEY, LocalDate.now(), "WAVE-1", null),
            42L);

    assertThat(payment.getStatus()).isEqualTo(PaymentStatus.COMPLETED);
    assertThat(payment.getPaymentNumber()).isEqualTo("P-" + LocalDate.now().getYear() + "-001");
    assertThat(payment.getInvoiceId()).isEqualTo(50L);
    assertThat(payment.getClientId()).isEqualTo(3L);
    assertThat(payment.getAmountXof()).isEqualTo(10_000L);
    assertThat(payment.getMethod()).isEqualTo(PaymentMethod.MOBILE_MONEY);
    assertThat(payment.getCreatedBy()).isEqualTo(42L);

    verify(invoiceService).registerPayment(7L, 50L, 10_000L);
    verify(clientService).adjustBalance(7L, 3L, -10_000L); // D26
  }

  @Test
  void record_walkInInvoice_doesNotTouchReceivable() {
    when(invoiceService.registerPayment(7L, 50L, 6_000L))
        .thenReturn(invoice(50L, null, 6_000L, 6_000L));

    service.record(7L, new PaymentCommand(50L, 6_000L, PaymentMethod.CASH, null, null, null), 42L);

    verify(clientService, never()).adjustBalance(any(), any(), anyLong());
  }

  @Test
  void record_numbersAreSequentialPerYear() {
    when(invoiceService.registerPayment(eq(7L), eq(50L), anyLong()))
        .thenReturn(invoice(50L, client(3L), 42_500L, 1_000L));
    when(paymentRepository.findMaxSequence(eq(7L), any())).thenReturn(7);

    Payment payment =
        service.record(
            7L, new PaymentCommand(50L, 1_000L, PaymentMethod.CASH, null, null, null), 42L);

    assertThat(payment.getPaymentNumber()).isEqualTo("P-" + LocalDate.now().getYear() + "-008");
  }

  @Test
  void record_nonPositiveAmountThrows_andDoesNotTouchInvoice() {
    PaymentCommand cmd = new PaymentCommand(50L, 0L, PaymentMethod.CASH, null, null, null);

    assertThatExceptionOfType(ValidationException.class)
        .isThrownBy(() -> service.record(7L, cmd, 42L));
    verify(invoiceService, never()).registerPayment(any(), any(), anyLong());
  }

  @Test
  void record_overpaymentPropagatesBusinessRule() {
    when(invoiceService.registerPayment(7L, 50L, 99_000L))
        .thenThrow(new BusinessRuleException("OVERPAYMENT", "too much"));

    assertThatExceptionOfType(BusinessRuleException.class)
        .isThrownBy(
            () ->
                service.record(
                    7L,
                    new PaymentCommand(50L, 99_000L, PaymentMethod.CASH, null, null, null),
                    42L));
    verify(clientService, never()).adjustBalance(any(), any(), anyLong());
  }

  // --- void -----------------------------------------------------------

  @Test
  void voidPayment_reversesInvoiceAndReceivable() {
    Payment payment = stored(70L, PaymentStatus.COMPLETED, 50L, 3L, 10_000L);

    Payment result = service.voidPayment(7L, 70L, "erreur de saisie", 42L);

    assertThat(result.getStatus()).isEqualTo(PaymentStatus.CANCELLED);
    assertThat(result.getCancellationReason()).isEqualTo("erreur de saisie");
    assertThat(result.getCancelledBy()).isEqualTo(42L);
    verify(invoiceService).reversePayment(7L, 50L, 10_000L);
    verify(clientService).adjustBalance(7L, 3L, 10_000L); // receivable restored
  }

  @Test
  void voidPayment_walkIn_doesNotTouchReceivable() {
    stored(70L, PaymentStatus.COMPLETED, 50L, null, 6_000L);

    service.voidPayment(7L, 70L, "x", 42L);

    verify(invoiceService).reversePayment(7L, 50L, 6_000L);
    verify(clientService, never()).adjustBalance(any(), any(), anyLong());
  }

  @Test
  void voidPayment_alreadyCancelledThrowsBusinessRule() {
    stored(70L, PaymentStatus.CANCELLED, 50L, 3L, 10_000L);

    assertThatExceptionOfType(BusinessRuleException.class)
        .isThrownBy(() -> service.voidPayment(7L, 70L, "encore", 42L));
  }

  // --- helpers --------------------------------------------------------

  private Payment stored(
      Long id, PaymentStatus status, Long invoiceId, Long clientId, long amount) {
    Payment payment = new Payment();
    payment.setId(id);
    payment.setFarmId(7L);
    payment.setStatus(status);
    payment.setPaymentNumber("P-2026-001");
    payment.setInvoiceId(invoiceId);
    payment.setClientId(clientId);
    payment.setAmountXof(amount);
    payment.setMethod(PaymentMethod.CASH);
    payment.setPaymentDate(LocalDate.now());
    when(paymentRepository.findByFarmIdAndId(7L, id)).thenReturn(Optional.of(payment));
    return payment;
  }

  private static Invoice invoice(Long id, Client client, long total, long paid) {
    Invoice invoice = new Invoice();
    invoice.setId(id);
    invoice.setFarmId(7L);
    invoice.setClient(client);
    invoice.setInvoiceNumber("F-2026-001");
    invoice.setStatus(paid >= total ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID);
    invoice.setIssueDate(LocalDate.now());
    invoice.setTotalXof(total);
    invoice.setAmountPaidXof(paid);
    return invoice;
  }

  private static Client client(Long id) {
    Client c = new Client();
    c.setId(id);
    c.setFarmId(7L);
    c.setClientType(ClientType.BUSINESS);
    c.setDisplayName("Ferme du Soleil");
    c.setCurrentBalanceXof(0L);
    return c;
  }
}
