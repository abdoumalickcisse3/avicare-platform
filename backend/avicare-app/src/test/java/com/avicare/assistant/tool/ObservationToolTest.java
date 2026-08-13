package com.avicare.assistant.tool;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.avicare.assistant.dto.InterpretResponse;
import com.avicare.livestock.api.LivestockFacade;
import com.avicare.livestock.domain.UnitStatus;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ObservationToolTest {

  @Mock private LivestockFacade livestock;

  private ObservationTool tool() {
    return new ObservationTool(new LivestockUnits(livestock));
  }

  @Test
  void buildsDraftWithMappedSeverity() {
    when(livestock.listFarmUnits(1L))
        .thenReturn(List.of(MortalityToolTest.unit(3L, "B-12", 500, UnitStatus.ACTIVE)));

    InterpretResponse r =
        tool().dryRun(1L, Map.of("observation", "les poules toussent", "severity", "critique"), 3L);

    assertThat(r.kind()).isEqualTo("DRAFT");
    assertThat(r.action()).isEqualTo("HEALTH_OBSERVATION");
    assertThat(r.fields())
        .containsEntry("unitId", 3L)
        .containsEntry("title", "les poules toussent")
        .containsEntry("severity", "CRITICAL")
        .containsEntry("observationDate", LocalDate.now().toString());
    assertThat(r.summary()).contains("B-12").contains("toussent");
  }

  @Test
  void severityOptional_omittedWhenNotSaid() {
    when(livestock.listFarmUnits(1L))
        .thenReturn(List.of(MortalityToolTest.unit(3L, "B-12", 500, UnitStatus.ACTIVE)));

    InterpretResponse r = tool().dryRun(1L, Map.of("observation", "quelques boiteries"), 3L);

    assertThat(r.kind()).isEqualTo("DRAFT");
    assertThat(r.fields()).doesNotContainKey("severity");
  }

  @Test
  void nothingSaid_asksWhatToReport() {
    InterpretResponse r = tool().dryRun(1L, Map.of(), 3L);

    assertThat(r.kind()).isEqualTo("CLARIFICATION");
    assertThat(r.message()).contains("signaler");
  }
}
