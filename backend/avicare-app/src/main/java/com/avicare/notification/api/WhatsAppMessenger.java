package com.avicare.notification.api;

/**
 * Send one WhatsApp message <b>now</b>, for the flows where a human is waiting on it.
 *
 * <p>Distinct from {@link WhatsAppOutboxFacade}, which queues: the outbox is drained by a cron
 * every couple of minutes, which is right for an alert and wrong for a password-reset code the
 * farmer is staring at their phone for.
 *
 * <p>Never throws — the caller gets a boolean and decides what to tell the user.
 */
public interface WhatsAppMessenger {

  /**
   * @param rawPhone any stored format; it is normalized here
   * @return true when the provider accepted the message
   */
  boolean sendNow(String rawPhone, String message);
}
