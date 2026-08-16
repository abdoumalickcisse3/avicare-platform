package com.avicare.notification.service;

import com.avicare.notification.detect.AlertDetector;
import com.avicare.notification.detect.DetectedCondition;
import com.avicare.notification.domain.Notification;
import com.avicare.notification.domain.NotificationCategory;
import com.avicare.notification.domain.NotificationStatus;
import com.avicare.notification.repository.NotificationRepository;
import com.avicare.notification.whatsapp.OutboxEnqueuer;
import com.avicare.tenancy.api.TenancyFacade;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Materializes alert conditions into notifications (Sprint C1). Runs daily across all farms; for
 * each farm it asks every {@link AlertDetector} for the conditions currently true, creates one
 * ACTIVE notification per new {@code dedupKey} (idempotent), and resolves the ACTIVE notifications
 * whose condition has disappeared (re-arming the dedup key). A detector failure is logged and
 * isolated so it never blocks the others.
 *
 * <p>{@link #upsert(Long, DetectedCondition)} is public so a future domain-event listener can
 * create a notification in real time without going through the daily scan.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationScannerService {

  private final List<AlertDetector> detectors;
  private final NotificationRepository notificationRepository;
  private final TenancyFacade tenancyFacade;
  private final OutboxEnqueuer outboxEnqueuer;

  /** Daily scan across all farms (default 06:00 Africa/Dakar). */
  @Scheduled(
      cron = "${notifications.scan.cron:0 0 6 * * *}",
      zone = "${notifications.scan.zone:Africa/Dakar}")
  public void scanAll() {
    for (Long farmId : tenancyFacade.listAllFarmIds()) {
      try {
        scanFarm(farmId);
      } catch (RuntimeException e) {
        log.warn("Notification scan failed for farm {}: {}", farmId, e.getMessage(), e);
      }
    }
  }

  /** Reconcile notifications for one farm: create new conditions, resolve disappeared ones. */
  @Transactional
  public void scanFarm(Long farmId) {
    for (AlertDetector detector : detectors) {
      try {
        List<DetectedCondition> conditions = detector.detect(farmId);
        Set<String> currentKeys =
            conditions.stream().map(DetectedCondition::dedupKey).collect(Collectors.toSet());

        for (DetectedCondition condition : conditions) {
          upsert(farmId, condition);
        }

        for (NotificationCategory category : detector.categories()) {
          resolveDisappeared(farmId, category, currentKeys);
        }
      } catch (RuntimeException e) {
        log.warn(
            "Detector {} failed for farm {}: {}",
            detector.getClass().getSimpleName(),
            farmId,
            e.getMessage(),
            e);
      }
    }
  }

  /**
   * Create an ACTIVE notification for the condition if none exists yet for its dedup key
   * (idempotent). Returns the existing or newly created notification.
   */
  @Transactional
  public Notification upsert(Long farmId, DetectedCondition c) {
    return notificationRepository
        .findByFarmIdAndDedupKeyAndStatus(farmId, c.dedupKey(), NotificationStatus.ACTIVE)
        .orElseGet(() -> create(farmId, c));
  }

  private Notification create(Long farmId, DetectedCondition c) {
    Notification n = new Notification();
    n.setFarmId(farmId);
    n.setCategory(c.category());
    n.setSeverity(c.severity());
    n.setTitle(c.title());
    n.setBody(c.body());
    n.setSourceRef(c.sourceRef());
    n.setDedupKey(c.dedupKey());
    n.setStatus(NotificationStatus.ACTIVE);
    Notification saved = notificationRepository.save(n);
    outboxEnqueuer.enqueueFor(saved);
    return saved;
  }

  private void resolveDisappeared(
      Long farmId, NotificationCategory category, Set<String> currentKeys) {
    List<Notification> active =
        notificationRepository.findByFarmIdAndCategoryAndStatus(
            farmId, category, NotificationStatus.ACTIVE);
    for (Notification n : active) {
      if (!currentKeys.contains(n.getDedupKey())) {
        n.setStatus(NotificationStatus.RESOLVED);
        n.setResolvedAt(LocalDateTime.now());
        notificationRepository.save(n);
      }
    }
  }
}
