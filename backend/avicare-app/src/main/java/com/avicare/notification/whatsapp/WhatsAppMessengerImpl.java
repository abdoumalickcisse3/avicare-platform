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
    return result.ok();
  }
}
