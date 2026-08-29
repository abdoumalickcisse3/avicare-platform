package com.avicare.notification.whatsapp;

import com.avicare.notification.api.WhatsAppLedger;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** {@link WhatsAppLedger} over the outbox table — one dependency, on purpose. */
@Service
@RequiredArgsConstructor
public class WhatsAppLedgerImpl implements WhatsAppLedger {

  private final WhatsappOutboxRepository outbox;

  @Override
  @Transactional(readOnly = true)
  public Usage usage(int days) {
    LocalDateTime since = LocalDateTime.now().minusDays(days);
    Map<String, Long> bySource = new LinkedHashMap<>();
    outbox.countBySourceSince(since).forEach(row -> bySource.put(row.getSource(), row.getTotal()));

    Map<Long, Long> byFarm = new LinkedHashMap<>();
    outbox.countByFarmSince(since).forEach(row -> byFarm.put(row.getFarmId(), row.getTotal()));

    return new Usage(
        days,
        outbox.countByStatusSince(OutboxStatus.SENT, since),
        outbox.countByStatusSince(OutboxStatus.FAILED, since),
        outbox.countByStatus(OutboxStatus.PENDING),
        bySource,
        byFarm);
  }

  @Override
  @Transactional(readOnly = true)
  public List<FailedMessage> recentFailures(int limit) {
    return outbox.findTop20ByStatusOrderByCreatedAtDesc(OutboxStatus.FAILED).stream()
        .limit(limit)
        .map(
            o ->
                new FailedMessage(
                    o.getId(),
                    mask(o.getPhone()),
                    o.getSource() == null ? null : o.getSource().name(),
                    o.getAttempts(),
                    o.getLastError(),
                    o.getCreatedAt()))
        .toList();
  }

  @Override
  @Transactional
  public boolean retry(Long outboxId) {
    return outbox
        .findById(outboxId)
        .filter(o -> o.getStatus() == OutboxStatus.FAILED)
        .map(
            o -> {
              // Back to PENDING for the cron to pick up. Attempts are kept: a message that has
              // already failed five times should still look like one.
              o.setStatus(OutboxStatus.PENDING);
              o.setLastError(null);
              outbox.save(o);
              return true;
            })
        .orElse(false);
  }

  /** Last four digits only — enough to recognise a number, not enough to be a directory. */
  private static String mask(String phone) {
    if (phone == null || phone.length() <= 4) {
      return "••••";
    }
    return "••••" + phone.substring(phone.length() - 4);
  }
}
