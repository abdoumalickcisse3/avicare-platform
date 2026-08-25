package com.avicare.partner.service;

import com.avicare.livestock.api.LivestockFacade;
import com.avicare.livestock.api.dto.BatchCycleInfo;
import com.avicare.partner.api.PartnerFacade;
import com.avicare.partner.dto.response.RestockForecastResponse;
import com.avicare.partner.dto.response.RestockForecastRow;
import com.avicare.partner.dto.response.RestockForecastSummary;
import com.avicare.tenancy.api.TenancyFacade;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Read model of the partner « Développer » layer: when each member farm's batches end, and how much
 * feed is still to be delivered before then.
 *
 * <p><b>Trust boundary.</b> Only farms sharing the {@code restock_forecast} scope are read at all.
 * That scope is a sixth slider, off by default and distinct from {@code feed_consumption}: the
 * others let a partner observe a state, this one hands it a commercially actionable prediction
 * about a named farm. A farm that has not opted in is not read, not counted, and not listed.
 */
@Service
@RequiredArgsConstructor
public class PartnerRestockForecastService {

  private static final String RESTOCK_SCOPE = "restock_forecast";
  private static final int FEED_WINDOW_DAYS = 30;

  private final PartnerFacade partnerFacade;
  private final TenancyFacade tenancyFacade;
  private final LivestockFacade livestockFacade;

  @Transactional(readOnly = true)
  public RestockForecastResponse forecast(Long partnerId, int horizonDays) {
    LocalDate today = LocalDate.now();
    List<RestockForecastRow> rows = new ArrayList<>();

    for (Long farmId : partnerFacade.farmIdsInNetwork(partnerId)) {
      if (!partnerFacade.sharedScopes(partnerId, farmId).contains(RESTOCK_SCOPE)) {
        continue;
      }
      rows.addAll(rowsFor(farmId, today));
    }

    rows.sort(Comparator.comparing(RestockForecastRow::expectedEndDate));

    List<RestockForecastRow> withinHorizon =
        rows.stream().filter(r -> r.daysToEnd() <= horizonDays).toList();
    long horizonFeed =
        withinHorizon.stream()
            .filter(r -> r.estimatedFeedKg() != null)
            .mapToLong(RestockForecastRow::estimatedFeedKg)
            .sum();

    return new RestockForecastResponse(
        new RestockForecastSummary(horizonDays, withinHorizon.size(), horizonFeed), rows);
  }

  private List<RestockForecastRow> rowsFor(Long farmId, LocalDate today) {
    List<BatchCycleInfo> cycles = livestockFacade.activeBatchCycles(farmId);
    if (cycles.isEmpty()) {
      return List.of();
    }
    String farmName = tenancyFacade.findById(farmId).name();
    Double dailyFeedKg =
        livestockFacade
            .livestockStats(farmId, today.minusDays(FEED_WINDOW_DAYS), today)
            .dailyFeedKg();

    return cycles.stream()
        .map(
            c -> {
              // A batch already past its forecast date needs no more feed, but stays listed: it is
              // precisely the one about to restock.
              long daysToEnd = Math.max(ChronoUnit.DAYS.between(today, c.expectedEndDate()), 0);
              Long estimatedFeedKg =
                  dailyFeedKg == null ? null : Math.round(dailyFeedKg * daysToEnd);
              return new RestockForecastRow(
                  farmId,
                  farmName,
                  c.unitId(),
                  c.name(),
                  c.headcount(),
                  c.expectedEndDate(),
                  daysToEnd,
                  estimatedFeedKg,
                  c.forecastMethod());
            })
        .toList();
  }
}
