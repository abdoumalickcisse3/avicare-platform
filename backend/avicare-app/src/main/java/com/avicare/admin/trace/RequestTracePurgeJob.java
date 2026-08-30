package com.avicare.admin.trace;

import com.avicare.admin.repository.RequestTraceRepository;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Enforces the retention window on {@code request_traces}.
 *
 * <p>Traces are a debugging aid with a short shelf life: nobody investigates last quarter's 500,
 * and the table would otherwise grow without bound. Runs nightly, after the refresh-token purge.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class RequestTracePurgeJob {

  private final RequestTraceRepository repository;
  private final TracingProperties properties;

  @Scheduled(cron = "${avicare.tracing.purge-cron:0 45 3 * * *}")
  @Transactional
  public void purge() {
    LocalDateTime cutoff = LocalDateTime.now().minusDays(properties.retentionDays());
    int removed = repository.deleteOlderThan(cutoff);
    if (removed > 0) {
      log.info("Purged {} request trace(s) older than {}", removed, cutoff);
    }
  }
}
