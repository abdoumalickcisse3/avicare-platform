package com.avicare.notification.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.notification.detect.AlertDetector;
import com.avicare.notification.detect.DetectedCondition;
import com.avicare.notification.domain.Notification;
import com.avicare.notification.domain.NotificationCategory;
import com.avicare.notification.domain.NotificationSeverity;
import com.avicare.notification.domain.NotificationStatus;
import com.avicare.notification.repository.NotificationRepository;
import com.avicare.notification.whatsapp.OutboxEnqueuer;
import com.avicare.tenancy.api.TenancyFacade;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class NotificationScannerServiceTest {

  @Mock AlertDetector detector;
  @Mock NotificationRepository repo;
  @Mock TenancyFacade tenancyFacade;
  @Mock OutboxEnqueuer outboxEnqueuer;

  NotificationScannerService scanner;

  @BeforeEach
  void setUp() {
    scanner =
        new NotificationScannerService(List.of(detector), repo, tenancyFacade, outboxEnqueuer);
  }

  private DetectedCondition cond(String key) {
    return new DetectedCondition(
        NotificationCategory.LOW_STOCK,
        NotificationSeverity.WARNING,
        key,
        "Stock bas",
        "détail",
        Map.of("itemId", 42L));
  }

  private Notification active(String key) {
    Notification n = new Notification();
    n.setFarmId(1L);
    n.setCategory(NotificationCategory.LOW_STOCK);
    n.setSeverity(NotificationSeverity.WARNING);
    n.setTitle("Stock bas");
    n.setDedupKey(key);
    n.setStatus(NotificationStatus.ACTIVE);
    return n;
  }

  @Test
  void createsNotification_forNewCondition_andEnqueues() {
    when(detector.categories()).thenReturn(Set.of(NotificationCategory.LOW_STOCK));
    when(detector.detect(1L)).thenReturn(List.of(cond("LOW_STOCK:item:42")));
    when(repo.findByFarmIdAndDedupKeyAndStatus(1L, "LOW_STOCK:item:42", NotificationStatus.ACTIVE))
        .thenReturn(Optional.empty());
    when(repo.findByFarmIdAndCategoryAndStatus(
            1L, NotificationCategory.LOW_STOCK, NotificationStatus.ACTIVE))
        .thenReturn(List.of());
    when(repo.save(any(Notification.class))).thenAnswer(inv -> inv.getArgument(0));

    scanner.scanFarm(1L);

    verify(repo)
        .save(
            argThat(
                n ->
                    n.getDedupKey().equals("LOW_STOCK:item:42")
                        && n.getStatus() == NotificationStatus.ACTIVE));
    verify(outboxEnqueuer).enqueueFor(any(Notification.class));
  }

  @Test
  void idempotent_whenActiveNotificationAlreadyExists() {
    when(detector.categories()).thenReturn(Set.of(NotificationCategory.LOW_STOCK));
    when(detector.detect(1L)).thenReturn(List.of(cond("LOW_STOCK:item:42")));
    when(repo.findByFarmIdAndDedupKeyAndStatus(1L, "LOW_STOCK:item:42", NotificationStatus.ACTIVE))
        .thenReturn(Optional.of(active("LOW_STOCK:item:42")));
    when(repo.findByFarmIdAndCategoryAndStatus(
            1L, NotificationCategory.LOW_STOCK, NotificationStatus.ACTIVE))
        .thenReturn(List.of(active("LOW_STOCK:item:42")));

    scanner.scanFarm(1L);

    verify(repo, never()).save(any());
    verify(outboxEnqueuer, never()).enqueueFor(any());
  }

  @Test
  void resolvesNotification_whenConditionDisappears() {
    when(detector.categories()).thenReturn(Set.of(NotificationCategory.LOW_STOCK));
    when(detector.detect(1L)).thenReturn(List.of());
    Notification stale = active("LOW_STOCK:item:42");
    when(repo.findByFarmIdAndCategoryAndStatus(
            1L, NotificationCategory.LOW_STOCK, NotificationStatus.ACTIVE))
        .thenReturn(List.of(stale));

    scanner.scanFarm(1L);

    assertThat(stale.getStatus()).isEqualTo(NotificationStatus.RESOLVED);
    assertThat(stale.getResolvedAt()).isNotNull();
    verify(repo).save(stale);
  }

  @Test
  void scanAll_iteratesAllFarms() {
    when(tenancyFacade.listAllFarmIds()).thenReturn(List.of(1L));
    when(detector.categories()).thenReturn(Set.of(NotificationCategory.LOW_STOCK));
    when(detector.detect(1L)).thenReturn(List.of());
    when(repo.findByFarmIdAndCategoryAndStatus(
            1L, NotificationCategory.LOW_STOCK, NotificationStatus.ACTIVE))
        .thenReturn(List.of());

    scanner.scanAll();

    verify(detector).detect(1L);
  }
}
