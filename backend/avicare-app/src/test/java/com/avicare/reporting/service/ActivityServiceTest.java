package com.avicare.reporting.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.avicare.common.api.dto.ActivityItem;
import com.avicare.livestock.api.LivestockFacade;
import com.avicare.livestock.commercial.CommercialFacade;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class ActivityServiceTest {

  private LivestockFacade livestockFacade;
  private CommercialFacade commercialFacade;
  private ActivityService service;

  @BeforeEach
  void setUp() {
    livestockFacade = Mockito.mock(LivestockFacade.class);
    commercialFacade = Mockito.mock(CommercialFacade.class);
    service = new ActivityService(livestockFacade, commercialFacade);
  }

  @Test
  void mergesSortsDescAndCaps() {
    LocalDateTime t1 = LocalDateTime.of(2026, 7, 1, 8, 0);
    LocalDateTime t2 = LocalDateTime.of(2026, 7, 3, 8, 0);
    LocalDateTime t3 = LocalDateTime.of(2026, 7, 2, 8, 0);
    when(livestockFacade.recentActivity(3L, 2))
        .thenReturn(List.of(new ActivityItem("MORTALITY", t1, "Mortalité : 2 sujets", null)));
    when(commercialFacade.recentActivity(3L, 2))
        .thenReturn(
            List.of(
                new ActivityItem("SALE", t2, "Vente 700000 XOF", null),
                new ActivityItem("PAYMENT", t3, "Paiement reçu 5000 XOF", null)));

    List<ActivityItem> items = service.recentActivity(3L, 2);

    assertThat(items).hasSize(2);
    assertThat(items).extracting(ActivityItem::at).containsExactly(t2, t3); // desc, capped at 2
  }
}
