package com.avicare.assistant.tool;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

import com.avicare.assistant.dto.InterpretResponse;
import com.avicare.livestock.api.LivestockFacade;
import com.avicare.livestock.domain.UnitStatus;
import com.avicare.parameters.api.ParametersFacade;
import com.avicare.parameters.api.dto.CatalogEntryInfo;
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
  @Mock private ParametersFacade parameters;

  private static final List<CatalogEntryInfo> SLOTS =
      List.of(slot("morning", "Matin", 1), slot("noon", "Midi", 2), slot("evening", "Soir", 3));

  private static CatalogEntryInfo slot(String key, String label, int order) {
    return new CatalogEntryInfo(
        "egg_timeslots", key, Map.of("label", label, "order", order), false);
  }

  private EggCollectionTool tool() {
    return new EggCollectionTool(livestock, parameters);
  }

  @Test
  void spokenSlotAndSingleLayer_buildsDraftWithResolvedKey() {
    when(livestock.activeLayerUnits(1L))
        .thenReturn(List.of(MortalityToolTest.unit(7L, "Pondeuses A", 900, UnitStatus.ACTIVE)));
    when(parameters.listForFarm(1L, "egg_timeslots")).thenReturn(SLOTS);

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
    when(parameters.listForFarm(1L, "egg_timeslots")).thenReturn(SLOTS);

    InterpretResponse r = tool().dryRun(1L, Map.of("totalEggs", 100), null);

    assertThat(r.kind()).isEqualTo("CLARIFICATION");
    assertThat(r.message()).contains("créneau").contains("Matin").contains("Soir");
  }

  @Test
  void noActiveLayer_asksNothingToRecordOn() {
    lenient().when(parameters.listForFarm(1L, "egg_timeslots")).thenReturn(SLOTS);
    when(livestock.activeLayerUnits(1L)).thenReturn(List.of());

    InterpretResponse r = tool().dryRun(1L, Map.of("totalEggs", 100, "timeslot", "soir"), null);

    assertThat(r.kind()).isEqualTo("CLARIFICATION");
    assertThat(r.message()).contains("pondeuses");
  }

  @Test
  void multipleLayersAmbiguous_asksWhichLot() {
    lenient().when(parameters.listForFarm(1L, "egg_timeslots")).thenReturn(SLOTS);
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
