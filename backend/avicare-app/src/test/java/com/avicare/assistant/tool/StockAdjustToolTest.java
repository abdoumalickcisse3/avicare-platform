package com.avicare.assistant.tool;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.avicare.assistant.dto.InterpretResponse;
import com.avicare.livestock.api.InventoryFacade;
import com.avicare.livestock.api.dto.InventoryStockInfo;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class StockAdjustToolTest {

  @Mock private InventoryFacade inventory;

  private StockAdjustTool tool() {
    return new StockAdjustTool(inventory);
  }

  @Test
  void addToKnownArticle_showsBeforeAndAfter() {
    when(inventory.listStock(1L))
        .thenReturn(List.of(new InventoryStockInfo("mais_concasse", "kg", 40)));

    InterpretResponse r = tool().dryRun(1L, Map.of("article", "maïs", "delta", 25), null);

    assertThat(r.kind()).isEqualTo("DRAFT");
    assertThat(r.action()).isEqualTo("ADJUST_STOCK");
    assertThat(r.fields())
        .containsEntry("articleKey", "mais_concasse")
        .containsEntry("before", 40L)
        .containsEntry("after", 65L)
        .containsEntry("delta", 25);
    assertThat(r.summary()).contains("40").contains("65");
  }

  @Test
  void removeBelowZero_isRefused() {
    when(inventory.listStock(1L)).thenReturn(List.of(new InventoryStockInfo("mais", "kg", 10)));

    InterpretResponse r = tool().dryRun(1L, Map.of("article", "mais", "delta", -25), null);

    assertThat(r.kind()).isEqualTo("CLARIFICATION");
    assertThat(r.message()).contains("10");
  }

  @Test
  void unknownArticle_asksWhichOne() {
    when(inventory.listStock(1L)).thenReturn(List.of(new InventoryStockInfo("mais", "kg", 10)));

    InterpretResponse r = tool().dryRun(1L, Map.of("article", "ciment", "delta", 5), null);

    assertThat(r.kind()).isEqualTo("CLARIFICATION");
    assertThat(r.message()).contains("mais");
  }
}
