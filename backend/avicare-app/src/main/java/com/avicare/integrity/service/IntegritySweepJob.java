package com.avicare.integrity.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * The nightly sweep, after the notification and partner scans so it reads a settled day.
 *
 * <p>Notifying is a second step on purpose: the sweep writes findings inside its transaction, and
 * the on-call should be told about what is committed, not about what a rollback might yet erase.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class IntegritySweepJob {

  private final IntegrityCheckService checkService;
  private final IntegrityAlerter alerter;

  @Value("${avicare.integrity.enabled:true}")
  private boolean enabled;

  @Scheduled(
      cron = "${avicare.integrity.cron:0 0 3 * * *}",
      zone = "${avicare.integrity.zone:Africa/Dakar}")
  public void sweep() {
    if (!enabled) {
      return;
    }
    IntegrityCheckService.SweepReport report = checkService.runAllChecks();
    int criticalOpened = checkService.notifyNewCriticals();
    alerter.sweepCompleted(report.checksRun(), report.opened(), report.resolved(), criticalOpened);
  }
}
