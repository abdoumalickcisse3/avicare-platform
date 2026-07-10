package com.avicare.reporting.service;

import com.avicare.common.api.dto.ActivityItem;
import com.avicare.common.security.access.FarmAccessChecker;
import com.avicare.livestock.api.LivestockFacade;
import com.avicare.livestock.commercial.CommercialFacade;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Merges the recent-activity feeds from the livestock and commercial contexts into a single farm
 * timeline (most recent first, capped at {@code limit}). Each source is included only when the
 * caller holds the matching read permission (mirrors the dashboard's per-section gating): livestock
 * needs {@code poultry:read}, commercial needs {@code commercial:read} or {@code finance:read}, so
 * a member without commercial access never sees sale/payment amounts. Fetching {@code limit} from
 * each source is sufficient: any item in the global top-{@code limit} is necessarily within its own
 * source's top-{@code limit}, so no candidate is dropped before the merge.
 */
@Service
@RequiredArgsConstructor
public class ActivityService {

  private final LivestockFacade livestockFacade;
  private final CommercialFacade commercialFacade;
  private final FarmAccessChecker farmAccess;

  public List<ActivityItem> recentActivity(Long farmId, int limit) {
    Stream<ActivityItem> livestock =
        farmAccess.hasPermission(farmId, "poultry:read")
            ? livestockFacade.recentActivity(farmId, limit).stream()
            : Stream.empty();
    Stream<ActivityItem> commercial =
        farmAccess.hasAnyPermission(farmId, "commercial:read", "finance:read")
            ? commercialFacade.recentActivity(farmId, limit).stream()
            : Stream.empty();
    return Stream.concat(livestock, commercial)
        .sorted(
            Comparator.comparing(ActivityItem::at, Comparator.nullsLast(Comparator.reverseOrder())))
        .limit(limit)
        .toList();
  }
}
