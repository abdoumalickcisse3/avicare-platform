package com.avicare.notification.whatsapp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.avicare.notification.whatsapp.WhatsAppSender.SendResult;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class OutboxProcessorTest {

  @Mock WhatsappOutboxRepository outbox;
  @Mock WhatsAppSender sender;

  private OutboxProcessor processor() {
    OutboxProcessor p = new OutboxProcessor(outbox, sender);
    ReflectionTestUtils.setField(p, "maxAttempts", 3);
    return p;
  }

  private WhatsappOutbox pending(int attempts) {
    WhatsappOutbox row = new WhatsappOutbox();
    row.setId(1L);
    row.setPhone("221770000000");
    row.setMessage("Alerte");
    row.setStatus(OutboxStatus.PENDING);
    row.setAttempts(attempts);
    return row;
  }

  @Test
  void marksSent_onSuccess() {
    WhatsappOutbox row = pending(0);
    when(outbox.findById(1L)).thenReturn(Optional.of(row));
    when(sender.send("221770000000", "Alerte"))
        .thenReturn(SendResult.ok("{\"message\":\"queued\"}"));

    processor().process(1L);

    assertThat(row.getStatus()).isEqualTo(OutboxStatus.SENT);
    assertThat(row.getSentAt()).isNotNull();
    assertThat(row.getAttempts()).isEqualTo(1);
  }

  @Test
  void staysPending_onFailureBelowMaxAttempts() {
    WhatsappOutbox row = pending(0);
    when(outbox.findById(1L)).thenReturn(Optional.of(row));
    when(sender.send("221770000000", "Alerte")).thenReturn(SendResult.failed("HTTP 500", null));

    processor().process(1L);

    assertThat(row.getStatus()).isEqualTo(OutboxStatus.PENDING);
    assertThat(row.getAttempts()).isEqualTo(1);
    assertThat(row.getLastError()).isEqualTo("HTTP 500");
  }

  @Test
  void marksFailed_whenMaxAttemptsReached() {
    WhatsappOutbox row = pending(2); // this attempt makes it 3 == max
    when(outbox.findById(1L)).thenReturn(Optional.of(row));
    when(sender.send("221770000000", "Alerte")).thenReturn(SendResult.failed("HTTP 500", null));

    processor().process(1L);

    assertThat(row.getAttempts()).isEqualTo(3);
    assertThat(row.getStatus()).isEqualTo(OutboxStatus.FAILED);
  }

  @Test
  void ignores_nonPendingRow() {
    WhatsappOutbox row = pending(0);
    row.setStatus(OutboxStatus.SENT);
    when(outbox.findById(1L)).thenReturn(Optional.of(row));

    processor().process(1L);

    org.mockito.Mockito.verifyNoInteractions(sender);
  }
}
