package com.avicare.notification.whatsapp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.notification.api.WhatsAppLedger;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class WhatsAppLedgerImplTest {

  @Mock WhatsappOutboxRepository outbox;
  @InjectMocks WhatsAppLedgerImpl ledger;

  /** Pure builder — stubbing inside another {@code when(...)} argument breaks Mockito. */
  private WhatsappOutbox message(Long id, OutboxStatus status, String phone) {
    WhatsappOutbox o = new WhatsappOutbox();
    o.setId(id);
    o.setStatus(status);
    o.setPhone(phone);
    o.setSource(OutboxSource.ALERT);
    o.setAttempts(3);
    o.setLastError("HTTP 402");
    return o;
  }

  private WhatsappOutbox stored(Long id, OutboxStatus status, String phone) {
    WhatsappOutbox o = message(id, status, phone);
    when(outbox.findById(id)).thenReturn(Optional.of(o));
    return o;
  }

  @Test
  void showsOnlyTheLastDigitsOfANumber() {
    when(outbox.findTop20ByStatusOrderByCreatedAtDesc(OutboxStatus.FAILED))
        .thenReturn(List.of(message(1L, OutboxStatus.FAILED, "221704756996")));

    List<WhatsAppLedger.FailedMessage> failures = ledger.recentFailures(20);

    // Enough to recognise a number, not enough to make the screen a directory.
    assertThat(failures)
        .singleElement()
        .satisfies(
            f -> {
              assertThat(f.maskedPhone()).isEqualTo("••••6996");
              assertThat(f.maskedPhone()).doesNotContain("221704");
            });
  }

  @Test
  void requeuesAFailedMessageAndClearsItsError() {
    WhatsappOutbox failed = stored(1L, OutboxStatus.FAILED, "221704756996");

    assertThat(ledger.retry(1L)).isTrue();

    assertThat(failed.getStatus()).isEqualTo(OutboxStatus.PENDING);
    assertThat(failed.getLastError()).isNull();
    // Attempts are kept: a message that failed three times must still look like one.
    assertThat(failed.getAttempts()).isEqualTo(3);
  }

  @Test
  void refusesToRequeueAMessageThatDidNotFail() {
    stored(2L, OutboxStatus.SENT, "221704756996");

    // Re-sending a delivered message would spend a credit and confuse the recipient.
    assertThat(ledger.retry(2L)).isFalse();
    verify(outbox, never()).save(any());
  }

  @Test
  void reportsFalseForAnUnknownMessage() {
    when(outbox.findById(99L)).thenReturn(Optional.empty());

    assertThat(ledger.retry(99L)).isFalse();
  }

  @Test
  void countsPendingWithoutAWindow() {
    when(outbox.countByStatus(OutboxStatus.PENDING)).thenReturn(4L);
    when(outbox.countByStatusSince(any(), any())).thenReturn(10L);
    when(outbox.countBySourceSince(any())).thenReturn(List.of());
    when(outbox.countByFarmSince(any())).thenReturn(List.of());

    WhatsAppLedger.Usage usage = ledger.usage(30);

    // A message stuck pending for weeks is still pending; windowing it would hide the backlog.
    assertThat(usage.pending()).isEqualTo(4);
    assertThat(usage.sent()).isEqualTo(10);
    assertThat(usage.days()).isEqualTo(30);
  }

  @Test
  void handlesAShortNumberWithoutLeakingIt() {
    when(outbox.findTop20ByStatusOrderByCreatedAtDesc(OutboxStatus.FAILED))
        .thenReturn(List.of(message(1L, OutboxStatus.FAILED, "77")));

    assertThat(ledger.recentFailures(20).get(0).maskedPhone()).isEqualTo("••••");
  }
}
