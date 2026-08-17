package com.avicare.notification.service;

import com.avicare.common.api.exception.NotFoundException;
import com.avicare.notification.domain.Notification;
import com.avicare.notification.domain.NotificationChannel;
import com.avicare.notification.domain.NotificationPreference;
import com.avicare.notification.domain.NotificationRead;
import com.avicare.notification.domain.NotificationSeverity;
import com.avicare.notification.dto.NotificationResponse;
import com.avicare.notification.dto.PreferenceResponse;
import com.avicare.notification.dto.UpdatePreferencesRequest;
import com.avicare.notification.repository.NotificationPreferenceRepository;
import com.avicare.notification.repository.NotificationReadRepository;
import com.avicare.notification.repository.NotificationRepository;
import com.avicare.notification.service.PreferenceResolver.ResolvedCell;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reads and read-state / preference writes for the notification bell (Sprint C1). Farm-scoped; read
 * state and preferences are per user.
 */
@Service
@RequiredArgsConstructor
public class NotificationService {

  private final NotificationRepository notifications;
  private final NotificationReadRepository reads;
  private final NotificationPreferenceRepository preferences;
  private final PreferenceResolver preferenceResolver;

  @Transactional(readOnly = true)
  public Page<NotificationResponse> feed(
      Long farmId, Long userId, boolean unreadOnly, Pageable pageable) {
    if (unreadOnly) {
      return notifications
          .findUnread(farmId, userId, pageable)
          .map(n -> NotificationResponse.of(n, false));
    }
    Page<Notification> page = notifications.findByFarmIdOrderByCreatedAtDesc(farmId, pageable);
    List<Long> ids = page.stream().map(Notification::getId).toList();
    Set<Long> readIds =
        ids.isEmpty()
            ? Set.of()
            : reads.findByUserIdAndNotificationIdIn(userId, ids).stream()
                .map(NotificationRead::getNotificationId)
                .collect(Collectors.toSet());
    return page.map(n -> NotificationResponse.of(n, readIds.contains(n.getId())));
  }

  @Transactional(readOnly = true)
  public long unreadCount(Long farmId, Long userId) {
    return notifications.countUnread(farmId, userId);
  }

  @Transactional
  public void markRead(Long farmId, Long userId, Long notificationId) {
    Notification n =
        notifications
            .findById(notificationId)
            .filter(x -> x.getFarmId().equals(farmId))
            .orElseThrow(() -> NotFoundException.of("Notification", notificationId));
    if (!reads.existsByNotificationIdAndUserId(n.getId(), userId)) {
      NotificationRead r = new NotificationRead();
      r.setNotificationId(n.getId());
      r.setUserId(userId);
      reads.save(r);
    }
  }

  @Transactional
  public void markAllRead(Long farmId, Long userId) {
    List<Long> unreadIds = notifications.findUnreadIds(farmId, userId);
    List<NotificationRead> rows =
        unreadIds.stream()
            .map(
                id -> {
                  NotificationRead r = new NotificationRead();
                  r.setNotificationId(id);
                  r.setUserId(userId);
                  return r;
                })
            .toList();
    reads.saveAll(rows);
  }

  @Transactional(readOnly = true)
  public List<PreferenceResponse> getPreferences(Long farmId, Long userId) {
    List<NotificationPreference> overrides = preferences.findByFarmIdAndUserId(farmId, userId);
    return preferenceResolver.resolveAll(overrides).stream()
        .map(NotificationService::toResponse)
        .toList();
  }

  @Transactional
  public void updatePreferences(Long farmId, Long userId, UpdatePreferencesRequest req) {
    for (UpdatePreferencesRequest.Item item : req.preferences()) {
      var category = com.avicare.notification.domain.NotificationCategory.valueOf(item.category());
      var channel = NotificationChannel.valueOf(item.channel());
      var minSeverity = NotificationSeverity.valueOf(item.minSeverity());
      NotificationPreference pref =
          preferences
              .findByFarmIdAndUserIdAndCategoryAndChannel(farmId, userId, category, channel)
              .orElseGet(
                  () -> {
                    NotificationPreference p = new NotificationPreference();
                    p.setFarmId(farmId);
                    p.setUserId(userId);
                    p.setCategory(category);
                    p.setChannel(channel);
                    return p;
                  });
      pref.setEnabled(item.enabled());
      pref.setMinSeverity(minSeverity);
      preferences.save(pref);
    }
  }

  private static PreferenceResponse toResponse(ResolvedCell cell) {
    return new PreferenceResponse(
        cell.category().name(), cell.channel().name(), cell.enabled(), cell.minSeverity().name());
  }
}
