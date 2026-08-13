package com.avicare.assistant.tool;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

import com.avicare.assistant.dto.InterpretResponse;
import com.avicare.livestock.api.LivestockFacade;
import com.avicare.livestock.api.dto.TimeslotInfo;
import com.avicare.livestock.domain.UnitStatus;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class EggCollectionToolTest {

  @Mock private LivestockFacade livestock;

  private static final List<TimeslotInfo> SLOTS =
      List.of(
          new TimeslotInfo("morning", "Matin"),
          new TimeslotInfo("noon", "Midi"),
          new TimeslotInfo("evening", "Soir"));

  private EggCollectionTool tool() {
    return new EggCollectionTool(livestock);
  }

  @Test
  void spokenSlotAndSingleLayer_buildsDraftWithResolvedKey() {
    when(livestock.activeLayerUnits(1L))
        .thenReturn(List.of(MortalityToolTest.unit(7L, "Pondeuses A", 900, UnitStatus.ACTIVE)));
    when(livestock.layerTimeslots(1L)).thenReturn(SLOTS);

    InterpretResponse r =
        tool().dryRun(1L, Map.of("totalEggs", 420, "brokenEggs", 8, "timeslot", "matin"), null);

    assertThat(r.kind()).isEqualTo("DRAFT");
    assertThat(r.action()).isEqualTo("EGG_COLLECTION");
    assertThat(r.fields())
        .containsEntry("unitId", 7L)
        .containsEntry("timeslotKey", "morning")
        .containsEntry("timeslotLabel", "Matin")
        .containsEntry("totalEggs", 420)
        .containsEntry("brokenEggs", 8)
        .containsEntry("collectionDate", LocalDate.now().toString());
    assertThat(r.summary()).contains("420").contains("Matin").contains("Pondeuses A");
  }

  @Test
  void noSlotSaidAndSeveralSlots_asksWhichSlot() {
    when(livestock.activeLayerUnits(1L))
        .thenReturn(List.of(MortalityToolTest.unit(7L, "Pondeuses A", 900, UnitStatus.ACTIVE)));
    when(livestock.layerTimeslots(1L)).thenReturn(SLOTS);

    InterpretResponse r = tool().dryRun(1L, Map.of("totalEggs", 100), null);

    assertThat(r.kind()).isEqualTo("CLARIFICATION");
    assertThat(r.message()).contains("créneau").contains("Matin").contains("Soir");
  }

  @Test
  void noActiveLayer_asksNothingToRecordOn() {
    lenient().when(livestock.layerTimeslots(1L)).thenReturn(SLOTS);
    when(livestock.activeLayerUnits(1L)).thenReturn(List.of());

    InterpretResponse r = tool().dryRun(1L, Map.of("totalEggs", 100, "timeslot", "soir"), null);

    assertThat(r.kind()).isEqualTo("CLARIFICATION");
    assertThat(r.message()).contains("pondeuses");
  }

  @Test
  void multipleLayersAmbiguous_asksWhichLot() {
    lenient().when(livestock.layerTimeslots(1L)).thenReturn(SLOTS);
    when(livestock.activeLayerUnits(1L))
        .thenReturn(
            List.of(
                MortalityToolTest.unit(7L, "Pondeuses A", 900, UnitStatus.ACTIVE),
                MortalityToolTest.unit(8L, "Pondeuses B", 800, UnitStatus.ACTIVE)));

    InterpretResponse r = tool().dryRun(1L, Map.of("totalEggs", 100, "timeslot", "midi"), null);

    assertThat(r.kind()).isEqualTo("CLARIFICATION");
    assertThat(r.message()).contains("Sur quel lot de pondeuses");
  }

  @Test
  void noEggs_asksHowMany() {
    InterpretResponse r = tool().dryRun(1L, Map.of("totalEggs", 0), null);

    assertThat(r.kind()).isEqualTo("CLARIFICATION");
    assertThat(r.message()).contains("Combien");
  }
}
