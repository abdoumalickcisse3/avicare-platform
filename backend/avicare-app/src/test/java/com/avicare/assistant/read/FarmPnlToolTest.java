package com.avicare.assistant.read;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.avicare.finance.api.FarmPnl;
import com.avicare.finance.api.FinanceFacade;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class FarmPnlToolTest {

  @Mock private FinanceFacade finance;

  private FarmPnlTool tool() {
    return new FarmPnlTool(finance);
  }

  @Test
  void reportsRevenueExpenseAndMargin() {
    when(finance.farmPnl(1L)).thenReturn(new FarmPnl(500_000, 300_000, 200_000));

    String r = tool().read(1L, Map.of(), null);

    assertThat(r).contains("500000").contains("300000").contains("200000");
  }
}
