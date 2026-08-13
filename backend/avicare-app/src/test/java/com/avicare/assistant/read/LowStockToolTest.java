package com.avicare.assistant.read;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.avicare.livestock.api.InventoryFacade;
import com.avicare.livestock.api.dto.LowStockInfo;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class LowStockToolTest {

  @Mock private InventoryFacade inventory;

  private LowStockTool tool() {
    return new LowStockTool(inventory);
  }

  @Test
  void listsArticlesBelowThreshold() {
    when(inventory.lowStock(1L))
        .thenReturn(
            List.of(
                new LowStockInfo("aliment_croissance", "Aliment croissance", 5, 10, "sac"),
                new LowStockInfo("vaccin_nc", "Vaccin Newcastle", 2, 5, "flacon")));

    String r = tool().read(1L, Map.of(), null);

    assertThat(r).contains("Aliment croissance").contains("5").contains("seuil 10");
    assertThat(r).contains("Vaccin Newcastle");
  }

  @Test
  void nothingLow_saysSo() {
    when(inventory.lowStock(1L)).thenReturn(List.of());

    String r = tool().read(1L, Map.of(), null);

    assertThat(r).contains("Aucun article sous le seuil");
  }
}
