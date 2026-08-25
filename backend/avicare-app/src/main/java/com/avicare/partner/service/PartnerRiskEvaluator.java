package com.avicare.partner.service;

import com.avicare.common.api.dto.ActivityItem;
import com.avicare.livestock.api.LivestockFacade;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.OptionalLong;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Turns a farm's last data entry into a {@link RiskLevel} (couche « Garder »). Shared by the daily
 * {@link PartnerAlertScanner} and the portal read model, so the thresholds live in exactly one
 * place.
 *
 * <p>Thresholds are platform-level Spring properties, not farm {@code parameters}: they describe
 * how the platform reads network health, and a farm has no say in when its own silence is flagged.
 *
 * <p>The measure is the most recent livestock activity item (lifecycle events + stock movements) —
 * the best proxy the platform has for "the farmer is still using the app".
 */
@Component
@RequiredArgsConstructor
public class PartnerRiskEvaluator {

  private final LivestockFacade livestockFacade;

  @Value("${partner.risk.watch-days:7}")
  private int watchDays;

  @Value("${partner.risk.at-risk-days:14}")
  private int atRiskDays;

  @Value("${partner.risk.critical-days:30}")
  private int criticalDays;

  /**
   * Days since the farm last entered anything, or empty when nothing is known — a farm with no
   * recorded activity at all is not "silent", it is unmeasured, and we do not raise on it.
   */
  public OptionalLong daysSinceLastEntry(Long farmId) {
    List<ActivityItem> recent = livestockFacade.recentActivity(farmId, 1);
    if (recent.isEmpty() || recent.get(0).at() == null) {
      return OptionalLong.empty();
    }
    long days = ChronoUnit.DAYS.between(recent.get(0).at().toLocalDate(), LocalDate.now());
    return OptionalLong.of(Math.max(days, 0));
  }

  public RiskLevel levelFor(long daysSinceLastEntry) {
    if (daysSinceLastEntry >= atRiskDays) {
      return RiskLevel.AT_RISK;
    }
    return daysSinceLastEntry >= watchDays ? RiskLevel.WATCH : RiskLevel.OK;
  }

  /** True once the silence is long enough to deserve a second, louder alert. */
  public boolean isCritical(long daysSinceLastEntry) {
    return daysSinceLastEntry >= criticalDays;
  }
}
