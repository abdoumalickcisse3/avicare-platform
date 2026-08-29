package com.avicare.notification.api;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Read access to what the platform has actually sent over WhatsApp.
 *
 * <p>A deliberately separate contract from {@link WhatsAppOutboxFacade}, which only enqueues: this
 * one is read-and-retry for the console, and keeping the write path's dependency graph tight
 * matters — a facade that grows dependencies breaks every {@code @DataJpaTest} slice importing it.
 */
public interface WhatsAppLedger {

  /** Totals over the last {@code days}, by status and by source. */
  Usage usage(int days);

  /** Most recent failures, so a failed send can be seen and retried rather than guessed at. */
  List<FailedMessage> recentFailures(int limit);

  /**
   * Put a failed message back in the queue.
   *
   * @return false when the message does not exist or is not in a failed state
   */
  boolean retry(Long outboxId);

  /** Aggregated usage. {@code bySource} and {@code byFarm} are counts of messages actually sent. */
  record Usage(
      int days,
      long sent,
      long failed,
      long pending,
      Map<String, Long> bySource,
      Map<Long, Long> byFarm) {}

  /** One failed send, with the phone reduced to its last digits — it identifies a person. */
  record FailedMessage(
      Long id,
      String maskedPhone,
      String source,
      int attempts,
      String lastError,
      LocalDateTime createdAt) {}
}
