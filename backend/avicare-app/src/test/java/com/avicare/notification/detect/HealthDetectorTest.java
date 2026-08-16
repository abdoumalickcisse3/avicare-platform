package com.avicare.notification.detect;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.avicare.livestock.health.HealthAlertInfo;
import com.avicare.livestock.health.HealthFacade;
import com.avicare.notification.domain.NotificationCategory;
import com.avicare.notification.domain.NotificationSeverity;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class HealthDetectorTest {

  @Mock HealthFacade healthFacade;
  @InjectMocks HealthDetector detector;

  @Test
  void ownsThreeHealthCategories() {
    assertThat(detector.categories())
        .containsExactlyInAnyOrder(
            NotificationCategory.VACCINATION_LATE,
            NotificationCategory.WITHDRAWAL_ENDING,
            NotificationCategory.CRITICAL_OBSERVATION);
  }

  @Test
  void mapsEachKindToCategorySeverityAndDedupKey() {
    when(healthFacade.healthAlerts(1L))
        .thenReturn(
            List.of(
                new HealthAlertInfo("VACCINATION_LATE", 3L, null, "newcastle", "Newcastle", 4),
                new HealthAlertInfo("WITHDRAWAL_ENDING", 3L, 55L, "oxytetra", "Oxytétracycline", 2),
                new HealthAlertInfo("CRITICAL_OBSERVATION", 3L, 77L, null, "Mortalité en pic", 0)));

    List<DetectedCondition> out = detector.detect(1L);

    assertThat(out)
        .anySatisfy(
            c -> {
              assertThat(c.category()).isEqualTo(NotificationCategory.VACCINATION_LATE);
              assertThat(c.severity()).isEqualTo(NotificationSeverity.WARNING);
              assertThat(c.dedupKey()).isEqualTo("VACCINATION_LATE:unit:3:newcastle");
              assertThat(c.sourceRef()).containsEntry("unitId", 3L);
            })
        .anySatisfy(
            c -> {
              assertThat(c.category()).isEqualTo(NotificationCategory.WITHDRAWAL_ENDING);
              assertThat(c.severity()).isEqualTo(NotificationSeverity.WARNING);
              assertThat(c.dedupKey()).isEqualTo("WITHDRAWAL_ENDING:treatment:55");
            })
        .anySatisfy(
            c -> {
              assertThat(c.category()).isEqualTo(NotificationCategory.CRITICAL_OBSERVATION);
              assertThat(c.severity()).isEqualTo(NotificationSeverity.CRITICAL);
              assertThat(c.dedupKey()).isEqualTo("CRITICAL_OBSERVATION:obs:77");
            });
  }
}
