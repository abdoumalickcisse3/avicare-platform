package com.avicare.assistant.read;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import com.avicare.common.api.dto.NamedValue;
import com.avicare.livestock.commercial.ClientLite;
import com.avicare.livestock.commercial.CommercialFacade;
import com.avicare.livestock.commercial.dto.CommercialStats;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ClientOutstandingToolTest {

  @Mock private CommercialFacade commercial;

  private ClientOutstandingTool tool() {
    return new ClientOutstandingTool(commercial);
  }

  @Test
  void namedClientWhoOwes_reportsTheBalance() {
    when(commercial.listClients(1L))
        .thenReturn(List.of(new ClientLite(5L, "Mamadou Diallo", 80_000)));

    String r = tool().read(1L, Map.of("clientName", "diallo"), null);

    assertThat(r).contains("Mamadou Diallo").contains("80000").contains("doit");
  }

  @Test
  void namedClientInAdvance_reportsTheAdvance() {
    when(commercial.listClients(1L)).thenReturn(List.of(new ClientLite(5L, "Fatou Sow", -15_000)));

    String r = tool().read(1L, Map.of("clientName", "Fatou"), null);

    assertThat(r).contains("Fatou Sow").contains("15000").contains("avance");
  }

  @Test
  void unknownClient_saysSo() {
    when(commercial.listClients(1L))
        .thenReturn(List.of(new ClientLite(5L, "Mamadou Diallo", 80_000)));

    String r = tool().read(1L, Map.of("clientName", "Ousmane"), null);

    assertThat(r).contains("introuvable");
  }

  @Test
  void noClientNamed_reportsTotalAndTopDebtors() {
    CommercialStats stats =
        new CommercialStats(
            0,
            List.of(),
            250_000,
            0,
            List.of(),
            List.of(new NamedValue(5L, "Diallo", 80_000), new NamedValue(6L, "Sow", 50_000)),
            0,
            0);
    when(commercial.commercialStats(eq(1L), any(), any())).thenReturn(stats);

    String r = tool().read(1L, Map.of(), null);

    assertThat(r).contains("250000").contains("Diallo").contains("Sow");
  }
}
