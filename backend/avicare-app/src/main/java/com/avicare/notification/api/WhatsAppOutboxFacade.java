package com.avicare.notification.api;

/**
 * Public port letting another bounded context queue a best-effort WhatsApp message, without
 * importing the notification internals. Introduced for the partner « Garder » layer: a network
 * alert is addressed to a partner, so it has no farmer {@code notification} behind it, yet it
 * should reuse the existing outbox (retry, Konekt client, dispatcher) rather than duplicate it.
 *
 * <p>The message is queued, not sent: the scheduled dispatcher drains the outbox.
 */
public interface WhatsAppOutboxFacade {

  /**
   * Queue one WhatsApp message to {@code rawPhone} (any stored format — it is normalized here).
   * No-op when WhatsApp is disabled or the number holds no usable digits; never throws, so a
   * failure to notify can never roll back the caller's business transaction.
   */
  void enqueue(String rawPhone, String message);
}
