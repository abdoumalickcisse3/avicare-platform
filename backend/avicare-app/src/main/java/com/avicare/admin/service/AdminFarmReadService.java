package com.avicare.admin.service;

import com.avicare.admin.dto.response.AdminFarmDetail;
import com.avicare.admin.dto.response.AdminFarmRow;
import com.avicare.livestock.api.LivestockFacade;
import com.avicare.livestock.api.dto.LivestockStats;
import com.avicare.partner.api.PartnerFacade;
import com.avicare.subscription.api.SubscriptionFacade;
import com.avicare.tenancy.api.TenancyFacade;
import com.avicare.tenancy.api.dto.FarmInfo;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Read model of the back-office farm views.
 *
 * <p>Assembled from public facades only — the console is a client of the business contexts, never a
 * second implementation of them. The directory pulls its columns in batch: listing every farm and
 * then querying each one would be an N+1 over the whole tenant base.
 */
@Service
@RequiredArgsConstructor
public class AdminFarmReadService {

  private static final int STATS_WINDOW_DAYS = 30;

  private final TenancyFacade tenancyFacade;
  private final LivestockFacade livestockFacade;
  private final SubscriptionFacade subscriptionFacade;
  private final PartnerFacade partnerFacade;

  /** Every farm, newest activity first, optionally filtered on the name. */
  @Transactional(readOnly = true)
  public List<AdminFarmRow> list(String query) {
    List<FarmInfo> farms = tenancyFacade.listAllFarms();
    if (query != null && !query.isBlank()) {
      String needle = query.trim().toLowerCase(Locale.ROOT);
      farms =
          farms.stream()
              .filter(f -> f.name() != null && f.name().toLowerCase(Locale.ROOT).contains(needle))
              .toList();
    }
    List<Long> ids = farms.stream().map(FarmInfo::id).toList();

    Map<Long, Long> members = tenancyFacade.memberCountByFarm(ids);
    Map<Long, Long> units = livestockFacade.activeUnitCountByFarm(ids);
    Map<Long, LocalDateTime> activity = livestockFacade.lastActivityByFarm(ids);

    return farms.stream()
        .map(
            f ->
                new AdminFarmRow(
                    f.id(),
                    f.name(),
                    f.active(),
                    members.getOrDefault(f.id(), 0L),
                    units.getOrDefault(f.id(), 0L),
                    activity.get(f.id())))
        .sorted(
            (a, b) -> {
              // Farms that never recorded anything sort last: they are the ones to look at, but
              // they carry no date to rank by.
              if (a.lastActivityAt() == null && b.lastActivityAt() == null) return 0;
              if (a.lastActivityAt() == null) return 1;
              if (b.lastActivityAt() == null) return -1;
              return b.lastActivityAt().compareTo(a.lastActivityAt());
            })
        .toList();
  }

  @Transactional(readOnly = true)
  public AdminFarmDetail detail(Long farmId) {
    FarmInfo farm = tenancyFacade.findById(farmId);
    List<Long> ids = List.of(farmId);
    LivestockStats stats =
        livestockFacade.livestockStats(
            farmId, LocalDate.now().minusDays(STATS_WINDOW_DAYS), LocalDate.now());

    List<AdminFarmDetail.PartnerLinkRow> partners =
        partnerFacade.partnersForFarm(farmId).stream()
            .map(
                p ->
                    new AdminFarmDetail.PartnerLinkRow(
                        p.partnerId(), p.partnerName(), p.partnerType(), p.membershipStatus()))
            .toList();

    return new AdminFarmDetail(
        farm.id(),
        farm.name(),
        farm.currency(),
        farm.timezone(),
        farm.active(),
        tenancyFacade.memberCountByFarm(ids).getOrDefault(farmId, 0L),
        stats.activeBatches(),
        stats.totalHeadcount(),
        livestockFacade.lastActivityByFarm(ids).get(farmId),
        subscriptionFacade.listEnabledModules(farmId),
        partners);
  }
}
