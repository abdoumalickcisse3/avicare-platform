package com.avicare.assistant.read;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import com.avicare.livestock.api.LivestockFacade;
import com.avicare.livestock.api.dto.LivestockStats;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class MortalityQueryToolTest {

  @Mock private LivestockFacade livestock;

  private MortalityQueryTool tool() {
    return new MortalityQueryTool(livestock);
  }

  private static LivestockStats withDeaths(long deaths) {
    return new LivestockStats(0, 0, deaths, null, List.of(), null, null, List.of(), 0, 0, null);
  }

  @Test
  void defaultsToSevenDays_andReportsTheDeaths() {
    when(livestock.livestockStats(eq(1L), any(), any())).thenReturn(withDeaths(12));

    String r = tool().read(1L, Map.of(), null);

    assertThat(r).contains("12").contains("7");
  }

  @Test
  void honoursAnExplicitWindow() {
    when(livestock.livestockStats(eq(1L), any(), any())).thenReturn(withDeaths(3));

    String r = tool().read(1L, Map.of("days", 30), null);

    assertThat(r).contains("3").contains("30");
    ArgumentCaptor<LocalDate> from = ArgumentCaptor.forClass(LocalDate.class);
    ArgumentCaptor<LocalDate> to = ArgumentCaptor.forClass(LocalDate.class);
    org.mockito.Mockito.verify(livestock).livestockStats(eq(1L), from.capture(), to.capture());
    assertThat(from.getValue()).isEqualTo(to.getValue().minusDays(29));
  }
}
