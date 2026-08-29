package com.avicare.notification.whatsapp;

/**
 * Which path produced a WhatsApp message.
 *
 * <p>Every send costs a credit, whichever path it took, so the ledger has to name them apart —
 * otherwise "why did we spend 400 credits last week" has no answer.
 */
public enum OutboxSource {
  /** Queued by the daily alert scan and drained by the outbox cron. */
  ALERT,
  /** Sent immediately because someone was waiting on it — a password reset code. */
  INTERACTIVE,
  /** A deliberate campaign to many recipients. */
  BROADCAST
}
