package com.avicare.partner.service;

import com.avicare.common.api.exception.NotFoundException;
import com.avicare.livestock.api.LivestockFacade;
import com.avicare.livestock.api.dto.LivestockStats;
import com.avicare.partner.api.PartnerFacade;
import com.avicare.partner.domain.Partner;
import com.avicare.partner.dto.response.NetworkDashboardResponse;
import com.avicare.partner.dto.response.NetworkFarmRow;
import com.avicare.partner.dto.response.PartnerProfileResponse;
import com.avicare.tenancy.api.TenancyFacade;
import java.time.LocalDate;
import java.util.List;
import java.util.OptionalLong;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Read model of the partner-portal "Voir" layer. For each CONFIRMED farm in a partner's network it
 * pulls the business facades and <b>masks every metric by the scopes the farm shares</b> ({@link
 * PartnerFacade#sharedScopes}). Scope masking is the trust boundary — applied here, never delegated
 * to the front. No writes.
 */
@Service
@RequiredArgsConstructor
public class PartnerNetworkReadService {

  private static final int WINDOW_DAYS = 30;

  private final PartnerFacade partnerFacade;
  private final PartnerService partnerService;
  private final TenancyFacade tenancyFacade;
  private final LivestockFacade livestockFacade;
  private final PartnerRiskEvaluator riskEvaluator;

  @Transactional(readOnly = true)
  public PartnerProfileResponse profile(Long partnerId) {
    Partner p = partnerService.get(partnerId);
    return PartnerProfileResponse.of(p, partnerFacade.farmIdsInNetwork(partnerId).size());
  }

  @Transactional(readOnly = true)
  public NetworkDashboardResponse dashboard(Long partnerId) {
    List<NetworkFarmRow> rows = farms(partnerId);
    int activeCount = (int) rows.stream().filter(r -> Boolean.TRUE.equals(r.active())).count();
    long totalFeed =
        rows.stream().filter(r -> r.feedKg() != null).mapToLong(NetworkFarmRow::feedKg).sum();
    var mortality =
        rows.stream()
            .filter(r -> r.mortalityRate() != null)
            .mapToDouble(NetworkFarmRow::mortalityRate);
    var avgMortality = mortality.average();
    return new NetworkDashboardResponse(
        rows.size(),
        activeCount,
        totalFeed,
        avgMortality.isPresent() ? avgMortality.getAsDouble() : null);
  }

  @Transactional(readOnly = true)
  public List<NetworkFarmRow> farms(Long partnerId) {
    return partnerFacade.farmIdsInNetwork(partnerId).stream()
        .map(id -> row(partnerId, id))
        .toList();
  }

  @Transactional(readOnly = true)
  public NetworkFarmRow farm(Long partnerId, Long farmId) {
    if (!partnerFacade.farmIdsInNetwork(partnerId).contains(farmId)) {
      throw NotFoundException.of("Farm", farmId);
    }
    return row(partnerId, farmId);
  }

  /** Build a farm row, filling only the metrics the farm shares with this partner. */
  private NetworkFarmRow row(Long partnerId, Long farmId) {
    Set<String> scopes = partnerFacade.sharedScopes(partnerId, farmId);
    String name = tenancyFacade.findById(farmId).name();

    // Both ride on the activity scope: a farm keeping its activity private is unmeasured here,
    // never reported as OK.
    Boolean active = null;
    String riskLevel = null;
    if (scopes.contains("activity")) {
      active = livestockFacade.countActiveUnits(farmId) > 0;
      OptionalLong silentDays = riskEvaluator.daysSinceLastEntry(farmId);
      if (silentDays.isPresent()) {
        riskLevel = riskEvaluator.levelFor(silentDays.getAsLong()).name();
      }
    }

    Long feedKg = null;
    Double mortalityRate = null;
    if (scopes.contains("feed_consumption") || scopes.contains("flock_health")) {
      LivestockStats stats =
          livestockFacade.livestockStats(
              farmId, LocalDate.now().minusDays(WINDOW_DAYS), LocalDate.now());
      if (scopes.contains("feed_consumption") && stats.dailyFeedKg() != null) {
        feedKg = Math.round(stats.dailyFeedKg());
      }
      if (scopes.contains("flock_health")) {
        mortalityRate = stats.mortalityRate();
      }
    }
    return new NetworkFarmRow(farmId, name, active, feedKg, mortalityRate, riskLevel);
  }
}
