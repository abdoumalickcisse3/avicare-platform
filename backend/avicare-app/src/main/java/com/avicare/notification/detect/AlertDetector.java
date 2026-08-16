package com.avicare.notification.detect;

import com.avicare.notification.domain.NotificationCategory;
import java.util.List;
import java.util.Set;

/**
 * Detects, for one domain, the alert conditions currently true on a farm (Sprint C1). Detectors are
 * thin wrappers over the existing compute-on-read services (reached through facades) — they hold no
 * business logic of their own, only the mapping to {@link DetectedCondition}.
 *
 * <p>{@link #categories()} declares the categories this detector <em>owns</em>: the scanner resolves
 * ACTIVE notifications in those categories whose dedup key is no longer reported by {@link
 * #detect(Long)}.
 */
public interface AlertDetector {

  /** Categories owned by this detector (used by the scanner to reconcile stale notifications). */
  Set<NotificationCategory> categories();

  /** All alert conditions currently true on the farm. */
  List<DetectedCondition> detect(Long farmId);
}
