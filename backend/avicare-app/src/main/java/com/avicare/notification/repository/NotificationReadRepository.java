package com.avicare.notification.repository;

import com.avicare.notification.domain.NotificationRead;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

/** Repository for per-user read markers (Sprint C1). */
public interface NotificationReadRepository extends JpaRepository<NotificationRead, Long> {

  boolean existsByNotificationIdAndUserId(Long notificationId, Long userId);

  /** Ids of notifications already read by a user among the given ids (feed read-flag join). */
  List<NotificationRead> findByUserIdAndNotificationIdIn(Long userId, List<Long> notificationIds);
}
