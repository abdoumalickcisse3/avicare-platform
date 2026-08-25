package com.avicare.partner.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.livestock.api.LivestockFacade;
import com.avicare.livestock.api.dto.BatchCycleInfo;
import com.avicare.livestock.api.dto.LivestockStats;
import com.avicare.partner.api.PartnerFacade;
import com.avicare.partner.dto.response.RestockForecastResponse;
import com.avicare.tenancy.api.TenancyFacade;
import com.avicare.tenancy.api.dto.FarmInfo;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PartnerRestockForecastServiceTest {

  private static final Long PARTNER_ID = 1L;
  private static final Long FARM_ID = 10L;

  @Mock PartnerFacade partnerFacade;
  @Mock TenancyFacade tenancyFacade;
  @Mock LivestockFacade livestockFacade;

  private PartnerRestockForecastService service() {
    return new PartnerRestockForecastService(partnerFacade, tenancyFacade, livestockFacade);
  }

  private LivestockStats stats(Double dailyFeedKg) {
    return new LivestockStats(0, 0, 0, null, List.of(), null, null, List.of(), 0, 0, dailyFeedKg);
  }

  private BatchCycleInfo cycle(Long unitId, int daysAhead) {
    return new BatchCycleInfo(
        unitId,
        "Bande " + unitId,
        480,
        LocalDate.now().minusDays(20),
        LocalDate.now().plusDays(daysAhead),
        BatchCycleInfo.METHOD_GROWTH);
  }

  /** One farm in the network, sharing the given scopes. */
  private void network(Set<String> scopes) {
    when(partnerFacade.farmIdsInNetwork(PARTNER_ID)).thenReturn(List.of(FARM_ID));
    when(partnerFacade.sharedScopes(PARTNER_ID, FARM_ID)).thenReturn(scopes);
  }

  private void farmWith(List<BatchCycleInfo> cycles, Double dailyFeedKg) {
    when(livestockFacade.activeBatchCycles(FARM_ID)).thenReturn(cycles);
    if (!cycles.isEmpty()) {
      when(tenancyFacade.findById(FARM_ID))
          .thenReturn(new FarmInfo(FARM_ID, "Ferme A", "XOF", "Africa/Dakar", true));
      when(livestockFacade.livestockStats(anyLong(), any(), any())).thenReturn(stats(dailyFeedKg));
    }
  }

  @Test
  void estimatesTheFeedLeftToDeliverBeforeTheEndOfTheCycle() {
    network(Set.of("restock_forecast"));
    farmWith(List.of(cycle(7L, 12)), 60.0);

    RestockForecastResponse out = service().forecast(PARTNER_ID, 30);

    assertThat(out.rows()).hasSize(1);
    assertThat(out.rows().get(0).daysToEnd()).isEqualTo(12);
    assertThat(out.rows().get(0).estimatedFeedKg()).isEqualTo(720); // 60 kg/day × 12 days
    assertThat(out.rows().get(0).farmName()).isEqualTo("Ferme A");
    assertThat(out.summary().batchCount()).isEqualTo(1);
    assertThat(out.summary().estimatedFeedKg()).isEqualTo(720);
  }

  @Test
  void readsNothingAboutAFarmThatDidNotOptIn() {
    // The trust boundary. Sharing feed consumption is NOT consenting to a restock forecast:
    // the first lets a partner observe, the second hands it a prospection calendar.
    network(Set.of("activity", "feed_consumption", "flock_health"));

    RestockForecastResponse out = service().forecast(PARTNER_ID, 30);

    assertThat(out.rows()).isEmpty();
    assertThat(out.summary().batchCount()).isZero();
    verify(livestockFacade, never()).activeBatchCycles(anyLong());
  }

  @Test
  void keepsTheDateWhenTheFeedRateIsUnknown() {
    network(Set.of("restock_forecast"));
    farmWith(List.of(cycle(7L, 5)), null); // no daily records to extrapolate from

    RestockForecastResponse out = service().forecast(PARTNER_ID, 30);

    assertThat(out.rows().get(0).estimatedFeedKg()).isNull();
    assertThat(out.rows().get(0).expectedEndDate()).isEqualTo(LocalDate.now().plusDays(5));
    // A null tonnage must not be summed as zero-with-a-batch-counted... the batch still counts.
    assertThat(out.summary().batchCount()).isEqualTo(1);
    assertThat(out.summary().estimatedFeedKg()).isZero();
  }

  @Test
  void summaryCountsOnlyTheRequestedHorizonWhileRowsKeepEverything() {
    network(Set.of("restock_forecast"));
    farmWith(List.of(cycle(7L, 10), cycle(8L, 45)), 50.0);

    RestockForecastResponse out = service().forecast(PARTNER_ID, 30);

    // Both batches are listed, sorted soonest first…
    assertThat(out.rows()).extracting("unitId").containsExactly(7L, 8L);
    // …but only the one inside the horizon feeds the head figures.
    assertThat(out.summary().batchCount()).isEqualTo(1);
    assertThat(out.summary().estimatedFeedKg()).isEqualTo(500); // 50 × 10
  }

  @Test
  void clampsABatchAlreadyPastItsForecastDate() {
    network(Set.of("restock_forecast"));
    farmWith(List.of(cycle(7L, -3)), 50.0);

    RestockForecastResponse out = service().forecast(PARTNER_ID, 30);

    // Overdue for slaughter: no feed left to deliver, but it is exactly the batch about to restock.
    assertThat(out.rows()).hasSize(1);
    assertThat(out.rows().get(0).daysToEnd()).isZero();
    assertThat(out.rows().get(0).estimatedFeedKg()).isZero();
  }

  @Test
  void skipsAFarmWithNoActiveBatch() {
    network(Set.of("restock_forecast"));
    farmWith(List.of(), null);

    assertThat(service().forecast(PARTNER_ID, 30).rows()).isEmpty();
    verify(tenancyFacade, never()).findById(anyLong());
  }
}
