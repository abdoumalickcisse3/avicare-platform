package com.avicare.livestock.benchmark;

import com.avicare.livestock.repository.DailyRecordRepository;
import com.avicare.livestock.repository.FarmTotal;
import com.avicare.livestock.repository.PoultryBatchRepository;
import com.avicare.parameters.api.ParametersFacade;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Anonymous comparison between farms (console Phase 5, differentiator I).
 *
 * <p>One indicator, deliberately: <b>mortality rate</b>, deaths over birds placed. It is the
 * headline poultry figure and it is unambiguous from the data the platform already holds. Price per
 * unit is not comparable across articles and sale units, and FCR needs systematic weighings the
 * platform only samples — publishing either would produce a number farmers would trust and that
 * would be wrong.
 *
 * <p>Two guards, and neither is cosmetic:
 *
 * <ul>
 *   <li><b>Off by default.</b> A farm's mortality is its own business until the platform decides
 *       otherwise, deliberately.
 *   <li><b>Minimum cohort.</b> Below it nothing is published at all: an "average" over two or three
 *       farms lets any of them work out the others' figures, which is the opposite of anonymous.
 * </ul>
 *
 * <p>The platform figure is the mean of farm rates, not deaths over all birds: a farmer comparing
 * themselves wants the typical farm, not a number the largest operation dominates.
 */
@Service
@RequiredArgsConstructor
public class BenchmarkService {

  static final String SETTINGS_CATEGORY = "admin";
  static final String SETTINGS_KEY = "benchmarks";
  static final int DEFAULT_MIN_COHORT = 5;

  private final DailyRecordRepository dailyRecords;
  private final PoultryBatchRepository batches;
  private final ParametersFacade parameters;

  /** Whether comparison is published, and to how small a cohort. */
  public record Settings(boolean enabled, int minCohort) {}

  /**
   * The platform figure and, when asked for one, that farm's own.
   *
   * @param available false when the feature is off or the cohort is too small — the caller shows
   *     nothing rather than a misleading zero
   */
  public record Comparison(
      boolean available,
      String unavailableReason,
      int cohortSize,
      BigDecimal platformMortalityRate,
      BigDecimal farmMortalityRate) {}

  @Transactional(readOnly = true)
  public Settings settings() {
    return parameters.listPlatform(SETTINGS_CATEGORY).stream()
        .filter(e -> SETTINGS_KEY.equals(e.key()))
        .findFirst()
        .map(
            e ->
                new Settings(
                    Boolean.TRUE.equals(e.value().get("enabled")),
                    asInt(e.value().get("min_cohort"))))
        .orElse(new Settings(false, DEFAULT_MIN_COHORT));
  }

  /** Mortality rate per farm, as a percentage. Farms with no birds placed are absent. */
  @Transactional(readOnly = true)
  public Map<Long, BigDecimal> ratesByFarm() {
    Map<Long, Long> placed = totals(batches.sumInitialCountByFarm());
    Map<Long, Long> deaths = totals(dailyRecords.mortalityTotalsByFarm());

    Map<Long, BigDecimal> rates = new HashMap<>();
    placed.forEach(
        (farmId, birds) -> {
          if (birds > 0) {
            rates.put(
                farmId,
                BigDecimal.valueOf(deaths.getOrDefault(farmId, 0L) * 100.0)
                    .divide(BigDecimal.valueOf(birds), 2, RoundingMode.HALF_UP));
          }
        });
    return rates;
  }

  /**
   * What a farm should be shown.
   *
   * @param farmId null to get the platform figure alone, for the console
   */
  @Transactional(readOnly = true)
  public Comparison comparison(Long farmId) {
    Settings settings = settings();
    Map<Long, BigDecimal> rates = ratesByFarm();
    int cohort = rates.size();

    if (!settings.enabled()) {
      return unavailable("La comparaison entre fermes n'est pas activée.", cohort);
    }
    if (cohort < settings.minCohort()) {
      // Naming the threshold rather than saying "unavailable": the farmer should know it is a
      // privacy floor, not a failure.
      return unavailable(
          "Comparaison indisponible : moins de " + settings.minCohort() + " fermes comparables.",
          cohort);
    }

    BigDecimal platform =
        rates.values().stream()
            .reduce(BigDecimal.ZERO, BigDecimal::add)
            .divide(BigDecimal.valueOf(cohort), 2, RoundingMode.HALF_UP);

    return new Comparison(true, null, cohort, platform, farmId == null ? null : rates.get(farmId));
  }

  private static Comparison unavailable(String reason, int cohort) {
    return new Comparison(false, reason, cohort, null, null);
  }

  private static Map<Long, Long> totals(List<FarmTotal> rows) {
    Map<Long, Long> map = new HashMap<>();
    rows.forEach(row -> map.put(row.getFarmId(), row.getTotal()));
    return map;
  }

  private static int asInt(Object raw) {
    return Optional.ofNullable(raw)
        .filter(Number.class::isInstance)
        .map(v -> ((Number) v).intValue())
        .filter(v -> v > 0)
        .orElse(DEFAULT_MIN_COHORT);
  }
}
