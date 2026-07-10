package com.avicare.reporting.service;

import com.avicare.common.api.dto.ActivityItem;
import com.avicare.livestock.api.LivestockFacade;
import com.avicare.livestock.commercial.CommercialFacade;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Merges the recent-activity feeds from the livestock and commercial contexts into a single farm
 * timeline (most recent first, capped at {@code limit}). Fetching {@code limit} from each source is
 * sufficient: any item in the global top-{@code limit} is necessarily within its own source's
 * top-{@code limit}, so no candidate is dropped before the merge.
 */
@Service
@RequiredArgsConstructor
public class ActivityService {

  private final LivestockFacade livestockFacade;
  private final CommercialFacade commercialFacade;

  public List<ActivityItem> recentActivity(Long farmId, int limit) {
    return Stream.concat(
            livestockFacade.recentActivity(farmId, limit).stream(),
            commercialFacade.recentActivity(farmId, limit).stream())
        .sorted(
            Comparator.comparing(ActivityItem::at, Comparator.nullsLast(Comparator.reverseOrder())))
        .limit(limit)
        .toList();
  }
}
