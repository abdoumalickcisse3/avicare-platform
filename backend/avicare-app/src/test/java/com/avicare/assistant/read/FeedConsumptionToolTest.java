package com.avicare.assistant.read;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import com.avicare.livestock.api.LivestockFacade;
import com.avicare.livestock.api.dto.LivestockStats;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class FeedConsumptionToolTest {

  @Mock private LivestockFacade livestock;

  private FeedConsumptionTool tool() {
    return new FeedConsumptionTool(livestock);
  }

  private static LivestockStats withFeed(Double kg) {
    return new LivestockStats(0, 0, 0, null, List.of(), null, null, List.of(), 0, 0, kg);
  }

  @Test
  void reportsAverageDailyFeed() {
    when(livestock.livestockStats(eq(1L), any(), any())).thenReturn(withFeed(48.4));

    String r = tool().read(1L, Map.of(), null);

    assertThat(r).contains("48").contains("kg/jour");
  }

  @Test
  void noData_saysSo() {
    when(livestock.livestockStats(eq(1L), any(), any())).thenReturn(withFeed(null));

    String r = tool().read(1L, Map.of("days", 14), null);

    assertThat(r).contains("Aucune consommation").contains("14");
  }
}
