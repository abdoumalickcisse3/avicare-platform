package com.avicare.notification.whatsapp;

import com.avicare.notification.whatsapp.WhatsAppSender.SendResult;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Sends one outbox row in its own transaction (Sprint C1 Phase 2), so a failure on one message
 * never affects the others in the dispatch batch. Success → {@code SENT}; failure → {@code
 * attempts++} and {@code FAILED} once {@code max-attempts} is reached, otherwise it stays {@code
 * PENDING} for the next tick.
 */
@Component
@RequiredArgsConstructor
public class OutboxProcessor {

  private final WhatsappOutboxRepository outbox;
  private final WhatsAppSender sender;

  @Value("${notifications.whatsapp.max-attempts:5}")
  private int maxAttempts;

  @Transactional
  public void process(Long outboxId) {
    WhatsappOutbox row = outbox.findById(outboxId).orElse(null);
    if (row == null || row.getStatus() != OutboxStatus.PENDING) {
      return;
    }
    row.setAttempts(row.getAttempts() + 1);
    SendResult result = sender.send(row.getPhone(), row.getMessage());
    Map<String, Object> providerResponse = new HashMap<>();
    if (result.ok()) {
      row.setStatus(OutboxStatus.SENT);
      row.setSentAt(LocalDateTime.now());
      row.setLastError(null);
      providerResponse.put("response", result.rawResponse());
    } else {
      row.setLastError(result.error());
      providerResponse.put("error", result.error());
      providerResponse.put("response", result.rawResponse());
      if (row.getAttempts() >= maxAttempts) {
        row.setStatus(OutboxStatus.FAILED);
      }
    }
    row.setProviderResponse(providerResponse);
    outbox.save(row);
  }
}
