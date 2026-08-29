package com.avicare.notification.whatsapp;

import com.avicare.notification.api.WhatsAppMessenger;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Synchronous WhatsApp send, for interactive flows. Delegates to the Konekt client. */
@Component
@RequiredArgsConstructor
@Slf4j
public class WhatsAppMessengerImpl implements WhatsAppMessenger {

  private final PhoneNormalizer phoneNormalizer;
  private final WhatsAppSender sender;
  private final WhatsappOutboxRepository outbox;

  @Value("${notifications.whatsapp.enabled:false}")
  private boolean whatsappEnabled;

  @Override
  public boolean sendNow(String rawPhone, String message) {
    if (!whatsappEnabled) {
      log.warn("WhatsApp is disabled: message not sent");
      return false;
    }
    String phone = phoneNormalizer.toKonekt(rawPhone);
    if (phone == null || message == null || message.isBlank()) {
      return false;
    }
    WhatsAppSender.SendResult result = sender.send(phone, message);
    if (!result.ok()) {
      // The number itself is not logged: it identifies a person.
      log.warn("WhatsApp send failed: {}", result.error());
    }
    record(phone, message, result);
    return result.ok();
  }

  /**
   * Log the send in the outbox as an already-terminal row.
   *
   * <p>This path does not queue — someone is waiting on the message — but it still spends a credit,
   * and a credit spent with no trace is one the console can never account for.
   *
   * <p>Bookkeeping must never break the send it records: a failure here is logged and swallowed,
   * because the message has already gone out either way.
   */
  private void record(String phone, String message, WhatsAppSender.SendResult result) {
    try {
      WhatsappOutbox entry = new WhatsappOutbox();
      entry.setPhone(phone);
      entry.setMessage(message);
      entry.setSource(OutboxSource.INTERACTIVE);
      entry.setAttempts(1);
      entry.setStatus(result.ok() ? OutboxStatus.SENT : OutboxStatus.FAILED);
      if (result.ok()) {
        entry.setSentAt(java.time.LocalDateTime.now());
      } else {
        entry.setLastError(result.error());
      }
      outbox.save(entry);
    } catch (RuntimeException e) {
      log.error("Failed to record an interactive WhatsApp send in the outbox", e);
    }
  }
}
