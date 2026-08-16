package com.avicare.notification.detect;

import com.avicare.livestock.api.InventoryFacade;
import com.avicare.livestock.api.dto.InventoryAlertInfo;
import com.avicare.notification.domain.NotificationCategory;
import com.avicare.notification.domain.NotificationSeverity;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Maps inventory alert conditions ({@link InventoryFacade#inventoryAlerts(Long)}) to {@link
 * DetectedCondition}s (Sprint C1). Owns {@code LOW_STOCK}, {@code NEGATIVE_STOCK} and {@code
 * PO_OVERDUE}. No business logic — the facade owns detection.
 */
@Component
@RequiredArgsConstructor
public class InventoryDetector implements AlertDetector {

  private final InventoryFacade inventoryFacade;

  @Override
  public Set<NotificationCategory> categories() {
    return Set.of(
        NotificationCategory.LOW_STOCK,
        NotificationCategory.NEGATIVE_STOCK,
        NotificationCategory.PO_OVERDUE);
  }

  @Override
  public List<DetectedCondition> detect(Long farmId) {
    return inventoryFacade.inventoryAlerts(farmId).stream()
        .map(InventoryDetector::toCondition)
        .toList();
  }

  private static DetectedCondition toCondition(InventoryAlertInfo a) {
    return switch (a.kind()) {
      case "LOW_STOCK" ->
          new DetectedCondition(
              NotificationCategory.LOW_STOCK,
              NotificationSeverity.WARNING,
              "LOW_STOCK:item:" + a.refId(),
              "Stock bas : " + a.label(),
              "Le stock de « " + a.label() + " » est au niveau d'alerte.",
              Map.of("itemId", a.refId()));
      case "NEGATIVE_STOCK" ->
          new DetectedCondition(
              NotificationCategory.NEGATIVE_STOCK,
              NotificationSeverity.CRITICAL,
              "NEGATIVE_STOCK:item:" + a.refId(),
              "Stock négatif : " + a.label(),
              "Le stock de « " + a.label() + " » est passé sous zéro.",
              Map.of("itemId", a.refId()));
      case "PO_OVERDUE" ->
          new DetectedCondition(
              NotificationCategory.PO_OVERDUE,
              NotificationSeverity.WARNING,
              "PO_OVERDUE:po:" + a.refId(),
              "Commande en retard : " + a.label(),
              "Le bon de commande « "
                  + a.label()
                  + " » a "
                  + a.daysOverdue()
                  + " jour(s) de retard de livraison.",
              Map.of("purchaseOrderId", a.refId()));
      default -> throw new IllegalStateException("Unknown inventory alert kind: " + a.kind());
    };
  }
}
