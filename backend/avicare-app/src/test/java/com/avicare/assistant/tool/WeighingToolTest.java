package com.avicare.assistant.tool;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.avicare.assistant.dto.InterpretResponse;
import com.avicare.livestock.api.LivestockFacade;
import com.avicare.livestock.domain.UnitStatus;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class WeighingToolTest {

  @Mock private LivestockFacade livestock;

  private WeighingTool tool() {
    return new WeighingTool(new LivestockUnits(livestock));
  }

  @Test
  void weights_producesDraftWithAverage() {
    when(livestock.listFarmUnits(1L))
        .thenReturn(List.of(MortalityToolTest.unit(3L, "B-12", 480, UnitStatus.ACTIVE)));

    InterpretResponse r = tool().dryRun(1L, Map.of("weights", List.of(1200, 1150, 1300)), 3L);

    assertThat(r.kind()).isEqualTo("DRAFT");
    assertThat(r.fields()).containsEntry("sampleSize", 3).containsEntry("avgWeightG", 1217);
    assertThat(r.summary()).contains("B-12").contains("1217");
  }

  @Test
  void noWeights_asks() {
    InterpretResponse r = tool().dryRun(1L, Map.of("weights", List.of()), 3L);

    assertThat(r.kind()).isEqualTo("CLARIFICATION");
    assertThat(r.message()).contains("poids");
  }
}
