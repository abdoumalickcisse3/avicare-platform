package com.avicare.notification.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.common.api.exception.NotFoundException;
import com.avicare.notification.domain.Notification;
import com.avicare.notification.domain.NotificationRead;
import com.avicare.notification.repository.NotificationPreferenceRepository;
import com.avicare.notification.repository.NotificationReadRepository;
import com.avicare.notification.repository.NotificationRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {

  @Mock NotificationRepository notifications;
  @Mock NotificationReadRepository reads;
  @Mock NotificationPreferenceRepository preferences;

  NotificationService service;

  private NotificationService service() {
    return new NotificationService(notifications, reads, preferences, new PreferenceResolver());
  }

  @Test
  void unreadCount_delegatesToRepository() {
    when(notifications.countUnread(1L, 5L)).thenReturn(3L);
    assertThat(service().unreadCount(1L, 5L)).isEqualTo(3L);
  }

  @Test
  void markRead_insertsOnce_thenIdempotent() {
    Notification n = new Notification();
    n.setFarmId(1L);
    when(notifications.findById(10L)).thenReturn(Optional.of(n));
    // n.getId() is null in this unit (no persistence); stub existence on null id
    when(reads.existsByNotificationIdAndUserId(n.getId(), 5L)).thenReturn(false, true);

    NotificationService svc = service();
    svc.markRead(1L, 5L, 10L);
    svc.markRead(1L, 5L, 10L);

    verify(reads).save(any(NotificationRead.class)); // saved exactly once (second call is a no-op)
  }

  @Test
  void markRead_404_whenNotificationBelongsToAnotherFarm() {
    Notification n = new Notification();
    n.setFarmId(999L);
    when(notifications.findById(10L)).thenReturn(Optional.of(n));

    assertThatThrownBy(() -> service().markRead(1L, 5L, 10L)).isInstanceOf(NotFoundException.class);
    verify(reads, never()).save(any());
  }

  @Test
  void getPreferences_returnsFullGrid() {
    when(preferences.findByFarmIdAndUserId(1L, 5L)).thenReturn(java.util.List.of());
    assertThat(service().getPreferences(1L, 5L)).isNotEmpty();
  }
}
