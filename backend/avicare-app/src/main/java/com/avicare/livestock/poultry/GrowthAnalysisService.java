package com.avicare.livestock.poultry;

import com.avicare.common.api.exception.NotFoundException;
import com.avicare.common.api.exception.ValidationException;
import com.avicare.livestock.domain.GrowthPerformance;
import com.avicare.livestock.domain.PoultryBatch;
import com.avicare.livestock.domain.WeighingSample;
import com.avicare.livestock.repository.DailyRecordRepository;
import com.avicare.livestock.repository.GrowthPerformanceRepository;
import com.avicare.livestock.repository.LifecycleEventRepository;
import com.avicare.livestock.repository.PoultryBatchRepository;
import com.avicare.livestock.repository.WeighingSampleRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Broiler growth analysis (Sprint B1-2): records sample weighings (deriving avg/min/max/std and
 * uniformity) and recomputes a {@link GrowthPerformance} snapshot — GMQ (ADG), FCR (IC), cumulative
 * mortality/feed/water, a linear maturity forecast and a target score.
 *
 * <p>V1 simplifications (validated): GMQ is cumulative ({@code weight / age}); FCR is {@code total
 * feed / total live weight}; uniformity is the share of birds within ±10% of the mean.
 *
 * <p>The target curve is {@link BroilerGrowthCurve} — the published broiler growth shape, scaled
 * between a day-old chick ({@value #DAY_OLD_CHICK_WEIGHT_G} g) and the batch's {@code
 * target_weight_g} at {@code target_age_days}. It was a straight line until 2026-09-05, which
 * over-demanded early and scored healthy batches BEHIND for their first fortnight.
 */
@Service
@RequiredArgsConstructor
public class GrowthAnalysisService {

  static final int DAY_OLD_CHICK_WEIGHT_G = 40;
  private static final BigDecimal UNIFORMITY_BAND = new BigDecimal("0.10");

  public static final String SCORE_AHEAD = "AHEAD";
  public static final String SCORE_ON_TARGET = "ON_TARGET";
  public static final String SCORE_BEHIND = "BEHIND";

  private final WeighingSampleRepository weighingSampleRepository;
  private final GrowthPerformanceRepository growthPerformanceRepository;
  private final PoultryBatchRepository poultryBatchRepository;
  private final DailyRecordRepository dailyRecordRepository;
  private final LifecycleEventRepository lifecycleEventRepository;

  // Self-reference resolved lazily through the Spring proxy so that self.getObject().insertX(...)
  // actually goes through AOP (REQUIRES_NEW). ObjectProvider defers the lookup, so it does not
  // trigger a "bean currently in creation" circular-dependency error at startup.
  private final ObjectProvider<GrowthAnalysisService> self;

  @Transactional
  public WeighingSample recordWeighing(Long batchId, WeighingCommand cmd, Long userId) {
    return recordWeighing(batchId, cmd, userId, null);
  }

  /**
   * Record a sample weighing with an optional mobile replay key (doc 08 §9): if {@code clientRef}
   * is non-null and already recorded, the original sample is returned instead of inserting a
   * duplicate — the short-circuit sits before the statistics computation and the performance
   * recompute. Web callers pass {@code null} and keep the append-only behavior.
   *
   * <p>Concurrency: two replays of the same {@code clientRef} can both miss the {@code
   * findByClientRef} lookup below and both attempt the insert; the partial unique index {@code
   * uq_weighing_samples_client_ref} lets exactly one of them win. The loser's insert is isolated in
   * {@link #insertWeighing}, its own {@code REQUIRES_NEW} transaction, so its rollback does not
   * poison this method's transaction (a constraint violation inside the SAME transaction would
   * abort the underlying Postgres transaction, making a same-transaction recovery read fail too).
   * Once the inner transaction has rolled back, the recovery read here runs in this (still healthy)
   * transaction and is guaranteed to see the winner's row: Postgres blocks the losing INSERT/UPDATE
   * on the unique index until the winner's transaction finishes, so by the time we observe the
   * exception the winner has already committed.
   */
  @Transactional
  public WeighingSample recordWeighing(
      Long batchId, WeighingCommand cmd, Long userId, UUID clientRef) {
    if (clientRef == null) {
      // No replay key: plain call (not through the proxy) simply joins this transaction, which is
      // exactly what append-only web writes want.
      return insertWeighing(batchId, cmd, userId, null);
    }
    Optional<WeighingSample> existing = weighingSampleRepository.findByClientRef(clientRef);
    if (existing.isPresent()) {
      return existing.get();
    }
    try {
      // Must go through the proxy (self.getObject()) for REQUIRES_NEW to actually apply — a plain
      // this.insertWeighing(...) call bypasses AOP and would run in this same transaction.
      return self.getObject().insertWeighing(batchId, cmd, userId, clientRef);
    } catch (DataIntegrityViolationException raced) {
      return weighingSampleRepository.findByClientRef(clientRef).orElseThrow(() -> raced);
    }
  }

  /**
   * Isolated in its own transaction so that a {@code client_ref} unique-constraint violation only
   * rolls back this insert (and the performance recompute it triggers), never the caller's
   * transaction. See {@link #recordWeighing} for why this must be invoked through the Spring proxy.
   */
  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public WeighingSample insertWeighing(
      Long batchId, WeighingCommand cmd, Long userId, UUID clientRef) {
    PoultryBatch batch = loadBatch(batchId);
    List<Integer> weights = cmd.individualWeights();
    if (weights == null || weights.isEmpty()) {
      throw new ValidationException("EMPTY_WEIGHING", "A weighing needs at least one weight");
    }

    int n = weights.size();
    double sum = 0;
    int min = weights.get(0);
    int max = weights.get(0);
    for (int w : weights) {
      sum += w;
      min = Math.min(min, w);
      max = Math.max(max, w);
    }
    double mean = sum / n;
    double variance = 0;
    for (int w : weights) {
      variance += (w - mean) * (w - mean);
    }
    variance /= n;
    double std = Math.sqrt(variance);

    double band = mean * 0.10;
    long within = weights.stream().filter(w -> Math.abs(w - mean) <= band).count();
    double uniformity = (within * 100.0) / n;

    int ageDays = ageDays(batch, cmd.sampleDate());

    WeighingSample sample = new WeighingSample();
    sample.setPoultryBatchId(batchId);
    sample.setSampleDate(cmd.sampleDate());
    sample.setAgeDays(ageDays);
    sample.setSampleSize(n);
    sample.setIndividualWeights(weights);
    sample.setAvgWeightG(scaled(mean, 3));
    sample.setMinWeightG(scaled(min, 3));
    sample.setMaxWeightG(scaled(max, 3));
    sample.setStdDeviation(scaled(std, 3));
    sample.setUniformityPercent(scaled(uniformity, 2));
    sample.setNotes(cmd.notes());
    sample.setRecordedBy(userId);
    sample.setClientRef(clientRef);
    WeighingSample saved = weighingSampleRepository.save(sample);

    computePerformance(batch, cmd.sampleDate());
    return saved;
  }

  /** Recompute (upsert) the performance snapshot for the batch on the given date. */
  @Transactional
  public GrowthPerformance computePerformance(Long batchId, LocalDate date) {
    return computePerformance(loadBatch(batchId), date);
  }

  private GrowthPerformance computePerformance(PoultryBatch batch, LocalDate date) {
    Long batchId = batch.getId();
    int ageDays = ageDays(batch, date);

    BigDecimal currentWeightG =
        weighingSampleRepository
            .findFirstByPoultryBatchIdOrderBySampleDateDesc(batchId)
            .map(WeighingSample::getAvgWeightG)
            .orElse(null);

    BigDecimal cumulativeFeedKg = dailyRecordRepository.sumFeedKgUpTo(batchId, date);
    BigDecimal cumulativeWaterL = dailyRecordRepository.sumWaterLUpTo(batchId, date);

    GrowthPerformance perf =
        growthPerformanceRepository
            .findByPoultryBatchIdAndSnapshotDate(batchId, date)
            .orElseGet(GrowthPerformance::new);
    perf.setPoultryBatchId(batchId);
    perf.setSnapshotDate(date);
    perf.setAgeDays(ageDays);
    perf.setCurrentWeightG(currentWeightG);
    perf.setCumulativeFeedKg(cumulativeFeedKg);
    perf.setCumulativeWaterL(cumulativeWaterL);
    perf.setCumulativeMortalityPercent(mortalityPercent(batch));
    perf.setGmqGPerDay(gmq(currentWeightG, ageDays));
    // Birds produced alive, not what is left in the pen: current_count shrinks with every sale,
    // which would shrink the live weight the feed actually built and inflate the ratio.
    long liveBirds = batch.getInitialCount() + lifecycleEventRepository.sumMortalityDelta(batchId);
    perf.setFeedConversionRatio(fcr(cumulativeFeedKg, currentWeightG, (int) liveBirds));
    perf.setForecastedTargetDate(forecast(batch, currentWeightG, date));
    perf.setPerformanceScore(score(batch, currentWeightG, ageDays));
    perf.setComputedAt(java.time.LocalDateTime.now());
    return growthPerformanceRepository.save(perf);
  }

  @Transactional(readOnly = true)
  public List<WeighingSample> listWeighings(Long batchId) {
    return weighingSampleRepository.findByPoultryBatchIdOrderBySampleDateDesc(batchId);
  }

  @Transactional(readOnly = true)
  public GrowthPerformance getLatestPerformance(Long batchId) {
    return growthPerformanceRepository
        .findFirstByPoultryBatchIdOrderBySnapshotDateDesc(batchId)
        .orElseThrow(() -> NotFoundException.of("GrowthPerformance", batchId));
  }

  // --- helpers --------------------------------------------------------

  private PoultryBatch loadBatch(Long batchId) {
    return poultryBatchRepository
        .findById(batchId)
        .orElseThrow(() -> NotFoundException.of("PoultryBatch", batchId));
  }

  private static int ageDays(PoultryBatch batch, LocalDate date) {
    return (int) Math.max(0, ChronoUnit.DAYS.between(batch.getStartDate(), date));
  }

  /**
   * Real deaths over the initial headcount. Reads the MORTALITY ledger: a bird that was sold left
   * the batch just as a dead one did, but it is not a loss.
   */
  private BigDecimal mortalityPercent(PoultryBatch batch) {
    int initial = batch.getInitialCount();
    if (initial <= 0) {
      return null;
    }
    long deaths = -lifecycleEventRepository.sumMortalityDelta(batch.getId());
    return scaled(deaths * 100.0 / initial, 2);
  }

  private static BigDecimal gmq(BigDecimal currentWeightG, int ageDays) {
    if (currentWeightG == null || ageDays <= 0) {
      return null;
    }
    return currentWeightG.divide(BigDecimal.valueOf(ageDays), 3, RoundingMode.HALF_UP);
  }

  /** FCR = total feed (kg) / total live weight (kg). */
  private static BigDecimal fcr(BigDecimal feedKg, BigDecimal currentWeightG, int currentCount) {
    if (feedKg == null || currentWeightG == null || currentCount <= 0) {
      return null;
    }
    BigDecimal liveWeightKg =
        currentWeightG
            .divide(BigDecimal.valueOf(1000), 6, RoundingMode.HALF_UP)
            .multiply(BigDecimal.valueOf(currentCount));
    if (liveWeightKg.signum() == 0) {
      return null;
    }
    return feedKg.divide(liveWeightKg, 3, RoundingMode.HALF_UP);
  }

  /** Expected weight (g) at a given age, on the broiler growth shape scaled to the batch target. */
  private static Double targetWeightAt(PoultryBatch batch, int ageDays) {
    Integer targetWeight = batch.getTargetWeightG();
    Integer targetAge = batch.getTargetAgeDays();
    if (targetWeight == null || targetAge == null) {
      return null;
    }
    return BroilerGrowthCurve.weightAt(targetWeight, targetAge, ageDays, DAY_OLD_CHICK_WEIGHT_G);
  }

  private static String score(PoultryBatch batch, BigDecimal currentWeightG, int ageDays) {
    Double target = targetWeightAt(batch, ageDays);
    if (currentWeightG == null || target == null || target <= 0) {
      return null;
    }
    double ratio = currentWeightG.doubleValue() / target;
    if (ratio > 1.05) {
      return SCORE_AHEAD;
    }
    return ratio >= 0.95 ? SCORE_ON_TARGET : SCORE_BEHIND;
  }

  /** Project the date the batch reaches its target weight, from the current GMQ. */
  private static LocalDate forecast(PoultryBatch batch, BigDecimal currentWeightG, LocalDate date) {
    Integer targetWeight = batch.getTargetWeightG();
    int ageDays = ageDays(batch, date);
    BigDecimal gmq = gmq(currentWeightG, ageDays);
    if (targetWeight == null || currentWeightG == null || gmq == null || gmq.signum() <= 0) {
      return null;
    }
    if (currentWeightG.doubleValue() >= targetWeight) {
      return date; // already reached
    }
    double daysLeft = (targetWeight - currentWeightG.doubleValue()) / gmq.doubleValue();
    return date.plusDays((long) Math.ceil(daysLeft));
  }

  private static BigDecimal scaled(double value, int scale) {
    return BigDecimal.valueOf(value).setScale(scale, RoundingMode.HALF_UP);
  }
}
