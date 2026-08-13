package com.avicare.assistant.tool;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

import com.avicare.assistant.dto.InterpretResponse;
import com.avicare.livestock.api.LivestockFacade;
import com.avicare.livestock.api.ProductType;
import com.avicare.livestock.domain.UnitStatus;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class QuickSaleToolTest {

  @Mock private LivestockFacade livestock;

  private QuickSaleTool tool() {
    return new QuickSaleTool(livestock, new LivestockUnits(livestock));
  }

  @Test
  void broilerSaleWithinStock_showsTheStockConsequence() {
    lenient()
        .when(livestock.listFarmUnits(1L))
        .thenReturn(List.of(MortalityToolTest.unit(3L, "B-12", 500, UnitStatus.ACTIVE)));
    when(livestock.productionAvailable(1L, ProductType.BROILER, 3L)).thenReturn(120L);

    InterpretResponse r =
        tool().dryRun(1L, Map.of("product", "broiler", "quantity", 30, "clientName", "Modou"), 3L);

    assertThat(r.kind()).isEqualTo("DRAFT");
    assertThat(r.action()).isEqualTo("QUICK_SALE");
    assertThat(r.fields())
        .containsEntry("productType", "BROILER")
        .containsEntry("availableBefore", 120L)
        .containsEntry("availableAfter", 90L)
        .containsEntry("clientName", "Modou");
    assertThat(r.summary()).contains("120").contains("90");
  }

  @Test
  void broilerSaleOverStock_refusesBeforeConfirmation() {
    lenient()
        .when(livestock.listFarmUnits(1L))
        .thenReturn(List.of(MortalityToolTest.unit(3L, "B-12", 500, UnitStatus.ACTIVE)));
    when(livestock.productionAvailable(1L, ProductType.BROILER, 3L)).thenReturn(20L);

    InterpretResponse r = tool().dryRun(1L, Map.of("product", "broiler", "quantity", 30), 3L);

    assertThat(r.kind()).isEqualTo("CLARIFICATION");
    assertThat(r.message()).contains("insuffisant").contains("20");
  }

  @Test
  void eggSale_usesTheFarmPool_withoutALot() {
    when(livestock.productionAvailable(1L, ProductType.EGGS, null)).thenReturn(300L);

    InterpretResponse r = tool().dryRun(1L, Map.of("product", "oeufs", "quantity", 50), null);

    assertThat(r.kind()).isEqualTo("DRAFT");
    assertThat(r.fields())
        .containsEntry("productType", "EGGS")
        .containsEntry("availableAfter", 250L);
    assertThat(r.fields()).doesNotContainKey("unitId");
  }
}
