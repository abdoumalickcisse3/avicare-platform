package com.avicare.assistant.tool;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

import com.avicare.assistant.dto.InterpretResponse;
import com.avicare.livestock.commercial.ClientLite;
import com.avicare.livestock.commercial.CommercialFacade;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class CreateClientToolTest {

  @Mock private CommercialFacade commercial;

  private CreateClientTool tool() {
    return new CreateClientTool(commercial);
  }

  @Test
  void newClientWithType_buildsDraft() {
    when(commercial.listClients(1L)).thenReturn(List.of());

    InterpretResponse r =
        tool().dryRun(1L, Map.of("name", "Boucherie Diop", "type", "entreprise"), null);

    assertThat(r.kind()).isEqualTo("DRAFT");
    assertThat(r.action()).isEqualTo("CREATE_CLIENT");
    assertThat(r.fields())
        .containsEntry("displayName", "Boucherie Diop")
        .containsEntry("clientType", "BUSINESS");
    assertThat(r.summary()).contains("Boucherie Diop").contains("entreprise");
  }

  @Test
  void defaultsToIndividual() {
    when(commercial.listClients(1L)).thenReturn(List.of());

    InterpretResponse r = tool().dryRun(1L, Map.of("name", "Modou"), null);

    assertThat(r.fields()).containsEntry("clientType", "INDIVIDUAL");
  }

  @Test
  void existingClient_isRefused() {
    when(commercial.listClients(1L)).thenReturn(List.of(new ClientLite(5L, "Modou Fall", 0)));

    InterpretResponse r = tool().dryRun(1L, Map.of("name", "modou fall"), null);

    assertThat(r.kind()).isEqualTo("CLARIFICATION");
    assertThat(r.message()).contains("existe déjà");
  }

  @Test
  void noName_asksForIt() {
    lenient().when(commercial.listClients(1L)).thenReturn(List.of());

    InterpretResponse r = tool().dryRun(1L, Map.of(), null);

    assertThat(r.kind()).isEqualTo("CLARIFICATION");
    assertThat(r.message()).contains("nom");
  }
}
