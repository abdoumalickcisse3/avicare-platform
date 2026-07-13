package com.avicare.livestock.poultry;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.livestock.domain.DailyRecord;
import com.avicare.livestock.domain.FormulaIngredient;
import com.avicare.livestock.domain.LifecycleEvent;
import com.avicare.livestock.domain.ProductionUnit;
import com.avicare.livestock.inventory.ConsumptionSource;
import com.avicare.livestock.inventory.FeedFormulaService;
import com.avicare.livestock.inventory.StockConsumption;
import com.avicare.livestock.inventory.StockConsumptionService;
import com.avicare.livestock.repository.DailyRecordRepository;
import com.avicare.livestock.repository.LifecycleEventRepository;
import com.avicare.livestock.service.LivestockService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Daily entries on a production unit (Sprint B1-1). {@link #record} upserts one row per (unit,
 * date) and reconciles the head count from the mortality <em>delta</em> vs what was already
 * recorded that day:
 *
 * <ul>
 *   <li>delta &gt; 0 → {@link LivestockService#recordMortality} of {@code min(delta, currentCount)}
 *       (the count floors at 0 in a catastrophe; the raw mortality is kept on the row);
 *   <li>delta &lt; 0 → a {@code COUNT_ADJUSTMENT} that adds {@code -delta} back (a downward
 *       correction);
 * </ul>
 *
 * <p>A {@code DAILY_RECORD} lifecycle event (snapshot, no count change) is always journaled.
 */
@Service
@RequiredArgsConstructor
public class DailyRecordService {

  public static final String EVENT_DAILY_RECORD = "DAILY_RECORD";

  private final DailyRecordRepository dailyRecordRepository;
  private final LifecycleEventRepository lifecycleEventRepository;
  private final LivestockService livestockService;
  private final StockConsumptionService stockConsumptionService;
  private final FeedFormulaService feedFormulaService;

  @Transactional
  public DailyRecord record(Long unitId, DailyRecordCommand cmd, Long userId) {
    if (cmd.feedConsumption() != null && cmd.feedFormula() != null) {
      throw new BusinessRuleException(
          "DAILY_RECORD_FEED_SOURCE_CONFLICT",
          "Un seul mode d'aliment autorisé : article OU formule, pas les deux.");
    }

    ProductionUnit unit = livestockService.getUnit(unitId); // 404 if the unit does not exist

    DailyRecord rec =
        dailyRecordRepository
            .findByProductionUnitIdAndRecordDate(unitId, cmd.recordDate())
            .orElseGet(DailyRecord::new);
    int oldMortality = rec.getId() != null ? rec.getMortalityCount() : 0;

    rec.setProductionUnit(unit);
    rec.setRecordDate(cmd.recordDate());
    rec.setMortalityCount(cmd.mortalityCount());
    rec.setFeedKg(cmd.feedKg() != null ? cmd.feedKg() : BigDecimal.ZERO);
    rec.setWaterL(cmd.waterL() != null ? cmd.waterL() : BigDecimal.ZERO);
    rec.setObservations(cmd.observations());
    if (rec.getCreatedBy() == null) {
      rec.setCreatedBy(userId);
    }
    DailyRecord saved = dailyRecordRepository.save(rec);

    int delta = cmd.mortalityCount() - oldMortality;
    if (delta > 0) {
      int applied = Math.min(delta, unit.getCurrentCount());
      if (applied > 0) {
        livestockService.recordMortality(unitId, applied, "daily_record", userId);
      }
    } else if (delta < 0) {
      livestockService.recordEvent(
          unitId,
          LivestockService.EVENT_COUNT_ADJUSTMENT,
          -delta,
          "daily_record_correction",
          Map.of(),
          userId);
    }

    LifecycleEvent snapshot = new LifecycleEvent();
    snapshot.setProductionUnitId(unitId);
    snapshot.setEventType(EVENT_DAILY_RECORD);
    snapshot.setQuantityDelta(0);
    snapshot.setReason("daily_record");
    snapshot.setDetails(
        Map.of(
            "record_date", cmd.recordDate().toString(),
            "mortality_count", cmd.mortalityCount(),
            "feed_kg", saved.getFeedKg(),
            "water_l", saved.getWaterL()));
    snapshot.setCreatedBy(userId);
    lifecycleEventRepository.save(snapshot);

    // D18 optional coupling: draw the feed from stock (same transaction).
    if (cmd.feedConsumption() != null) {
      stockConsumptionService.applyConsumption(
          unit.getFarmId(),
          cmd.feedConsumption(),
          ConsumptionSource.dailyRecord(unitId, saved.getId()),
          userId);
    } else if (cmd.feedFormula() != null) {
      applyFormula(unit.getFarmId(), unitId, saved.getId(), cmd.feedFormula(), userId);
    }

    return saved;
  }

  /**
   * Décision D20 révisée: decompose a feed formula into one OUT movement per ingredient, each
   * {@code totalKg × percentage / 100} kg. Runs inside {@link #record}'s transaction (atomic).
   */
  private void applyFormula(
      Long farmId, Long unitId, Long recordId, FormulaConsumption ff, Long userId) {
    if (ff.totalKg() == null || ff.totalKg().signum() <= 0) {
      throw new BusinessRuleException(
          "FEED_FORMULA_QUANTITY", "La quantité totale d'aliment doit être supérieure à 0.");
    }
    List<FormulaIngredient> ingredients =
        feedFormulaService.resolveIngredients(farmId, ff.formulaKey(), ff.formulaId());
    for (FormulaIngredient ing : ingredients) {
      BigDecimal qty =
          ff.totalKg()
              .multiply(ing.percentage())
              .divide(BigDecimal.valueOf(100), 3, RoundingMode.HALF_UP);
      if (qty.signum() > 0) {
        stockConsumptionService.applyConsumption(
            farmId,
            new StockConsumption(ing.articleKey(), ing.articleSource(), qty, ff.notes()),
            ConsumptionSource.dailyRecord(unitId, recordId),
            userId);
      }
    }
  }

  @Transactional(readOnly = true)
  public List<DailyRecord> listForUnit(Long unitId) {
    return dailyRecordRepository.findByProductionUnitIdOrderByRecordDateDesc(unitId);
  }
}
