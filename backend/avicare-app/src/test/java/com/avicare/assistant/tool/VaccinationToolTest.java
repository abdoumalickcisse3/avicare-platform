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
class VaccinationToolTest {

  @Mock private LivestockFacade livestock;
  @Mock private ParametersFacade parameters;

  private static final List<CatalogEntryInfo> VACCINES =
      List.of(
          new CatalogEntryInfo(
              "vaccines",
              "newcastle",
              Map.of("label", "Newcastle", "disease", "Maladie de Newcastle"),
              false),
          new CatalogEntryInfo(
              "vaccines", "gumboro", Map.of("label", "Gumboro", "disease", "Gumboro"), false));

  private VaccinationTool tool() {
    return new VaccinationTool(new LivestockUnits(livestock), parameters);
  }

  @Test
  void resolvesVaccineFromAPhrase_defaultsCountToTheLot() {
    when(livestock.listFarmUnits(1L))
        .thenReturn(List.of(MortalityToolTest.unit(3L, "B-12", 500, UnitStatus.ACTIVE)));
    when(parameters.listForFarm(1L, "vaccines")).thenReturn(VACCINES);

    InterpretResponse r =
        tool().dryRun(1L, Map.of("vaccine", "j'ai vacciné contre le Newcastle"), 3L);

    assertThat(r.kind()).isEqualTo("DRAFT");
    assertThat(r.action()).isEqualTo("VACCINATION");
    assertThat(r.fields())
        .containsEntry("unitId", 3L)
        .containsEntry("vaccineKey", "newcastle")
        .containsEntry("subjectsCount", 500)
        .containsEntry("administeredDate", LocalDate.now().toString());
    assertThat(r.summary()).contains("Newcastle").contains("B-12");
  }

  @Test
  void explicitCount_overridesTheLotHeadcount() {
    when(livestock.listFarmUnits(1L))
        .thenReturn(List.of(MortalityToolTest.unit(3L, "B-12", 500, UnitStatus.ACTIVE)));
    when(parameters.listForFarm(1L, "vaccines")).thenReturn(VACCINES);

    InterpretResponse r = tool().dryRun(1L, Map.of("vaccine", "Gumboro", "subjectsCount", 120), 3L);

    assertThat(r.fields())
        .containsEntry("vaccineKey", "gumboro")
        .containsEntry("subjectsCount", 120);
  }

  @Test
  void unknownVaccine_asksWhichOne() {
    when(livestock.listFarmUnits(1L))
        .thenReturn(List.of(MortalityToolTest.unit(3L, "B-12", 500, UnitStatus.ACTIVE)));
    when(parameters.listForFarm(1L, "vaccines")).thenReturn(VACCINES);

    InterpretResponse r = tool().dryRun(1L, Map.of("vaccine", "Rage"), 3L);

    assertThat(r.kind()).isEqualTo("CLARIFICATION");
    assertThat(r.message()).contains("Newcastle");
  }

  @Test
  void noVaccineSaid_asksForIt() {
    lenient()
        .when(livestock.listFarmUnits(1L))
        .thenReturn(List.of(MortalityToolTest.unit(3L, "B-12", 500, UnitStatus.ACTIVE)));

    InterpretResponse r = tool().dryRun(1L, Map.of(), 3L);

    assertThat(r.kind()).isEqualTo("CLARIFICATION");
    assertThat(r.message()).contains("vaccin");
  }
}
