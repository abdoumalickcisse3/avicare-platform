package com.avicare.notification.repository;

import com.avicare.notification.domain.NotificationChannel;
import com.avicare.notification.domain.NotificationPreference;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** Repository for per-user notification preference overrides (Sprint C1). */
public interface NotificationPreferenceRepository
    extends JpaRepository<NotificationPreference, Long> {

  List<NotificationPreference> findByFarmIdAndUserId(Long farmId, Long userId);

  /** All overrides for a channel on a farm across users (WhatsApp enqueue fan-out). */
  List<NotificationPreference> findByFarmIdAndChannel(Long farmId, NotificationChannel channel);

  Optional<NotificationPreference> findByFarmIdAndUserIdAndCategoryAndChannel(
      Long farmId,
      Long userId,
      com.avicare.notification.domain.NotificationCategory category,
      NotificationChannel channel);
}
