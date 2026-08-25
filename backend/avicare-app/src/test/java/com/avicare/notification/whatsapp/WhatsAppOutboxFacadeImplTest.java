package com.avicare.notification.whatsapp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class WhatsAppOutboxFacadeImplTest {

  @Mock WhatsappOutboxRepository outbox;

  private WhatsAppOutboxFacadeImpl facade(boolean enabled) {
    WhatsAppOutboxFacadeImpl f = new WhatsAppOutboxFacadeImpl(new PhoneNormalizer("221"), outbox);
    ReflectionTestUtils.setField(f, "whatsappEnabled", enabled);
    return f;
  }

  @Test
  void queuesANormalizedPendingRowWithNoNotificationBehindIt() {
    facade(true).enqueue("+221 77 000 00 01", "Ferme silencieuse");

    ArgumentCaptor<WhatsappOutbox> saved = ArgumentCaptor.forClass(WhatsappOutbox.class);
    verify(outbox).save(saved.capture());
    assertThat(saved.getValue().getPhone()).isEqualTo("221770000001");
    assertThat(saved.getValue().getMessage()).isEqualTo("Ferme silencieuse");
    assertThat(saved.getValue().getStatus()).isEqualTo(OutboxStatus.PENDING);
    // The whole point of the facade: a sender with no farmer notification behind it.
    assertThat(saved.getValue().getNotificationId()).isNull();
  }

  @Test
  void queuesNothingWhenWhatsappIsDisabled() {
    facade(false).enqueue("221770000001", "Ferme silencieuse");

    verify(outbox, never()).save(any());
  }

  @Test
  void queuesNothingWhenThePhoneHasNoUsableDigits() {
    facade(true).enqueue("n/a", "Ferme silencieuse");
    facade(true).enqueue(null, "Ferme silencieuse");

    verify(outbox, never()).save(any());
  }

  @Test
  void queuesNothingForAnEmptyMessage() {
    facade(true).enqueue("221770000001", "   ");
    facade(true).enqueue("221770000001", null);

    verify(outbox, never()).save(any());
  }
}
