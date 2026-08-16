package com.avicare.notification.whatsapp;

import com.avicare.notification.domain.Notification;

/**
 * Port called right after a notification is materialized, to fan it out to the WhatsApp outbox
 * according to each recipient's preferences (Sprint C1). Phase 1 ships a no-op implementation; the
 * real Konekt enqueue logic lands in Phase 2 (same bean, so no double-registration).
 */
public interface OutboxEnqueuer {

  /**
   * Enqueue WhatsApp messages for the members who opted in for this notification (no-op if off).
   */
  void enqueueFor(Notification notification);
}
