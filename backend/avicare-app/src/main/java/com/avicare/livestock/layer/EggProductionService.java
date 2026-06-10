package com.avicare.livestock.layer;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.livestock.domain.DailyEggProduction;
import com.avicare.livestock.domain.EggCollection;
import com.avicare.livestock.domain.LifecycleEvent;
import com.avicare.livestock.domain.ProductionUnit;
import com.avicare.livestock.repository.DailyEggProductionRepository;
import com.avicare.livestock.repository.EggCollectionRepository;
import com.avicare.livestock.repository.LifecycleEventRepository;
import com.avicare.livestock.service.LivestockService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Daily egg-production aggregation for a layer unit (Sprint B2-2). {@link #closeDay} aggregates the
 * day's {@link EggCollection} rows (all time-slots) into one recomputable {@link
 * DailyEggProduction} snapshot per (unit, date) and derives the laying / break rates.
 *
 * <p>Idempotent: re-closing a day recomputes every field from the collections and refreshes only
 * {@code closedAt}/{@code closedBy} — safe to re-run after a late collection edit. A {@code
 * DAILY_PRODUCTION_CLOSED} lifecycle event is journaled on each close (no head-count change).
 */
@Service
@RequiredArgsConstructor
public class EggProductionService {

  public static final String EVENT_DAILY_PRODUCTION_CLOSED = "DAILY_PRODUCTION_CLOSED";

  private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

  private final DailyEggProductionRepository dailyEggProductionRepository;
  private final EggCollectionRepository eggCollectionRepository;
  private final LifecycleEventRepository lifecycleEventRepository;
  private final LivestockService livestockService;

  @Transactional
  public DailyEggProduction closeDay(Long unitId, LocalDate date, Long closedByUserId) {
    ProductionUnit unit = livestockService.getUnit(unitId); // 404 if the unit does not exist

    List<EggCollection> collections =
        eggCollectionRepository.findByProductionUnitIdAndCollectionDateBetween(unitId, date, date);
    if (collections.isEmpty()) {
      throw new BusinessRuleException(
          "NO_COLLECTIONS_TO_CLOSE", "No egg collections to close for " + date);
    }

    int totalEggs = collections.stream().mapToInt(EggCollection::getTotalEggs).sum();
    int totalBroken = collections.stream().mapToInt(EggCollection::getBrokenEggs).sum();
    Map<String, Integer> gradesAggregate = mergeGrades(collections);
    int activeLayers = unit.getCurrentCount();

    DailyEggProduction snapshot =
        dailyEggProductionRepository
            .findByProductionUnitIdAndProductionDate(unitId, date)
            .orElseGet(DailyEggProduction::new);

    snapshot.setProductionUnit(unit);
    snapshot.setProductionDate(date);
    snapshot.setTotalEggsCollected(totalEggs);
    snapshot.setTotalBrokenEggs(totalBroken);
    snapshot.setGradesAggregate(gradesAggregate);
    snapshot.setActiveLayersCount(activeLayers);
    snapshot.setLayingRatePct(layingRate(totalEggs, activeLayers));
    snapshot.setBreakRatePct(breakRate(totalEggs, totalBroken));
    snapshot.setClosedAt(LocalDateTime.now());
    snapshot.setClosedById(closedByUserId);
    DailyEggProduction saved = dailyEggProductionRepository.save(snapshot);

    LifecycleEvent event = new LifecycleEvent();
    event.setProductionUnitId(unitId);
    event.setEventType(EVENT_DAILY_PRODUCTION_CLOSED);
    event.setQuantityDelta(0);
    event.setReason("daily_production_closed");
    event.setDetails(
        Map.of(
            "production_date",
            date.toString(),
            "total_eggs_collected",
            totalEggs,
            "total_broken_eggs",
            totalBroken,
            "laying_rate_pct",
            String.valueOf(saved.getLayingRatePct())));
    event.setCreatedBy(closedByUserId);
    lifecycleEventRepository.save(event);

    return saved;
  }

  @Transactional(readOnly = true)
  public Optional<DailyEggProduction> getDailyProduction(Long unitId, LocalDate date) {
    return dailyEggProductionRepository.findByProductionUnitIdAndProductionDate(unitId, date);
  }

  @Transactional(readOnly = true)
  public List<DailyEggProduction> listForUnit(Long unitId, LocalDate from, LocalDate to) {
    return dailyEggProductionRepository.findByProductionUnitIdAndProductionDateBetween(
        unitId, from, to);
  }

  /** Average laying rate over the last {@code days} days (inclusive of today), if any snapshot. */
  @Transactional(readOnly = true)
  public Optional<BigDecimal> getRollingLayingRate(Long unitId, int days) {
    LocalDate to = LocalDate.now();
    LocalDate from = to.minusDays(Math.max(0, days - 1));
    List<BigDecimal> rates =
        listForUnit(unitId, from, to).stream()
            .map(DailyEggProduction::getLayingRatePct)
            .filter(r -> r != null)
            .toList();
    if (rates.isEmpty()) {
      return Optional.empty();
    }
    BigDecimal sum = rates.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
    return Optional.of(sum.divide(BigDecimal.valueOf(rates.size()), 2, RoundingMode.HALF_UP));
  }

  private Map<String, Integer> mergeGrades(List<EggCollection> collections) {
    Map<String, Integer> merged = new HashMap<>();
    for (EggCollection c : collections) {
      if (c.getGradesCount() == null) {
        continue;
      }
      c.getGradesCount().forEach((grade, count) -> merged.merge(grade, count, Integer::sum));
    }
    return merged;
  }

  /** (total / active layers) * 100, or null when there are no active layers. */
  private BigDecimal layingRate(int totalEggs, int activeLayers) {
    if (activeLayers <= 0) {
      return null;
    }
    return BigDecimal.valueOf(totalEggs)
        .multiply(HUNDRED)
        .divide(BigDecimal.valueOf(activeLayers), 2, RoundingMode.HALF_UP);
  }

  /** broken / (total + broken) * 100, or 0 when nothing was produced. */
  private BigDecimal breakRate(int totalEggs, int totalBroken) {
    int produced = totalEggs + totalBroken;
    if (produced <= 0) {
      return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
    }
    return BigDecimal.valueOf(totalBroken)
        .multiply(HUNDRED)
        .divide(BigDecimal.valueOf(produced), 2, RoundingMode.HALF_UP);
  }
}
