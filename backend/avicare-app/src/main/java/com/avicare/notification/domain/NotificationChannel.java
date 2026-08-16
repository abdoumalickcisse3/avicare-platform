package com.avicare.notification.domain;

/**
 * Delivery channel for a notification category (Sprint C1). {@code IN_APP} feeds the bell; {@code
 * WHATSAPP} enqueues an outbound message via Konekt (Phase 2).
 */
public enum NotificationChannel {
  IN_APP,
  WHATSAPP
}
