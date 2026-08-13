package com.avicare.assistant.read;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.livestock.commercial.CommercialFacade;
import com.avicare.livestock.commercial.dto.CommercialStats;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class SalesSummaryToolTest {

  @Mock private CommercialFacade commercial;

  private SalesSummaryTool tool() {
    return new SalesSummaryTool(commercial);
  }

  private static CommercialStats withRevenue(long revenue) {
    return new CommercialStats(revenue, List.of(), 0, 0, List.of(), List.of(), 0, 0);
  }

  @Test
  void defaultsTo30Days_andReportsRevenue() {
    when(commercial.commercialStats(eq(1L), any(), any())).thenReturn(withRevenue(750_000));

    String r = tool().read(1L, Map.of(), null);

    assertThat(r).contains("750000").contains("30");
  }

  @Test
  void honoursAnExplicitWindow() {
    when(commercial.commercialStats(eq(1L), any(), any())).thenReturn(withRevenue(120_000));

    String r = tool().read(1L, Map.of("days", 7), null);

    assertThat(r).contains("120000").contains("7");
    ArgumentCaptor<LocalDate> from = ArgumentCaptor.forClass(LocalDate.class);
    ArgumentCaptor<LocalDate> to = ArgumentCaptor.forClass(LocalDate.class);
    verify(commercial).commercialStats(eq(1L), from.capture(), to.capture());
    assertThat(from.getValue()).isEqualTo(to.getValue().minusDays(6));
  }
}
