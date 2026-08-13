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
class GrowthQueryToolTest {

  @Mock private LivestockFacade livestock;

  private GrowthQueryTool tool() {
    return new GrowthQueryTool(livestock);
  }

  private static LivestockStats withGain(Double gain) {
    return new LivestockStats(0, 0, 0, null, List.of(), gain, null, List.of(), 0, 0, null);
  }

  @Test
  void reportsTheRoundedGmq() {
    when(livestock.livestockStats(eq(1L), any(), any())).thenReturn(withGain(52.7));

    String r = tool().read(1L, Map.of(), null);

    assertThat(r).contains("53").contains("g/jour");
  }

  @Test
  void noWeighings_saysNotEnoughData() {
    when(livestock.livestockStats(eq(1L), any(), any())).thenReturn(withGain(null));

    String r = tool().read(1L, Map.of(), null);

    assertThat(r).contains("Pas assez");
  }
}
