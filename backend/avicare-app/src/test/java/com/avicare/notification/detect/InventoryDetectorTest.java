package com.avicare.notification.detect;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.avicare.livestock.api.InventoryFacade;
import com.avicare.livestock.api.dto.InventoryAlertInfo;
import com.avicare.notification.domain.NotificationCategory;
import com.avicare.notification.domain.NotificationSeverity;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class InventoryDetectorTest {

  @Mock InventoryFacade inventoryFacade;
  @InjectMocks InventoryDetector detector;

  @Test
  void ownsThreeInventoryCategories() {
    assertThat(detector.categories())
        .containsExactlyInAnyOrder(
            NotificationCategory.LOW_STOCK,
            NotificationCategory.NEGATIVE_STOCK,
            NotificationCategory.PO_OVERDUE);
  }

  @Test
  void mapsLowStockToWarningCondition_withStableDedupKeyAndItemRef() {
    when(inventoryFacade.inventoryAlerts(1L))
        .thenReturn(List.of(new InventoryAlertInfo("LOW_STOCK", 42L, "Aliment démarrage", 0)));

    List<DetectedCondition> out = detector.detect(1L);

    assertThat(out)
        .singleElement()
        .satisfies(
            c -> {
              assertThat(c.category()).isEqualTo(NotificationCategory.LOW_STOCK);
              assertThat(c.severity()).isEqualTo(NotificationSeverity.WARNING);
              assertThat(c.dedupKey()).isEqualTo("LOW_STOCK:item:42");
              assertThat(c.sourceRef()).containsEntry("itemId", 42L);
              assertThat(c.title()).contains("Aliment démarrage");
            });
  }

  @Test
  void mapsNegativeStockToCritical_andPoOverdueToWarning() {
    when(inventoryFacade.inventoryAlerts(1L))
        .thenReturn(
            List.of(
                new InventoryAlertInfo("NEGATIVE_STOCK", 7L, "Maïs", 0),
                new InventoryAlertInfo("PO_OVERDUE", 99L, "BC-2026-003", 5)));

    List<DetectedCondition> out = detector.detect(1L);

    assertThat(out)
        .anySatisfy(
            c -> {
              assertThat(c.category()).isEqualTo(NotificationCategory.NEGATIVE_STOCK);
              assertThat(c.severity()).isEqualTo(NotificationSeverity.CRITICAL);
              assertThat(c.dedupKey()).isEqualTo("NEGATIVE_STOCK:item:7");
              assertThat(c.sourceRef()).containsEntry("itemId", 7L);
            })
        .anySatisfy(
            c -> {
              assertThat(c.category()).isEqualTo(NotificationCategory.PO_OVERDUE);
              assertThat(c.severity()).isEqualTo(NotificationSeverity.WARNING);
              assertThat(c.dedupKey()).isEqualTo("PO_OVERDUE:po:99");
              assertThat(c.sourceRef()).containsEntry("purchaseOrderId", 99L);
            });
  }
}
