package com.avicare.notification.repository;

import com.avicare.notification.domain.Notification;
import com.avicare.notification.domain.NotificationCategory;
import com.avicare.notification.domain.NotificationStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Repository for materialized notifications (Sprint C1). */
public interface NotificationRepository extends JpaRepository<Notification, Long> {

  /** The single ACTIVE notification for a dedup key on a farm, if any (dedup lookup for upsert). */
  Optional<Notification> findByFarmIdAndDedupKeyAndStatus(
      Long farmId, String dedupKey, NotificationStatus status);

  /** All notifications of a category in a given status on a farm (reconcile/resolve). */
  List<Notification> findByFarmIdAndCategoryAndStatus(
      Long farmId, NotificationCategory category, NotificationStatus status);

  /** Feed of a farm, newest first (all statuses). */
  Page<Notification> findByFarmIdOrderByCreatedAtDesc(Long farmId, Pageable pageable);

  /** Feed of a farm restricted to a status, newest first. */
  Page<Notification> findByFarmIdAndStatusOrderByCreatedAtDesc(
      Long farmId, NotificationStatus status, Pageable pageable);

  /** Count of farm notifications not yet read by the user (bell badge). */
  @Query(
      """
      SELECT COUNT(n) FROM Notification n
      WHERE n.farmId = :farmId
        AND NOT EXISTS (
          SELECT 1 FROM NotificationRead r
          WHERE r.notificationId = n.id AND r.userId = :userId)
      """)
  long countUnread(@Param("farmId") Long farmId, @Param("userId") Long userId);

  /** Active notifications of a farm, newest first (read facade for the assistant). */
  List<Notification> findByFarmIdAndStatusOrderByCreatedAtDesc(
      Long farmId, NotificationStatus status);
}
