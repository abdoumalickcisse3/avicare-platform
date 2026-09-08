package com.avicare.livestock.commercial;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.common.api.exception.NotFoundException;
import com.avicare.livestock.domain.Client;
import com.avicare.notification.api.WhatsAppOutboxFacade;
import com.avicare.tenancy.api.TenancyFacade;
import com.avicare.tenancy.api.dto.FarmInfo;
import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

/**
 * Writing to a farmer's own clients engages the farmer's name with them, so consent is explicit and
 * the message must always say who is speaking.
 */
class ClientNotifierTest {

  private WhatsAppOutboxFacade whatsApp;
  private TenancyFacade tenancy;
  private ClientNotifier notifier;

  @BeforeEach
  void setUp() {
    whatsApp = Mockito.mock(WhatsAppOutboxFacade.class);
    tenancy = Mockito.mock(TenancyFacade.class);
    notifier = new ClientNotifier(whatsApp, tenancy);
    when(tenancy.findById(7L)).thenReturn(new FarmInfo(7L, "Ferme Complète", "XOF", "UTC", true));
  }

  private static Client client(boolean optedIn, String phone) {
    Client c = new Client();
    c.setDisplayName("Awa Diop");
    c.setPhone(phone);
    c.setNotifyWhatsapp(optedIn);
    return c;
  }

  /**
   * The captured message, with every kind of space collapsed to a plain one.
   *
   * <p>French {@code NumberFormat} groups thousands with a narrow no-break space (U+202F), not an
   * ordinary one — asserting on "42 500" typed from a keyboard fails against a string that reads
   * identically. The formatting is deliberate; the test just has to stop being fooled by it.
   */
  private String captureMessage() {
    ArgumentCaptor<String> msg = ArgumentCaptor.forClass(String.class);
    verify(whatsApp).enqueue(anyString(), msg.capture());
    return msg.getValue().replaceAll("[\\p{Zs}\\u202F]", " ");
  }

  @Test
  void invoice_namesTheFarmFirst_theNumberAndTheAmount() {
    notifier.invoiceIssued(
        7L, client(true, "770000000"), "F-2026-007", 42_500, LocalDate.of(2026, 10, 5));

    String m = captureMessage();
    // Without the farm, an unknown number is asking a stranger for money — the shape of a scam.
    assertThat(m).startsWith("Ferme Complète");
    assertThat(m).contains("F-2026-007").contains("42 500").contains("05/10/2026");
  }

  /** No due date means no invented deadline: the farm did not set one. */
  @Test
  void invoice_withoutDueDate_promisesNothing() {
    notifier.invoiceIssued(7L, client(true, "770000000"), "F-2026-007", 42_500, null);

    assertThat(captureMessage()).doesNotContain("avant le");
  }

  @Test
  void payment_acknowledges_andStatesWhatIsLeft() {
    notifier.paymentReceived(
        7L, client(true, "770000000"), 12_500, 30_000, LocalDate.of(2026, 9, 7));

    String m = captureMessage();
    assertThat(m).contains("12 500").contains("30 000");
    // The farm's position, never an enforceable truth — an invoice can be disputed.
    assertThat(m).contains("selon nos comptes");
  }

  @Test
  void payment_settled_saysSo() {
    notifier.paymentReceived(7L, client(true, "770000000"), 42_500, 0, LocalDate.of(2026, 9, 7));

    assertThat(captureMessage()).contains("soldé");
  }

  @Test
  void withoutConsent_nothingIsSent() {
    notifier.invoiceIssued(7L, client(false, "770000000"), "F-2026-007", 42_500, null);
    notifier.paymentReceived(7L, client(false, "770000000"), 1_000, 0, LocalDate.now());

    verify(whatsApp, never()).enqueue(anyString(), anyString());
  }

  /** A switch with no number sends nowhere. */
  @Test
  void withoutPhone_nothingIsSent() {
    notifier.invoiceIssued(7L, client(true, null), "F-2026-007", 42_500, null);
    notifier.invoiceIssued(7L, client(true, "  "), "F-2026-007", 42_500, null);

    verify(whatsApp, never()).enqueue(anyString(), anyString());
  }

  /**
   * A message that cannot say where it comes from is worse than no message — and it must never
   * break the business write it reports.
   */
  @Test
  void unknownFarm_sendsNothing_andDoesNotThrow() {
    when(tenancy.findById(any())).thenThrow(NotFoundException.of("Farm", 7L));

    notifier.invoiceIssued(7L, client(true, "770000000"), "F-2026-007", 42_500, null);

    verify(whatsApp, never()).enqueue(anyString(), anyString());
  }
}
