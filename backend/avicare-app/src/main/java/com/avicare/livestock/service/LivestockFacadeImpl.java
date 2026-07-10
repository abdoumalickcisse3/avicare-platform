package com.avicare.livestock.service;

import com.avicare.common.api.dto.ActivityItem;
import com.avicare.common.api.dto.DayValue;
import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.common.api.exception.NotFoundException;
import com.avicare.livestock.api.LivestockFacade;
import com.avicare.livestock.api.ProductType;
import com.avicare.livestock.api.dto.LivestockStats;
import com.avicare.livestock.api.dto.ProductionUnitInfo;
import com.avicare.livestock.domain.LifecycleEvent;
import com.avicare.livestock.domain.PoultryBatch;
import com.avicare.livestock.domain.ProductionUnit;
import com.avicare.livestock.domain.StockMovement;
import com.avicare.livestock.domain.UnitStatus;
import com.avicare.livestock.layer.EggTrayStockService;
import com.avicare.livestock.repository.DailyEggProductionRepository;
import com.avicare.livestock.repository.DailyRecordRepository;
import com.avicare.livestock.repository.EggTrayStockRepository;
import com.avicare.livestock.repository.LifecycleEventRepository;
import com.avicare.livestock.repository.ProductionUnitRepository;
import com.avicare.livestock.repository.StockMovementRepository;
import com.avicare.livestock.repository.TreatmentExecutedRepository;
import com.avicare.livestock.repository.VaccinationRepository;
import com.avicare.livestock.repository.WeighingSampleRepository;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Default {@link LivestockFacade} implementation. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class LivestockFacadeImpl implements LivestockFacade {

  private final ProductionUnitRepository productionUnitRepository;
  private final LifecycleEventRepository lifecycleEventRepository;
  private final DailyRecordRepository dailyRecordRepository;
  private final WeighingSampleRepository weighingSampleRepository;
  private final DailyEggProductionRepository dailyEggProductionRepository;
  private final VaccinationRepository vaccinationRepository;
  private final TreatmentExecutedRepository treatmentExecutedRepository;
  private final LivestockService livestockService;
  private final EggTrayStockService eggTrayStockService;
  private final EggTrayStockRepository eggTrayStockRepository;
  private final StockMovementRepository stockMovementRepository;

  private static final Set<String> ACTIVITY_EVENT_TYPES =
      Set.of(
          "MORTALITY",
          "COUNT_ADJUSTMENT",
          "VACCINATION_ADMINISTERED",
          "TREATMENT_ADMINISTERED",
          "VET_VISIT_RECORDED",
          "DAILY_PRODUCTION_CLOSED",
          "CREATED",
          "HEALTH_OBSERVATION");

  @Override
  public List<ProductionUnitInfo> listFarmUnits(Long farmId) {
    return productionUnitRepository.findByFarmId(farmId).stream()
        .map(LivestockFacadeImpl::toInfo)
        .toList();
  }

  @Override
  public long countActiveUnits(Long farmId) {
    return productionUnitRepository.findByFarmIdAndStatus(farmId, UnitStatus.ACTIVE).size();
  }

  @Override
  public LivestockStats livestockStats(Long farmId, LocalDate from, LocalDate to) {
    // ── Snapshot KPIs (period-independent) ──────────────────────────────────
    long activeBatches = productionUnitRepository.countActiveByFarmId(farmId);
    Long headcountRaw = productionUnitRepository.sumCurrentCountActiveByFarmId(farmId);
    long totalHeadcount = headcountRaw != null ? headcountRaw : 0L;

    // ── Period KPIs — mortality ──────────────────────────────────────────────
    Long deathsRaw = dailyRecordRepository.sumMortalityByFarmAndPeriod(farmId, from, to);
    long deaths = deathsRaw != null ? deathsRaw : 0L;

    long initialEffectif = lifecycleEventRepository.sumInitialCountByFarm(farmId);
    // mortalityRate as a percentage (0–100); null when no initial effectif is known.
    Double mortalityRate = initialEffectif > 0 ? (double) deaths / initialEffectif * 100.0 : null;

    List<DayValue> mortalitySeries =
        dailyRecordRepository.sumMortalityByDayForFarm(farmId, from, to).stream()
            .map(row -> new DayValue((LocalDate) row[0], ((Number) row[1]).longValue()))
            .toList();

    // ── Period KPIs — broiler growth (GMQ) ──────────────────────────────────
    Double avgDailyGainG = weighingSampleRepository.avgDailyGainGByFarmAndPeriod(farmId, from, to);

    // ── Period KPIs — layer egg production ──────────────────────────────────
    // layingRate from daily_egg_productions.laying_rate_pct is already a percentage (0–100).
    Double layingRate = dailyEggProductionRepository.avgLayingRateByFarmAndPeriod(farmId, from, to);

    List<DayValue> layingSeries =
        dailyEggProductionRepository.sumEggsByDayForFarm(farmId, from, to).stream()
            .map(row -> new DayValue((LocalDate) row[0], ((Number) row[1]).longValue()))
            .toList();

    // ── Period KPIs — health events ─────────────────────────────────────────
    long vaccinationsCount = vaccinationRepository.countByFarmAndPeriod(farmId, from, to);
    long treatmentsCount = treatmentExecutedRepository.countByFarmAndPeriod(farmId, from, to);

    // ── Period KPIs — feed consumption ───────────────────────────────────────
    long feedDays = dailyRecordRepository.countFeedDaysByFarmAndPeriod(farmId, from, to);
    Double dailyFeedKg =
        feedDays > 0
            ? dailyRecordRepository.sumFeedKgByFarmAndPeriod(farmId, from, to).doubleValue()
                / feedDays
            : null;

    return new LivestockStats(
        activeBatches,
        totalHeadcount,
        deaths,
        mortalityRate,
        mortalitySeries,
        avgDailyGainG,
        layingRate,
        layingSeries,
        vaccinationsCount,
        treatmentsCount,
        dailyFeedKg);
  }

  // ── Production stock (D27 blocking) ─────────────────────────────────────

  @Override
  public long productionAvailable(Long farmId, ProductType type, Long unitId) {
    if (type == ProductType.BROILER) {
      ProductionUnit unit =
          productionUnitRepository
              .findById(unitId)
              .orElseThrow(() -> NotFoundException.of("ProductionUnit", unitId));
      validateBroilerUnit(farmId, unit);
      return unit.getCurrentCount();
    }
    // EGGS — farm-wide pool; 0 if not yet created (pure read, no write on readOnly tx)
    return eggTrayStockRepository
        .findByFarmId(farmId)
        .map(s -> (long) s.getFullTraysCount())
        .orElse(0L);
  }

  @Override
  @Transactional
  public void consumeProduction(Long farmId, ProductType type, Long unitId, long qty) {
    if (type == ProductType.BROILER) {
      ProductionUnit unit =
          productionUnitRepository
              .findById(unitId)
              .orElseThrow(() -> NotFoundException.of("ProductionUnit", unitId));
      validateBroilerUnit(farmId, unit);
      livestockService.consumeHeads(unitId, qty, null);
    } else {
      // EGGS
      long available = eggTrayStockService.getOrCreateForFarm(farmId).getFullTraysCount();
      if (available < qty) {
        throw new BusinessRuleException(
            "PRODUCTION_INSUFFICIENT",
            "Requested "
                + qty
                + " full trays but only "
                + available
                + " available for farm "
                + farmId);
      }
      eggTrayStockService.adjustStock(farmId, -(int) qty, 0);
    }
  }

  @Override
  @Transactional
  public void restockProduction(Long farmId, ProductType type, Long unitId, long qty) {
    if (type == ProductType.BROILER) {
      ProductionUnit unit =
          productionUnitRepository
              .findById(unitId)
              .orElseThrow(() -> NotFoundException.of("ProductionUnit", unitId));
      validateBroilerUnit(farmId, unit);
      livestockService.restockHeads(unitId, qty, null);
    } else {
      // EGGS
      eggTrayStockService.adjustStock(farmId, (int) qty, 0);
    }
  }

  // ── Recent activity feed (Task 3) ───────────────────────────────────────

  @Override
  @Transactional(readOnly = true)
  public List<ActivityItem> recentActivity(Long farmId, int limit) {
    Pageable page = PageRequest.of(0, limit);
    Stream<ActivityItem> events =
        lifecycleEventRepository
            .findRecentByFarmAndTypes(farmId, ACTIVITY_EVENT_TYPES, page)
            .stream()
            .map(LivestockFacadeImpl::lifecycleToActivity);
    Stream<ActivityItem> movements =
        stockMovementRepository
            .findByStockItem_FarmIdOrderByMovementDateDescIdDesc(farmId, page)
            .stream()
            .map(LivestockFacadeImpl::movementToActivity);
    return Stream.concat(events, movements)
        .sorted(
            Comparator.comparing(ActivityItem::at, Comparator.nullsLast(Comparator.naturalOrder()))
                .reversed())
        .limit(limit)
        .toList();
  }

  private static ActivityItem lifecycleToActivity(LifecycleEvent e) {
    String label =
        switch (e.getEventType()) {
          case "MORTALITY" -> "Mortalité : " + Math.abs(e.getQuantityDelta()) + " sujets";
          case "COUNT_ADJUSTMENT" -> "Ajustement d'effectif";
          case "VACCINATION_ADMINISTERED" -> "Vaccination";
          case "TREATMENT_ADMINISTERED" -> "Traitement administré";
          case "VET_VISIT_RECORDED" -> "Visite vétérinaire";
          case "DAILY_PRODUCTION_CLOSED" -> "Production journalière clôturée";
          case "CREATED" -> "Lot créé";
          case "HEALTH_OBSERVATION" -> "Observation sanitaire";
          default -> e.getEventType();
        };
    return new ActivityItem(e.getEventType(), e.getOccurredAt(), label, e.getReason());
  }

  private static ActivityItem movementToActivity(StockMovement m) {
    String article = m.getStockItem().getArticleKey();
    String kind =
        switch (m.getMovementType()) {
          case IN -> "STOCK_IN";
          case OUT -> "STOCK_OUT";
          case ADJUSTMENT -> "STOCK_ADJUSTMENT";
        };
    String label =
        switch (m.getMovementType()) {
          case IN -> "Entrée stock : " + article;
          case OUT -> "Sortie stock : " + article;
          case ADJUSTMENT -> "Ajustement stock : " + article;
        };
    return new ActivityItem(
        kind,
        m.getMovementDate().atStartOfDay(),
        label,
        m.getQuantity().toPlainString() + " unités");
  }

  /**
   * Validates that {@code unit} belongs to {@code farmId} and is a broiler lot (i.e. a {@link
   * PoultryBatch} subtype — discriminated via JPA JOINED subtype, not species alone, because layer
   * lots are plain {@code ProductionUnit} rows with {@code species=POULTRY} but no child row in
   * {@code poultry_batches}). Throws HTTP-422 on mismatch.
   */
  private void validateBroilerUnit(Long farmId, ProductionUnit unit) {
    if (!farmId.equals(unit.getFarmId())) {
      throw new BusinessRuleException(
          "PRODUCTION_UNIT_NOT_ON_FARM",
          "Unit " + unit.getId() + " does not belong to farm " + farmId);
    }
    if (!(unit instanceof PoultryBatch)) {
      throw new BusinessRuleException(
          "PRODUCTION_TYPE_MISMATCH", "BROILER requires a PoultryBatch (broiler) unit");
    }
  }

  private static ProductionUnitInfo toInfo(ProductionUnit u) {
    return new ProductionUnitInfo(
        u.getId(),
        u.getFarmId(),
        u.getSpecies(),
        u.getUnitKind(),
        u.getBreedId(),
        u.getName(),
        u.getCurrentCount(),
        u.getStatus());
  }
}
