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
 * Materializes alert conditions into notifications (Sprint C1). For each farm it asks every {@link
 * AlertDetector} for the conditions currently true, creates one ACTIVE notification per new {@code
 * dedupKey} (idempotent), and resolves the ACTIVE notifications whose condition has disappeared
 * (re-arming the dedup key). A detector failure is logged and isolated so it never blocks the
 * others.
 *
 * <h2>Cadence</h2>
 *
 * <p>The scan used to run once a day, at 06:00. A stock that ran out at 07:00 waited until the next
 * morning to say so — on the one problem farmers rank first. It now runs hourly during working
 * hours, which is the interval at which someone can still act on what they are told.
 *
 * <h2>Why hourly needs a quiet period</h2>
 *
 * <p>Scanning more often makes an old flaw visible: a condition sitting <em>on</em> its threshold —
 * a stock item hovering at its alert level, a lot whose deaths cross and re-cross the baseline —
 * resolves on one pass and fires again on the next. At one scan a day that was invisible. At one an
 * hour it would be a phone buzzing all morning about the same bag of feed, which is how people
 * learn to ignore alerts.
 *
 * <p>So a condition that comes back within {@value #QUIET_PERIOD_HOURS} hours of being resolved is
 * treated as the same episode: the notification is recreated (the app must show what is true now)
 * but <b>no second message is sent</b>. Past that window it is news again, and it rings.
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

  /**
   * How long after being resolved a returning condition is still the same episode.
   *
   * <p>Six hours: long enough to cover a morning of a stock level bouncing on its threshold, short
   * enough that a problem still there at the end of the day says so again.
   */
  private static final int QUIET_PERIOD_HOURS = 6;

  /**
   * Hourly during working hours (default 06:00–20:00, Africa/Dakar).
   *
   * <p>Bounded rather than round-the-clock on purpose: nothing here is worth waking a farmer at
   * 03:00, and a condition found at night is still found at six.
   */
  @Scheduled(
      cron = "${notifications.scan.cron:0 0 6-20 * * *}",
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
        .orElseGet(() -> create(farmId, c, !recentlyResolved(farmId, c.dedupKey())));
  }

  /**
   * Was this exact condition resolved within the quiet period?
   *
   * <p>Read on {@code resolvedAt} of the last RESOLVED notification for the key, so no extra column
   * is needed: the table already remembers when a condition went away.
   */
  private boolean recentlyResolved(Long farmId, String dedupKey) {
    return notificationRepository
        .findFirstByFarmIdAndDedupKeyAndStatusOrderByResolvedAtDesc(
            farmId, dedupKey, NotificationStatus.RESOLVED)
        .map(Notification::getResolvedAt)
        .filter(at -> at.isAfter(LocalDateTime.now().minusHours(QUIET_PERIOD_HOURS)))
        .isPresent();
  }

  /**
   * @param notify whether this materialization also rings a phone. The notification is always
   *     created — the app must show what is true now — but a condition returning inside the quiet
   *     period is the same episode, and the farmer has already been told.
   */
  private Notification create(Long farmId, DetectedCondition c, boolean notify) {
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
    if (notify) {
      outboxEnqueuer.enqueueFor(saved);
    } else {
      log.debug(
          "Quiet period: {} re-appeared within {}h, not re-notifying",
          c.dedupKey(),
          QUIET_PERIOD_HOURS);
    }
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
