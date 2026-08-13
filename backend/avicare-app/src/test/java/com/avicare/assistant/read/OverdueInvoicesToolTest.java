package com.avicare.assistant.read;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import com.avicare.livestock.commercial.CommercialFacade;
import com.avicare.livestock.commercial.dto.CommercialStats;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class OverdueInvoicesToolTest {

  @Mock private CommercialFacade commercial;

  private OverdueInvoicesTool tool() {
    return new OverdueInvoicesTool(commercial);
  }

  private static CommercialStats stats(long overdue, long toCollect) {
    return new CommercialStats(0, List.of(), 0, overdue, List.of(), List.of(), 0, toCollect);
  }

  @Test
  void reportsOverdueAmountAndCount() {
    when(commercial.commercialStats(eq(1L), any(), any())).thenReturn(stats(150_000, 4));

    String r = tool().read(1L, Map.of(), null);

    assertThat(r).contains("150000").contains("4");
  }

  @Test
  void nothingDue_saysSo() {
    when(commercial.commercialStats(eq(1L), any(), any())).thenReturn(stats(0, 0));

    String r = tool().read(1L, Map.of(), null);

    assertThat(r).contains("Aucune facture");
  }
}
