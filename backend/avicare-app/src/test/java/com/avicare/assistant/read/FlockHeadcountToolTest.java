package com.avicare.assistant.read;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.avicare.livestock.api.LivestockFacade;
import com.avicare.livestock.api.dto.ProductionUnitInfo;
import com.avicare.livestock.domain.Species;
import com.avicare.livestock.domain.UnitKind;
import com.avicare.livestock.domain.UnitStatus;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class FlockHeadcountToolTest {

  @Mock private LivestockFacade livestock;

  private FlockHeadcountTool tool() {
    return new FlockHeadcountTool(livestock);
  }

  private static ProductionUnitInfo unit(long id, String name, int count, UnitStatus status) {
    return new ProductionUnitInfo(id, 1L, Species.POULTRY, UnitKind.BATCH, 5L, name, count, status);
  }

  @Test
  void sumsActiveLots_withPerLotBreakdown() {
    when(livestock.listFarmUnits(1L))
        .thenReturn(
            List.of(
                unit(1L, "B-12", 480, UnitStatus.ACTIVE),
                unit(2L, "Pondeuses A", 900, UnitStatus.ACTIVE),
                unit(3L, "B-09", 200, UnitStatus.CLOSED)));

    String r = tool().read(1L, Map.of(), null);

    assertThat(r).contains("B-12").contains("480").contains("Pondeuses A").contains("1380");
    assertThat(r).doesNotContain("B-09"); // closed lot excluded
  }

  @Test
  void noActiveLot_saysSo() {
    when(livestock.listFarmUnits(1L)).thenReturn(List.of(unit(3L, "B-09", 200, UnitStatus.CLOSED)));

    String r = tool().read(1L, Map.of(), null);

    assertThat(r).contains("Aucun lot actif");
  }
}
