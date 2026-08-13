package com.avicare.assistant.tool;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

import com.avicare.assistant.dto.InterpretResponse;
import com.avicare.livestock.commercial.ClientLite;
import com.avicare.livestock.commercial.CommercialFacade;
import com.avicare.livestock.commercial.OpenInvoiceInfo;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class RecordPaymentToolTest {

  @Mock private CommercialFacade commercial;

  private RecordPaymentTool tool() {
    return new RecordPaymentTool(commercial);
  }

  @Test
  void paymentWithinOutstanding_targetsOldestInvoice() {
    when(commercial.listClients(1L))
        .thenReturn(List.of(new ClientLite(5L, "Mamadou Diallo", 80_000L)));
    when(commercial.oldestOpenInvoiceForClient(1L, 5L))
        .thenReturn(Optional.of(new OpenInvoiceInfo(42L, "FAC-2026-042", 50_000L)));

    InterpretResponse r =
        tool()
            .dryRun(
                1L, Map.of("clientName", "diallo", "amountXof", 30_000, "method", "wave"), null);

    assertThat(r.kind()).isEqualTo("DRAFT");
    assertThat(r.action()).isEqualTo("RECORD_PAYMENT");
    assertThat(r.fields())
        .containsEntry("clientId", 5L)
        .containsEntry("invoiceId", 42L)
        .containsEntry("invoiceNumber", "FAC-2026-042")
        .containsEntry("amountXof", 30_000L)
        .containsEntry("outstandingBefore", 50_000L)
        .containsEntry("outstandingAfter", 20_000L)
        .containsEntry("method", "MOBILE_MONEY");
    assertThat(r.summary()).contains("30000").contains("Mamadou Diallo").contains("FAC-2026-042");
  }

  @Test
  void overpayment_isCappedToTheInvoiceDue() {
    when(commercial.listClients(1L)).thenReturn(List.of(new ClientLite(5L, "Fatou Sow", 12_000L)));
    when(commercial.oldestOpenInvoiceForClient(1L, 5L))
        .thenReturn(Optional.of(new OpenInvoiceInfo(9L, "FAC-2026-009", 12_000L)));

    InterpretResponse r =
        tool().dryRun(1L, Map.of("clientName", "Fatou Sow", "amountXof", 50_000), null);

    assertThat(r.kind()).isEqualTo("DRAFT");
    assertThat(r.fields())
        .containsEntry("amountXof", 12_000L)
        .containsEntry("outstandingAfter", 0L);
    assertThat(r.summary()).contains("plafonné");
  }

  @Test
  void unknownClient_asksWhichClient() {
    when(commercial.listClients(1L))
        .thenReturn(List.of(new ClientLite(5L, "Mamadou Diallo", 80_000L)));

    InterpretResponse r =
        tool().dryRun(1L, Map.of("clientName", "Ousmane", "amountXof", 10_000), null);

    assertThat(r.kind()).isEqualTo("CLARIFICATION");
    assertThat(r.message()).contains("Mamadou Diallo");
  }

  @Test
  void clientWithNoOpenInvoice_saysNothingDue() {
    when(commercial.listClients(1L)).thenReturn(List.of(new ClientLite(5L, "Awa Ba", 0L)));
    when(commercial.oldestOpenInvoiceForClient(1L, 5L)).thenReturn(Optional.empty());

    InterpretResponse r =
        tool().dryRun(1L, Map.of("clientName", "Awa Ba", "amountXof", 10_000), null);

    assertThat(r.kind()).isEqualTo("CLARIFICATION");
    assertThat(r.message()).contains("aucune facture");
  }

  @Test
  void noAmount_asksHowMuch() {
    lenient()
        .when(commercial.listClients(1L))
        .thenReturn(List.of(new ClientLite(5L, "Awa Ba", 0L)));

    InterpretResponse r = tool().dryRun(1L, Map.of("clientName", "Awa Ba", "amountXof", 0), null);

    assertThat(r.kind()).isEqualTo("CLARIFICATION");
    assertThat(r.message()).contains("montant");
  }
}
