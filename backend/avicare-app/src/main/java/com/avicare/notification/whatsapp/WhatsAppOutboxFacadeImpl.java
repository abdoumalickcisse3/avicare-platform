package com.avicare.notification.whatsapp;

import com.avicare.notification.api.WhatsAppOutboxFacade;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Queues a WhatsApp message that originates outside the farmer notification flow (partner network
 * alerts). The row carries no {@code notificationId} — nullable since V38 — and is drained by the
 * same {@link WhatsAppDispatcher} as the farmer messages.
 *
 * <p>Dependencies are deliberately kept to the two beans strictly needed: this facade is reachable
 * from other contexts, and widening its graph would break the {@code @DataJpaTest} slices that
 * import it.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class WhatsAppOutboxFacadeImpl implements WhatsAppOutboxFacade {

  private final PhoneNormalizer phoneNormalizer;
  private final WhatsappOutboxRepository outbox;

  @Value("${notifications.whatsapp.enabled:false}")
  private boolean whatsappEnabled;

  @Override
  public void enqueue(String rawPhone, String message) {
    queue(rawPhone, message, OutboxSource.ALERT, null);
  }

  @Override
  public void enqueueBroadcast(String rawPhone, String message, Long farmId) {
    queue(rawPhone, message, OutboxSource.BROADCAST, farmId);
  }

  private void queue(String rawPhone, String message, OutboxSource source, Long farmId) {
    if (!whatsappEnabled || message == null || message.isBlank()) {
      return;
    }
    String phone = phoneNormalizer.toKonekt(rawPhone);
    if (phone == null) {
      log.debug("Skipping WhatsApp enqueue: no usable digits in the recipient phone");
      return;
    }
    WhatsappOutbox row = new WhatsappOutbox();
    row.setPhone(phone);
    row.setMessage(message);
    row.setSource(source);
    row.setFarmId(farmId);
    outbox.save(row);
  }
}
