package com.avicare.notification.whatsapp;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Drains the WhatsApp outbox on a schedule (Sprint C1 Phase 2). Loads a batch of PENDING rows and
 * hands each to {@link OutboxProcessor} (its own transaction), so a single failure is isolated and
 * retried on the next tick. No-op when WhatsApp is disabled.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class WhatsAppDispatcher {

  private final WhatsappOutboxRepository outbox;
  private final OutboxProcessor processor;

  @Value("${notifications.whatsapp.enabled:false}")
  private boolean whatsappEnabled;

  @Scheduled(cron = "${notifications.whatsapp.dispatch-cron:0 */2 * * * *}")
  public void dispatch() {
    if (!whatsappEnabled) {
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
