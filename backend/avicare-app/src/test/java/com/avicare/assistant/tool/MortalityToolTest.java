package com.avicare.assistant.tool;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.avicare.assistant.dto.InterpretResponse;
import com.avicare.livestock.api.LivestockFacade;
import com.avicare.livestock.api.dto.ProductionUnitInfo;
import com.avicare.livestock.domain.Species;
import com.avicare.livestock.domain.UnitKind;
import com.avicare.livestock.domain.UnitStatus;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class MortalityToolTest {

  @Mock private LivestockFacade livestock;

  private MortalityTool tool() {
    return new MortalityTool(new LivestockUnits(livestock));
  }

  static ProductionUnitInfo unit(long id, String name, int count, UnitStatus status) {
    return new ProductionUnitInfo(id, 1L, Species.POULTRY, UnitKind.BATCH, 5L, name, count, status);
  }

  @Test
  void knownLot_producesDraftWithHeadcountAfter() {
    when(livestock.listFarmUnits(1L)).thenReturn(List.of(unit(3L, "B-12", 480, UnitStatus.ACTIVE)));

    InterpretResponse r = tool().dryRun(1L, Map.of("count", 10), 3L);

    assertThat(r.kind()).isEqualTo("DRAFT");
    assertThat(r.unitId()).isEqualTo(3L);
    assertThat(r.fields()).containsEntry("count", 10).containsEntry("countAfter", 470);
    assertThat(r.summary()).contains("B-12").contains("470");
  }

  @Test
  void ambiguousLot_asksWhichLot() {
    when(livestock.listFarmUnits(1L))
        .thenReturn(
            List.of(
                unit(3L, "B-12", 480, UnitStatus.ACTIVE),
                unit(4L, "B-13", 300, UnitStatus.ACTIVE)));

    InterpretResponse r = tool().dryRun(1L, Map.of("count", 5), null);

    assertThat(r.kind()).isEqualTo("CLARIFICATION");
    assertThat(r.message()).contains("lot");
  }

  @Test
  void singleActiveLot_isChosenByDefault() {
    when(livestock.listFarmUnits(1L))
        .thenReturn(
            List.of(
                unit(3L, "B-12", 480, UnitStatus.ACTIVE), unit(9L, "old", 0, UnitStatus.CLOSED)));

    InterpretResponse r = tool().dryRun(1L, Map.of("count", 4), null);

    assertThat(r.kind()).isEqualTo("DRAFT");
    assertThat(r.unitId()).isEqualTo(3L);
  }

  @Test
  void zeroCount_asksHowMany() {
    InterpretResponse r = tool().dryRun(1L, Map.of("count", 0), 3L);

    assertThat(r.kind()).isEqualTo("CLARIFICATION");
    assertThat(r.message()).contains("Combien");
  }
}
