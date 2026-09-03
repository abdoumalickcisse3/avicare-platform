package com.avicare.livestock.closure;

import com.avicare.common.api.exception.ConflictException;
import com.avicare.common.api.exception.NotFoundException;
import com.avicare.finance.api.FinanceFacade;
import com.avicare.livestock.closure.dto.ClosureSummaryResponse;
import com.avicare.livestock.commercial.CommercialFacade;
import com.avicare.livestock.domain.GrowthPerformance;
import com.avicare.livestock.domain.PoultryBatch;
import com.avicare.livestock.domain.ProductionUnit;
import com.avicare.livestock.poultry.GrowthAnalysisService;
import com.avicare.livestock.repository.LifecycleEventRepository;
import com.avicare.livestock.service.LivestockService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Closes a production unit and freezes its end-of-cycle report.
 *
 * <p>Frozen, never recomputed: an expense recorded three weeks later, or a corrected article price,
 * would otherwise rewrite a past result. The row carries the date it was computed on.
 */
@Service
@RequiredArgsConstructor
public class UnitClosureService {

  private static final BigDecimal GRAMS_PER_KG = BigDecimal.valueOf(1000);

  private final UnitClosureRepository unitClosureRepository;
  private final UnitCostService unitCostService;
  private final LifecycleEventRepository lifecycleEventRepository;
  private final GrowthAnalysisService growthAnalysisService;
  private final LivestockService livestockService;
  private final CommercialFacade commercialFacade;
  private final FinanceFacade financeFacade;

  @Transactional
  public UnitClosure close(Long farmId, Long unitId, Long chickCostXof, String notes, Long userId) {
    ProductionUnit unit = loadForFarm(farmId, unitId);
    unitClosureRepository
        .findByProductionUnitId(unitId)
        .ifPresent(
            existing -> {
              throw new ConflictException(
                  "UNIT_ALREADY_CLOSED", "Unit " + unitId + " is already closed");
            });

    LocalDate today = LocalDate.now();

    // Headcount comes from the CREATED event, not from the unit: ProductionUnit carries no
    // initial count, and this reads the same for a layer flock as for a broiler batch.
    long initialCount = lifecycleEventRepository.sumInitialCountByUnit(unitId);
    long mortalityDelta = lifecycleEventRepository.sumMortalityDelta(unitId);
    long deaths = -mortalityDelta;
    long liveBirds = initialCount + mortalityDelta;

    // Growth figures exist for broiler batches only; a layer flock leaves them null.
    GrowthPerformance perf =
        unit instanceof PoultryBatch
            ? growthAnalysisService.computePerformance(unitId, today)
            : null;

    long revenueXof = commercialFacade.revenueByProductionUnit(farmId, unitId);
    UnitCostService.FeedCost feed = unitCostService.feedCost(unitId);
    long chickCost = chickCostXof != null ? chickCostXof : 0L;
    long otherExpenseXof = financeFacade.directExpensesForUnit(farmId, unitId);
    long totalCostXof = feed.costXof() + chickCost + otherExpenseXof;

    BigDecimal exitWeightG = perf != null ? perf.getCurrentWeightG() : null;

    UnitClosure closure = new UnitClosure();
    closure.setProductionUnitId(unitId);
    closure.setFarmId(farmId);
    closure.setClosedAt(LocalDateTime.now());
    closure.setClosedBy(userId);
    closure.setStartDate(unit.getStartDate());
    closure.setEndDate(today);
    closure.setDurationDays((int) Math.max(0, ChronoUnit.DAYS.between(unit.getStartDate(), today)));

    closure.setInitialCount((int) initialCount);
    closure.setRemainingCount(unit.getCurrentCount());
    closure.setDeaths((int) deaths);
    closure.setMortalityPercent(mortalityPercent(deaths, initialCount));

    if (perf != null) {
      closure.setExitWeightG(exitWeightG);
      closure.setAvgDailyGainG(perf.getGmqGPerDay());
      closure.setTotalFeedKg(perf.getCumulativeFeedKg());
      closure.setFeedConversionRatio(perf.getFeedConversionRatio());
    }

    closure.setRevenueXof(revenueXof);
    closure.setFeedCostXof(feed.costXof());
    closure.setChickCostXof(chickCost);
    closure.setOtherExpenseXof(otherExpenseXof);
    closure.setTotalCostXof(totalCostXof);
    closure.setMarginXof(revenueXof - totalCostXof);
    closure.setCostPerKgXof(costPerKg(totalCostXof, liveBirds, exitWeightG));

    closure.setConsumedArticles(feed.consumedArticles());
    closure.setValuedArticles(feed.valuedArticles());
    closure.setNotes(notes);

    livestockService.closeUnit(unitId);
    return unitClosureRepository.save(closure);
  }

  /**
   * Every closed cycle of the farm, most recent first, paired with its unit name. The names are
   * resolved in one listing rather than one lookup per row.
   */
  @Transactional(readOnly = true)
  public List<ClosureSummaryResponse> listForFarm(Long farmId) {
    Map<Long, String> namesById =
        livestockService.listByFarm(farmId).stream()
            .collect(
                Collectors.toMap(
                    ProductionUnit::getId,
                    u -> u.getName() != null ? u.getName() : "Lot #" + u.getId()));
    return unitClosureRepository.findByFarmIdOrderByEndDateDescIdDesc(farmId).stream()
        .map(
            c ->
                ClosureSummaryResponse.from(
                    c, namesById.getOrDefault(c.getProductionUnitId(), "Lot supprimé")))
        .toList();
  }

  @Transactional(readOnly = true)
  public UnitClosure get(Long farmId, Long unitId) {
    UnitClosure closure =
        unitClosureRepository
            .findByProductionUnitId(unitId)
            .orElseThrow(() -> NotFoundException.of("UnitClosure", unitId));
    if (!closure.getFarmId().equals(farmId)) {
      throw NotFoundException.of("UnitClosure", unitId);
    }
    return closure;
  }

  /** Reopening removes the report: a frozen result that no longer describes anything is noise. */
  @Transactional
  public void reopen(Long farmId, Long unitId) {
    get(farmId, unitId); // 404 unless a report exists for this farm
    unitClosureRepository.deleteByProductionUnitId(unitId);
    livestockService.reopenUnit(unitId);
  }

  private ProductionUnit loadForFarm(Long farmId, Long unitId) {
    ProductionUnit unit = livestockService.getUnit(unitId);
    if (!unit.getFarmId().equals(farmId)) {
      throw NotFoundException.of("ProductionUnit", unitId);
    }
    return unit;
  }

  private static BigDecimal mortalityPercent(long deaths, long initialCount) {
    if (initialCount <= 0) {
      return null;
    }
    return BigDecimal.valueOf(deaths * 100.0 / initialCount).setScale(2, RoundingMode.HALF_UP);
  }

  /**
   * Cost of one live kilo produced. Counts every bird produced alive, sold or still on hand:
   * feeding the unsold tail cost money too, and it is production even when it is not yet an
   * invoice. Null rather than wrong when the batch was never weighed.
   */
  private static Integer costPerKg(long totalCostXof, long liveBirds, BigDecimal exitWeightG) {
    if (exitWeightG == null || liveBirds <= 0) {
      return null;
    }
    BigDecimal kg =
        exitWeightG
            .multiply(BigDecimal.valueOf(liveBirds))
            .divide(GRAMS_PER_KG, 3, RoundingMode.HALF_UP);
    if (kg.signum() <= 0) {
      return null;
    }
    return BigDecimal.valueOf(totalCostXof).divide(kg, 0, RoundingMode.HALF_UP).intValueExact();
  }
}
