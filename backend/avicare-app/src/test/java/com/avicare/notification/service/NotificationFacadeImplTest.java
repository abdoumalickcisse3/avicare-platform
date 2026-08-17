package com.avicare.notification.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.avicare.notification.api.NotificationView;
import com.avicare.notification.domain.Notification;
import com.avicare.notification.domain.NotificationCategory;
import com.avicare.notification.domain.NotificationSeverity;
import com.avicare.notification.domain.NotificationStatus;
import com.avicare.notification.repository.NotificationRepository;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class NotificationFacadeImplTest {

  @Mock NotificationRepository notifications;
  @InjectMocks NotificationFacadeImpl facade;

  @Test
  void listActive_mapsActiveNotificationsToViews() {
    Notification n = new Notification();
    n.setFarmId(1L);
    n.setCategory(NotificationCategory.LOW_STOCK);
    n.setSeverity(NotificationSeverity.WARNING);
    n.setTitle("Stock bas");
    n.setBody("détail");
    when(notifications.findByFarmIdAndStatusOrderByCreatedAtDesc(1L, NotificationStatus.ACTIVE))
        .thenReturn(List.of(n));

    List<NotificationView> out = facade.listActive(1L);

    assertThat(out)
        .singleElement()
        .satisfies(
            v -> {
              assertThat(v.category()).isEqualTo("LOW_STOCK");
              assertThat(v.severity()).isEqualTo("WARNING");
              assertThat(v.title()).isEqualTo("Stock bas");
            });
  }

  @Test
  void unreadCount_delegates() {
    when(notifications.countUnread(1L, 5L)).thenReturn(4L);
    assertThat(facade.unreadCount(1L, 5L)).isEqualTo(4L);
  }
}
