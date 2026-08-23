package com.avicare.partner.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import com.avicare.common.api.exception.NotFoundException;
import com.avicare.livestock.api.LivestockFacade;
import com.avicare.livestock.api.dto.LivestockStats;
import com.avicare.partner.api.PartnerFacade;
import com.avicare.tenancy.api.TenancyFacade;
import com.avicare.tenancy.api.dto.FarmInfo;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PartnerNetworkReadServiceTest {

  @Mock PartnerFacade partnerFacade;
  @Mock PartnerService partnerService;
  @Mock TenancyFacade tenancyFacade;
  @Mock LivestockFacade livestockFacade;

  PartnerNetworkReadService service() {
    return new PartnerNetworkReadService(
        partnerFacade, partnerService, tenancyFacade, livestockFacade);
  }

  private LivestockStats stats(Double dailyFeedKg, Double mortalityRate) {
    return new LivestockStats(
        0, 0, 0, mortalityRate, List.of(), null, null, List.of(), 0, 0, dailyFeedKg);
  }

  private FarmInfo farm(long id, String name) {
    return new FarmInfo(id, name, "XOF", "Africa/Dakar", true);
  }

  @Test
  void dashboardCountsOnlyFarmsSharingEachScope() {
    when(partnerFacade.farmIdsInNetwork(1L)).thenReturn(List.of(10L, 11L));
    when(partnerFacade.sharedScopes(1L, 10L))
        .thenReturn(Set.of("activity", "feed_consumption", "flock_health"));
    when(partnerFacade.sharedScopes(1L, 11L)).thenReturn(Set.of("activity"));
    when(tenancyFacade.findById(10L)).thenReturn(farm(10L, "Ferme A"));
    when(tenancyFacade.findById(11L)).thenReturn(farm(11L, "Ferme B"));
    when(livestockFacade.countActiveUnits(any())).thenReturn(2L);
    when(livestockFacade.livestockStats(eq(10L), any(), any())).thenReturn(stats(500.0, 3.0));

    var dash = service().dashboard(1L);

    assertThat(dash.farmCount()).isEqualTo(2);
    assertThat(dash.activeFarmCount()).isEqualTo(2);
    assertThat(dash.totalFeedKg()).isEqualTo(500L); // farm 11 excluded (no feed scope)
    assertThat(dash.avgMortalityRate()).isEqualTo(3.0); // only farm 10 counted
  }

  @Test
  void farmRowMasksUnsharedMetrics() {
    when(partnerFacade.farmIdsInNetwork(1L)).thenReturn(List.of(10L));
    when(partnerFacade.sharedScopes(1L, 10L)).thenReturn(Set.of("activity")); // no feed/health
    when(tenancyFacade.findById(10L)).thenReturn(farm(10L, "Ferme A"));
    when(livestockFacade.countActiveUnits(10L)).thenReturn(1L);

    var rows = service().farms(1L);

    assertThat(rows).hasSize(1);
    assertThat(rows.get(0).farmName()).isEqualTo("Ferme A");
    assertThat(rows.get(0).active()).isTrue();
    assertThat(rows.get(0).feedKg()).isNull();
    assertThat(rows.get(0).mortalityRate()).isNull();
  }

  @Test
  void farmDetailIsNotFoundForFarmOutsideNetwork() {
    when(partnerFacade.farmIdsInNetwork(1L)).thenReturn(List.of(10L));
    assertThatThrownBy(() -> service().farm(1L, 999L)).isInstanceOf(NotFoundException.class);
  }
}
