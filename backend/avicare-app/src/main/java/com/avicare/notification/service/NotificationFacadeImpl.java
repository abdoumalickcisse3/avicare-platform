package com.avicare.notification.service;

import com.avicare.notification.api.NotificationFacade;
import com.avicare.notification.api.NotificationView;
import com.avicare.notification.domain.Notification;
import com.avicare.notification.domain.NotificationStatus;
import com.avicare.notification.repository.NotificationRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Default {@link NotificationFacade}, delegating to the notification repository (Sprint C1). */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class NotificationFacadeImpl implements NotificationFacade {

  private final NotificationRepository notifications;

  @Override
  public List<NotificationView> listActive(Long farmId) {
    return notifications
        .findByFarmIdAndStatusOrderByCreatedAtDesc(farmId, NotificationStatus.ACTIVE)
        .stream()
        .map(NotificationFacadeImpl::toView)
        .toList();
  }

  @Override
  public long unreadCount(Long farmId, Long userId) {
    return notifications.countUnread(farmId, userId);
  }

  private static NotificationView toView(Notification n) {
    return new NotificationView(
        n.getId(),
        n.getCategory().name(),
        n.getSeverity().name(),
        n.getTitle(),
        n.getBody(),
        n.getCreatedAt());
  }
}
