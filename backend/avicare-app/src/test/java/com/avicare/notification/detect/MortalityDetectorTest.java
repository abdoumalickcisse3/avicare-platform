package com.avicare.notification.detect;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.avicare.livestock.api.LivestockFacade;
import com.avicare.livestock.api.dto.MortalitySpike;
import com.avicare.notification.domain.NotificationCategory;
import com.avicare.notification.domain.NotificationSeverity;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

/**
 * MORTALITY_ANOMALY had no detector at all: the settings screen offered it, a farmer could switch
 * it on for WhatsApp, and nothing would ever fire it — an empty promise on the one alert the whole
 * business turns on.
 */
class MortalityDetectorTest {

  private LivestockFacade livestock;
  private MortalityDetector detector;

  @BeforeEach
  void setUp() {
    livestock = Mockito.mock(LivestockFacade.class);
    detector = new MortalityDetector(livestock);
  }

  @Test
  void ownsTheCategoryThatHadNoDetector() {
    assertThat(detector.categories()).containsExactly(NotificationCategory.MORTALITY_ANOMALY);
  }

  @Test
  void spikeIsCritical_andNamesTheLotAndBothFigures() {
    when(livestock.mortalitySpikes(7L)).thenReturn(List.of(new MortalitySpike(3L, "Lot A", 12, 2)));

    List<DetectedCondition> conditions = detector.detect(7L);

    assertThat(conditions).hasSize(1);
    DetectedCondition c = conditions.get(0);
    assertThat(c.category()).isEqualTo(NotificationCategory.MORTALITY_ANOMALY);
    // One of the two conditions that must reach a phone in the field, not wait for someone to
    // open the app.
    assertThat(c.severity()).isEqualTo(NotificationSeverity.CRITICAL);
    assertThat(c.title()).contains("Lot A");
    assertThat(c.body()).contains("12").contains("2");
    assertThat(c.sourceRef()).containsEntry("unitId", 3L);
  }

  /** Dedup on the lot, so one episode is one message — not one per scan. */
  @Test
  void dedupKeyIsPerLot() {
    when(livestock.mortalitySpikes(7L))
        .thenReturn(
            List.of(new MortalitySpike(3L, "Lot A", 12, 2), new MortalitySpike(4L, "Lot B", 9, 1)));

    assertThat(detector.detect(7L))
        .extracting(DetectedCondition::dedupKey)
        .containsExactly("MORTALITY_ANOMALY:unit:3", "MORTALITY_ANOMALY:unit:4");
  }

  /** A lot that never lost a bird reads differently — "contre 0 en moyenne" says nothing. */
  @Test
  void zeroBaselineGetsItsOwnWording() {
    when(livestock.mortalitySpikes(7L)).thenReturn(List.of(new MortalitySpike(3L, "Lot A", 4, 0)));

    assertThat(detector.detect(7L).get(0).body()).contains("aucun");
  }

  @Test
  void noSpike_noCondition() {
    when(livestock.mortalitySpikes(7L)).thenReturn(List.of());

    assertThat(detector.detect(7L)).isEmpty();
  }
}
