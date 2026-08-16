package com.avicare.notification.detect;

import com.avicare.livestock.health.HealthAlertInfo;
import com.avicare.livestock.health.HealthFacade;
import com.avicare.notification.domain.NotificationCategory;
import com.avicare.notification.domain.NotificationSeverity;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Maps health alert conditions ({@link HealthFacade#healthAlerts(Long)}) to {@link
 * DetectedCondition}s (Sprint C1). Owns {@code VACCINATION_LATE}, {@code WITHDRAWAL_ENDING} and
 * {@code CRITICAL_OBSERVATION}. No business logic — the facade owns detection.
 */
@Component
@RequiredArgsConstructor
public class HealthDetector implements AlertDetector {

  private final HealthFacade healthFacade;

  @Override
  public Set<NotificationCategory> categories() {
    return Set.of(
        NotificationCategory.VACCINATION_LATE,
        NotificationCategory.WITHDRAWAL_ENDING,
        NotificationCategory.CRITICAL_OBSERVATION);
  }

  @Override
  public List<DetectedCondition> detect(Long farmId) {
    return healthFacade.healthAlerts(farmId).stream().map(HealthDetector::toCondition).toList();
  }

  private static DetectedCondition toCondition(HealthAlertInfo a) {
    Map<String, Object> ref = Map.of("unitId", a.unitId());
    return switch (a.kind()) {
      case "VACCINATION_LATE" ->
          new DetectedCondition(
              NotificationCategory.VACCINATION_LATE,
              NotificationSeverity.WARNING,
              "VACCINATION_LATE:unit:" + a.unitId() + ":" + a.refKey(),
              "Vaccination en retard : " + a.label(),
              "La vaccination « " + a.label() + " » a " + a.days() + " jour(s) de retard.",
              ref);
      case "WITHDRAWAL_ENDING" ->
          new DetectedCondition(
              NotificationCategory.WITHDRAWAL_ENDING,
              NotificationSeverity.WARNING,
              "WITHDRAWAL_ENDING:treatment:" + a.refId(),
              "Délai d'attente en cours : " + a.label(),
              "Le délai d'attente du traitement « "
                  + a.label()
                  + " » se termine dans "
                  + a.days()
                  + " jour(s).",
              ref);
      case "CRITICAL_OBSERVATION" ->
          new DetectedCondition(
              NotificationCategory.CRITICAL_OBSERVATION,
              NotificationSeverity.CRITICAL,
              "CRITICAL_OBSERVATION:obs:" + a.refId(),
              "Observation critique : " + a.label(),
              a.label(),
              ref);
      default -> throw new IllegalStateException("Unknown health alert kind: " + a.kind());
    };
  }
}
