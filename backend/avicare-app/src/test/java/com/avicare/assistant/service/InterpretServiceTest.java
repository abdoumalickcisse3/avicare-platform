package com.avicare.assistant.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.avicare.assistant.llm.LlmClient;
import com.avicare.assistant.llm.ToolCall;
import com.avicare.livestock.api.LivestockFacade;
import com.avicare.livestock.api.dto.ProductionUnitInfo;
import com.avicare.livestock.domain.Species;
import com.avicare.livestock.domain.UnitKind;
import com.avicare.livestock.domain.UnitStatus;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class InterpretServiceTest {

  @Mock private LlmClient llm;
  @Mock private LivestockFacade livestock;
  @InjectMocks private InterpretService service;

  private static ProductionUnitInfo unit(long id, String name, int count, UnitStatus status) {
    return new ProductionUnitInfo(id, 1L, Species.POULTRY, UnitKind.BATCH, 5L, name, count, status);
  }

  @Test
  void mortality_withKnownUnit_producesDraftWithCountAfter() {
    when(llm.interpret(any(), any()))
        .thenReturn(Optional.of(new ToolCall("MORTALITY", Map.of("count", 10))));
    when(livestock.listFarmUnits(1L)).thenReturn(List.of(unit(3L, "B-12", 480, UnitStatus.ACTIVE)));

    var r = service.interpret(1L, "dix sont morts", 3L);

    assertThat(r.kind()).isEqualTo("DRAFT");
    assertThat(r.action()).isEqualTo("MORTALITY");
    assertThat(r.unitId()).isEqualTo(3L);
    assertThat(r.fields()).containsEntry("count", 10).containsEntry("countAfter", 470);
    assertThat(r.summary()).contains("B-12").contains("470");
  }

  @Test
  void unrecognized_producesClarification() {
    when(llm.interpret(any(), any())).thenReturn(Optional.empty());

    var r = service.interpret(1L, "bonjour", null);

    assertThat(r.kind()).isEqualTo("CLARIFICATION");
    assertThat(r.message()).isNotBlank();
  }

  @Test
  void ambiguousLot_asksWhichLot() {
    when(llm.interpret(any(), any()))
        .thenReturn(Optional.of(new ToolCall("MORTALITY", Map.of("count", 5))));
    when(livestock.listFarmUnits(1L))
        .thenReturn(
            List.of(
                unit(3L, "B-12", 480, UnitStatus.ACTIVE),
                unit(4L, "B-13", 300, UnitStatus.ACTIVE)));

    var r = service.interpret(1L, "5 morts", null);

    assertThat(r.kind()).isEqualTo("CLARIFICATION");
    assertThat(r.message()).contains("lot");
  }

  @Test
  void singleActiveLot_isChosenByDefault() {
    when(llm.interpret(any(), any()))
        .thenReturn(Optional.of(new ToolCall("MORTALITY", Map.of("count", 4))));
    when(livestock.listFarmUnits(1L))
        .thenReturn(
            List.of(
                unit(3L, "B-12", 480, UnitStatus.ACTIVE), unit(9L, "old", 0, UnitStatus.CLOSED)));

    var r = service.interpret(1L, "4 morts", null);

    assertThat(r.kind()).isEqualTo("DRAFT");
    assertThat(r.unitId()).isEqualTo(3L);
  }
}
