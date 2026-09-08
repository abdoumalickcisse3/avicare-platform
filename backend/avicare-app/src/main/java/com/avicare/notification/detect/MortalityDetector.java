package com.avicare.notification.detect;

import com.avicare.livestock.api.LivestockFacade;
import com.avicare.livestock.api.dto.MortalitySpike;
import com.avicare.notification.domain.NotificationCategory;
import com.avicare.notification.domain.NotificationSeverity;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Maps abnormal mortality ({@link LivestockFacade#mortalitySpikes(Long)}) to {@link
 * DetectedCondition}s. Owns {@code MORTALITY_ANOMALY}. No business logic — the facade owns
 * detection.
 *
 * <p>This category existed from Sprint C1 and had <b>no detector at all</b>: the settings screen
 * offered "Mortalité anormale", a farmer could switch it on for WhatsApp, and nothing would ever
 * fire it. An empty promise on the one alert the whole business turns on — a flock loses birds
 * quietly, and by the time the weekly figures say so, the episode is over.
 *
 * <p>CRITICAL on purpose: it is one of the two conditions that must reach a phone in the field
 * rather than wait for someone to open the app.
 */
@Component
@RequiredArgsConstructor
public class MortalityDetector implements AlertDetector {

  private final LivestockFacade livestockFacade;

  @Override
  public Set<NotificationCategory> categories() {
    return Set.of(NotificationCategory.MORTALITY_ANOMALY);
  }

  @Override
  public List<DetectedCondition> detect(Long farmId) {
    return livestockFacade.mortalitySpikes(farmId).stream()
        .map(MortalityDetector::toCondition)
        .toList();
  }

  private static DetectedCondition toCondition(MortalitySpike s) {
    /*
     * Dedup on the lot, not on the day: a farmer who is already told this morning does not need a
     * second message for the same episode. The scanner resolves it when the lot comes back to its
     * usual level, so the next spike alerts again.
     */
    String body =
        s.baseline() > 0
            ? "Le lot « "
                + s.unitName()
                + " » a perdu "
                + s.deaths()
                + " sujets aujourd'hui, contre "
                + s.baseline()
                + " en moyenne ces derniers jours."
            : "Le lot « "
                + s.unitName()
                + " » a perdu "
                + s.deaths()
                + " sujets aujourd'hui, alors qu'il n'en perdait aucun ces derniers jours.";

    return new DetectedCondition(
        NotificationCategory.MORTALITY_ANOMALY,
        NotificationSeverity.CRITICAL,
        "MORTALITY_ANOMALY:unit:" + s.unitId(),
        "Mortalité anormale : " + s.unitName(),
        body,
        Map.of("unitId", s.unitId()));
  }
}
