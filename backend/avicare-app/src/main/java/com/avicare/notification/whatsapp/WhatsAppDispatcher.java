package com.avicare.notification.whatsapp;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Drains the WhatsApp outbox on a schedule (Sprint C1 Phase 2). Loads a batch of PENDING rows and
 * hands each to {@link OutboxProcessor} (its own transaction), so a single failure is isolated and
 * retried on the next tick.
 *
 * <p>No-op unless {@link WhatsAppReadiness} says a message has somewhere to go — a blank Konekt
 * secret would otherwise spend all five attempts of every queued row on a gateway that refuses
 * them, turning a missing setting into permanently failed alerts.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class WhatsAppDispatcher {

  private final WhatsappOutboxRepository outbox;
  private final OutboxProcessor processor;
  private final WhatsAppReadiness readiness;

  @Scheduled(cron = "${notifications.whatsapp.dispatch-cron:0 */2 * * * *}")
  public void dispatch() {
    if (!readiness.canSend()) {
      return;
    }
    for (WhatsappOutbox row : outbox.findTop50ByStatusOrderByCreatedAtAsc(OutboxStatus.PENDING)) {
      try {
        processor.process(row.getId());
      } catch (RuntimeException e) {
        log.warn("WhatsApp dispatch failed for outbox {}: {}", row.getId(), e.getMessage());
      }
    }
  }
}
