package com.avicare.partner.service;

import com.avicare.partner.api.PartnerFacade;
import com.avicare.partner.domain.AlertCategory;
import com.avicare.partner.domain.AlertSeverity;
import com.avicare.partner.domain.Partner;
import com.avicare.tenancy.api.TenancyFacade;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.OptionalLong;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Daily scan that tells each partner which of its farms is slipping away (couche « Garder »). For
 * every ACTIVE partner it walks the confirmed network, materializes the {@code FARM_SILENT}
 * conditions currently true, and resolves the ones that cleared.
 *
 * <p><b>Trust boundary.</b> A farm that does not share the {@code activity} scope is skipped
 * entirely: its silence is not observable by this partner, so no alert exists, no push goes out,
 * and it never appears in a count. The masking happens here — the endpoints and the front are never
 * asked to enforce it. The alert text carries only the farm name and a number of days.
 *
 * <p>A failure on one partner never blocks the others, and a failure on one farm never resolves
 * that farm's standing alerts (its condition was not evaluated, so it is unknown, not gone).
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class PartnerAlertScanner {

  private static final String ACTIVITY_SCOPE = "activity";

  private final PartnerService partnerService;
  private final PartnerFacade partnerFacade;
  private final PartnerAlertService alertService;
  private final PartnerRiskEvaluator riskEvaluator;
  private final TenancyFacade tenancyFacade;

  /** Daily, after the farmer notification scan (default 06:30 Africa/Dakar). */
  @Scheduled(
      cron = "${partner.risk.scan-cron:0 30 6 * * *}",
      zone = "${partner.risk.zone:Africa/Dakar}")
  public void scanAll() {
    for (Partner partner : partnerService.listActive(null)) {
      try {
        scanPartner(partner.getId());
      } catch (RuntimeException e) {
        log.warn(
            "Partner alert scan failed for partner {}: {}", partner.getId(), e.getMessage(), e);
      }
    }
  }

  /** Reconcile the {@code FARM_SILENT} alerts of one partner against its network. */
  @Transactional
  public void scanPartner(Long partnerId) {
    Set<String> currentKeys = new HashSet<>();
    List<Long> skippedFarmIds = new ArrayList<>();

    for (Long farmId : partnerFacade.farmIdsInNetwork(partnerId)) {
      try {
        silenceCondition(partnerId, farmId)
            .ifPresent(
                condition -> {
                  currentKeys.add(condition.dedupKey());
                  alertService.raise(partnerId, farmId, condition);
                });
      } catch (RuntimeException e) {
        skippedFarmIds.add(farmId);
        log.warn(
            "Partner alert scan failed for partner {} farm {}: {}",
            partnerId,
            farmId,
            e.getMessage());
      }
    }

    alertService.resolveDisappeared(
        partnerId, AlertCategory.FARM_SILENT, currentKeys, skippedFarmIds);
  }

  /**
   * The silence condition of one farm, or empty when there is nothing to raise: the farm does not
   * share its activity, has no recorded activity at all, or simply is not silent enough yet.
   */
  private Optional<PartnerAlertCondition> silenceCondition(Long partnerId, Long farmId) {
    if (!partnerFacade.sharedScopes(partnerId, farmId).contains(ACTIVITY_SCOPE)) {
      return Optional.empty();
    }
    OptionalLong days = riskEvaluator.daysSinceLastEntry(farmId);
    if (days.isEmpty() || riskEvaluator.levelFor(days.getAsLong()) != RiskLevel.AT_RISK) {
      return Optional.empty();
    }

    long silentDays = days.getAsLong();
    AlertSeverity severity =
        riskEvaluator.isCritical(silentDays) ? AlertSeverity.CRITICAL : AlertSeverity.WARNING;
    String farmName = tenancyFacade.findById(farmId).name();

    return Optional.of(
        new PartnerAlertCondition(
            AlertCategory.FARM_SILENT,
            severity,
            // The tier belongs in the key: without it, a farm worsening from WARNING to CRITICAL
            // would reuse the open alert and the partner would never hear about the escalation.
            "FARM_SILENT:farm:" + farmId + ":" + severity.name(),
            "Éleveur silencieux : " + farmName,
            "« " + farmName + " » n'a rien saisi depuis " + silentDays + " jours."));
  }
}
