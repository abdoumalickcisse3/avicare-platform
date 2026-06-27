package com.avicare.livestock.service;

import com.avicare.common.api.dto.DayValue;
import com.avicare.livestock.api.LivestockFacade;
import com.avicare.livestock.api.dto.LivestockStats;
import com.avicare.livestock.api.dto.ProductionUnitInfo;
import com.avicare.livestock.domain.ProductionUnit;
import com.avicare.livestock.domain.UnitStatus;
import com.avicare.livestock.repository.DailyEggProductionRepository;
import com.avicare.livestock.repository.DailyRecordRepository;
import com.avicare.livestock.repository.LifecycleEventRepository;
import com.avicare.livestock.repository.ProductionUnitRepository;
import com.avicare.livestock.repository.TreatmentExecutedRepository;
import com.avicare.livestock.repository.VaccinationRepository;
import com.avicare.livestock.repository.WeighingSampleRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
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

  @Override
  public Optional<ProductionUnitInfo> findUnit(Long unitId) {
    return productionUnitRepository.findById(unitId).map(LivestockFacadeImpl::toInfo);
  }

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
        treatmentsCount);
  }

  private static ProductionUnitInfo toInfo(ProductionUnit u) {
    return new ProductionUnitInfo(
        u.getId(),
        u.getFarmId(),
        u.getSpecies(),
        u.getUnitKind(),
        u.getBreedId(),
        u.getCurrentCount(),
        u.getStatus());
  }
}
