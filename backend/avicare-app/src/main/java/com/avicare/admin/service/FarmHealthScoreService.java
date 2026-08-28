package com.avicare.admin.service;

import com.avicare.admin.dto.response.FarmHealthRow;
import com.avicare.livestock.api.LivestockFacade;
import com.avicare.parameters.api.ParametersFacade;
import com.avicare.tenancy.api.TenancyFacade;
import com.avicare.tenancy.api.dto.FarmInfo;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Which farms are drifting away, derived on read — never stored.
 *
 * <p>Thresholds come from {@code catalog_items} rather than from constants: they will be tuned
 * against real usage, and a tuning must not require a deployment.
 *
 * <p>A farm that has NEVER recorded anything is its own case: it is not "quiet since N days", it
 * never started, and that is a different conversation for whoever calls it.
 */
@Service
@RequiredArgsConstructor
public class FarmHealthScoreService {

  private static final String CATEGORY = "admin";
  private static final String KEY = "health_score_thresholds";
  private static final long DEFAULT_WATCH_DAYS = 7;
  private static final long DEFAULT_AT_RISK_DAYS = 21;

  private final TenancyFacade tenancyFacade;
  private final LivestockFacade livestockFacade;
  private final ParametersFacade parametersFacade;

  @Transactional(readOnly = true)
  public List<FarmHealthRow> farmsAtRisk() {
    Thresholds thresholds = thresholds();
    List<FarmInfo> farms = tenancyFacade.listAllFarms();
    List<Long> ids = farms.stream().map(FarmInfo::id).toList();
    Map<Long, LocalDateTime> activity = livestockFacade.lastActivityByFarm(ids);

    return farms.stream()
        .map(f -> row(f, activity.get(f.id()), thresholds))
        .filter(r -> !FarmHealthRow.OK.equals(r.level()))
        .sorted(
            Comparator.comparing(
                    FarmHealthRow::daysSinceLastEntry,
                    Comparator.nullsFirst(Comparator.reverseOrder()))
                .reversed())
        .toList();
  }

  private FarmHealthRow row(FarmInfo farm, LocalDateTime lastActivity, Thresholds thresholds) {
    if (lastActivity == null) {
      return new FarmHealthRow(
          farm.id(),
          farm.name(),
          FarmHealthRow.AT_RISK,
          null,
          "Aucune saisie depuis la création du compte.");
    }
    long days = ChronoUnit.DAYS.between(lastActivity.toLocalDate(), LocalDate.now());
    if (days >= thresholds.atRiskDays()) {
      return new FarmHealthRow(
          farm.id(),
          farm.name(),
          FarmHealthRow.AT_RISK,
          days,
          "Aucune saisie depuis " + days + " jours.");
    }
    if (days >= thresholds.watchDays()) {
      return new FarmHealthRow(
          farm.id(),
          farm.name(),
          FarmHealthRow.WATCH,
          days,
          "Saisie ralentie : " + days + " jours.");
    }
    return new FarmHealthRow(farm.id(), farm.name(), FarmHealthRow.OK, days, "À jour.");
  }

  private Thresholds thresholds() {
    return parametersFacade.listPlatform(CATEGORY).stream()
        .filter(e -> KEY.equals(e.key()))
        .findFirst()
        .map(
            e ->
                new Thresholds(
                    asLong(e.value(), "watch_days", DEFAULT_WATCH_DAYS),
                    asLong(e.value(), "at_risk_days", DEFAULT_AT_RISK_DAYS)))
        .orElseGet(() -> new Thresholds(DEFAULT_WATCH_DAYS, DEFAULT_AT_RISK_DAYS));
  }

  private static long asLong(Map<String, Object> value, String key, long fallback) {
    Object raw = value == null ? null : value.get(key);
    return raw instanceof Number n ? n.longValue() : fallback;
  }

  private record Thresholds(long watchDays, long atRiskDays) {}
}
