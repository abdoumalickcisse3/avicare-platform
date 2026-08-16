package com.avicare.assistant.tool;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.avicare.assistant.dto.InterpretResponse;
import com.avicare.livestock.api.LivestockFacade;
import com.avicare.livestock.api.dto.PoultryBreedLite;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class CreateLotToolTest {

  @Mock private LivestockFacade livestock;

  private CreateLotTool tool() {
    return new CreateLotTool(livestock);
  }

  @Test
  void resolvesBreedByName_andDraftsTheLot() {
    when(livestock.listPoultryBreeds(1L))
        .thenReturn(List.of(new PoultryBreedLite(7L, "COBB500", "Cobb 500")));

    InterpretResponse r = tool().dryRun(1L, Map.of("breed", "cobb 500", "count", 500), null);

    assertThat(r.kind()).isEqualTo("DRAFT");
    assertThat(r.action()).isEqualTo("CREATE_LOT");
    assertThat(r.fields()).containsEntry("breedId", 7L).containsEntry("initialCount", 500);
    assertThat(r.summary()).contains("500").contains("Cobb 500");
    assertThat(r.risk()).isEqualTo("MEDIUM");
  }

  @Test
  void unknownBreed_clarifiesWithTheAvailableList() {
    when(livestock.listPoultryBreeds(1L))
        .thenReturn(List.of(new PoultryBreedLite(7L, "COBB500", "Cobb 500")));

    InterpretResponse r = tool().dryRun(1L, Map.of("breed", "canard", "count", 100), null);

    assertThat(r.kind()).isEqualTo("CLARIFICATION");
    assertThat(r.message()).contains("Cobb 500");
  }

  @Test
  void missingCount_clarifies() {
    InterpretResponse r = tool().dryRun(1L, Map.of("breed", "cobb"), null);

    assertThat(r.kind()).isEqualTo("CLARIFICATION");
    assertThat(r.message()).containsIgnoringCase("poussins");
  }

  @Test
  void emptyCatalogue_clarifies() {
    when(livestock.listPoultryBreeds(1L)).thenReturn(List.of());

    InterpretResponse r = tool().dryRun(1L, Map.of("breed", "cobb", "count", 500), null);

    assertThat(r.kind()).isEqualTo("CLARIFICATION");
    assertThat(r.message()).containsIgnoringCase("catalogue");
  }
}
