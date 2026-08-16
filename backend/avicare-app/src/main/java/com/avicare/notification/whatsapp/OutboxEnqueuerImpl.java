package com.avicare.notification.whatsapp;

import com.avicare.notification.domain.Notification;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Default {@link OutboxEnqueuer}. Phase 1: no-op (in-app notifications only). Phase 2 fills in the
 * preference-driven fan-out to {@code whatsapp_outbox} against Konekt — in this same class, so the
 * scanner keeps its single collaborator.
 */
@Component
@Slf4j
public class OutboxEnqueuerImpl implements OutboxEnqueuer {

  @Override
  public void enqueueFor(Notification notification) {
    // Phase 2: resolve recipients' WhatsApp preferences and insert whatsapp_outbox rows.
    log.debug(
        "WhatsApp enqueue skipped (Phase 1, in-app only) for notification {}",
        notification.getId());
  }
}
