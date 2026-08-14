package com.avicare.assistant.tool;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

import com.avicare.assistant.dto.InterpretResponse;
import com.avicare.livestock.api.InventoryFacade;
import com.avicare.livestock.api.dto.InventoryStockInfo;
import com.avicare.livestock.api.dto.SupplierInfo;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PurchaseToolTest {

  @Mock private InventoryFacade inventory;

  private PurchaseTool tool() {
    return new PurchaseTool(inventory);
  }

  @Test
  void purchaseWithPriceAndSupplier_buildsDraftWithStockConsequence() {
    when(inventory.listStock(1L))
        .thenReturn(
            List.of(new InventoryStockInfo(11L, "aliment_croissance", "INVENTORY", "sac", 12)));
    when(inventory.listSuppliers(1L))
        .thenReturn(List.of(new SupplierInfo(3L, "Aliments du Sahel")));

    InterpretResponse r =
        tool()
            .dryRun(
                1L,
                Map.of(
                    "article",
                    "aliment",
                    "quantity",
                    10,
                    "unitPriceXof",
                    15000,
                    "supplierName",
                    "sahel"),
                null);

    assertThat(r.kind()).isEqualTo("DRAFT");
    assertThat(r.action()).isEqualTo("PURCHASE");
    assertThat(r.fields())
        .containsEntry("articleKey", "aliment_croissance")
        .containsEntry("articleSource", "INVENTORY")
        .containsEntry("quantity", 10)
        .containsEntry("supplierId", 3L)
        .containsEntry("supplierName", "Aliments du Sahel")
        .containsEntry("before", 12L)
        .containsEntry("after", 22L)
        .containsEntry("unitPriceXof", 15000)
        .containsEntry("lineTotalXof", 150000L);
    assertThat(r.summary()).contains("Aliments du Sahel").contains("12").contains("22");
  }

  @Test
  void singleSupplierNotNamed_isUsedByDefault() {
    when(inventory.listStock(1L))
        .thenReturn(List.of(new InventoryStockInfo(13L, "mais", "INVENTORY", "kg", 40)));
    when(inventory.listSuppliers(1L)).thenReturn(List.of(new SupplierInfo(3L, "Grainterie Diop")));

    InterpretResponse r = tool().dryRun(1L, Map.of("article", "mais", "quantity", 50), null);

    assertThat(r.kind()).isEqualTo("DRAFT");
    assertThat(r.fields()).containsEntry("supplierId", 3L).doesNotContainKey("unitPriceXof");
  }

  @Test
  void severalSuppliersNoneNamed_asksWhichSupplier() {
    when(inventory.listStock(1L))
        .thenReturn(List.of(new InventoryStockInfo(13L, "mais", "INVENTORY", "kg", 40)));
    when(inventory.listSuppliers(1L))
        .thenReturn(List.of(new SupplierInfo(3L, "Diop"), new SupplierInfo(4L, "Ndiaye")));

    InterpretResponse r = tool().dryRun(1L, Map.of("article", "mais", "quantity", 50), null);

    assertThat(r.kind()).isEqualTo("CLARIFICATION");
    assertThat(r.message()).contains("fournisseur").contains("Diop").contains("Ndiaye");
  }

  @Test
  void noSupplierRegistered_asksToAddOne() {
    when(inventory.listStock(1L))
        .thenReturn(List.of(new InventoryStockInfo(13L, "mais", "INVENTORY", "kg", 40)));
    when(inventory.listSuppliers(1L)).thenReturn(List.of());

    InterpretResponse r = tool().dryRun(1L, Map.of("article", "mais", "quantity", 50), null);

    assertThat(r.kind()).isEqualTo("CLARIFICATION");
    assertThat(r.message()).contains("fournisseur");
  }

  @Test
  void unknownArticle_asksWhichOne() {
    lenient().when(inventory.listSuppliers(1L)).thenReturn(List.of(new SupplierInfo(3L, "Diop")));
    when(inventory.listStock(1L))
        .thenReturn(List.of(new InventoryStockInfo(13L, "mais", "INVENTORY", "kg", 40)));

    InterpretResponse r = tool().dryRun(1L, Map.of("article", "ciment", "quantity", 5), null);

    assertThat(r.kind()).isEqualTo("CLARIFICATION");
    assertThat(r.message()).contains("mais");
  }
}
