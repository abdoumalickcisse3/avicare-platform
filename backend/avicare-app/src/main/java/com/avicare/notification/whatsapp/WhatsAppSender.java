package com.avicare.notification.whatsapp;

/**
 * Sends a single WhatsApp message (Sprint C1 Phase 2). Best-effort: implementations never throw —
 * they report success/failure via {@link SendResult} so the dispatcher can retry.
 */
public interface WhatsAppSender {

  SendResult send(String phone, String message);

  /**
   * Outcome of a send attempt.
   *
   * @param ok true if the provider accepted the message
   * @param rawResponse the provider's raw reply (for the outbox audit), may be null
   * @param error a short error description when {@code ok} is false, else null
   */
  record SendResult(boolean ok, String rawResponse, String error) {
    public static SendResult ok(String rawResponse) {
      return new SendResult(true, rawResponse, null);
    }

    public static SendResult failed(String error, String rawResponse) {
      return new SendResult(false, rawResponse, error);
    }
  }
}
