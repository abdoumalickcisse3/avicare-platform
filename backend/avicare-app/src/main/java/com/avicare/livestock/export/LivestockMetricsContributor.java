package com.avicare.livestock.export;

import com.avicare.admin.spi.PlatformMetricsContributor;
import com.avicare.livestock.repository.ProductionUnitRepository;
import com.avicare.livestock.repository.SaleRepository;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** Production and commercial volumes. */
@Component
@RequiredArgsConstructor
public class LivestockMetricsContributor implements PlatformMetricsContributor {

  private final ProductionUnitRepository units;
  private final SaleRepository sales;

  @Override
  public Map<String, Long> counters() {
    Map<String, Long> counters = new LinkedHashMap<>();
    counters.put("productionUnits", units.count());
    counters.put("salesLast30d", sales.countSince(LocalDate.now().minusDays(30)));
    return counters;
  }
}
