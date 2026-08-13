package com.avicare.assistant.read;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.avicare.livestock.api.InventoryFacade;
import com.avicare.livestock.api.dto.InventoryStockInfo;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class StockQueryToolTest {

  @Mock private InventoryFacade inventory;

  private StockQueryTool tool() {
    return new StockQueryTool(inventory);
  }

  @Test
  void namedArticle_returnsItsQuantity() {
    when(inventory.listStock(1L))
        .thenReturn(
            List.of(
                new InventoryStockInfo("aliment_croissance", "INVENTORY", "sac", 40),
                new InventoryStockInfo("mais", "INVENTORY", "kg", 120)));

    String r = tool().read(1L, Map.of("article", "aliment"), null);

    assertThat(r).contains("aliment_croissance").contains("40").contains("sac");
  }

  @Test
  void noArticle_listsTheWholeStock() {
    when(inventory.listStock(1L))
        .thenReturn(
            List.of(
                new InventoryStockInfo("aliment_croissance", "INVENTORY", "sac", 40),
                new InventoryStockInfo("mais", "INVENTORY", "kg", 120)));

    String r = tool().read(1L, Map.of(), null);

    assertThat(r).contains("aliment_croissance").contains("mais").contains("120");
  }

  @Test
  void emptyStock_saysSo() {
    when(inventory.listStock(1L)).thenReturn(List.of());

    String r = tool().read(1L, Map.of("article", "aliment"), null);

    assertThat(r).contains("Aucun article");
  }
}
