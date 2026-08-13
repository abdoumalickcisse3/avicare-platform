package com.avicare.assistant.read;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import com.avicare.common.api.dto.DayValue;
import com.avicare.livestock.api.LivestockFacade;
import com.avicare.livestock.api.dto.LivestockStats;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class EggProductionQueryToolTest {

  @Mock private LivestockFacade livestock;

  private EggProductionQueryTool tool() {
    return new EggProductionQueryTool(livestock);
  }

  @Test
  void sumsLayingSeries_andReportsTheRate() {
    LivestockStats stats =
        new LivestockStats(
            0,
            0,
            0,
            null,
            List.of(),
            null,
            85.0,
            List.of(
                new DayValue(LocalDate.now().minusDays(1), 100),
                new DayValue(LocalDate.now(), 120)),
            0,
            0,
            null);
    when(livestock.livestockStats(eq(1L), any(), any())).thenReturn(stats);

    String r = tool().read(1L, Map.of(), null);

    assertThat(r).contains("220").contains("85");
  }

  @Test
  void noLaying_saysSo() {
    LivestockStats stats =
        new LivestockStats(0, 0, 0, null, List.of(), null, null, List.of(), 0, 0, null);
    when(livestock.livestockStats(eq(1L), any(), any())).thenReturn(stats);

    String r = tool().read(1L, Map.of("days", 14), null);

    assertThat(r).contains("Aucune ponte").contains("14");
  }
}
