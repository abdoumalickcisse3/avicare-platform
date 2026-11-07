package com.avicare.livestock.poultry;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

import com.avicare.livestock.domain.Breed;
import com.avicare.livestock.domain.BreedProfile;
import com.avicare.livestock.domain.GrowthPerformance;
import com.avicare.livestock.domain.PoultryBatch;
import com.avicare.livestock.domain.WeighingSample;
import com.avicare.livestock.repository.BreedRepository;
import com.avicare.livestock.repository.DailyRecordRepository;
import com.avicare.livestock.repository.GrowthPerformanceRepository;
import com.avicare.livestock.repository.LifecycleEventRepository;
import com.avicare.livestock.repository.PoultryBatchRepository;
import com.avicare.livestock.repository.WeighingSampleRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.ObjectProvider;

/**
 * A rustic breed (Goliath, Kuroiler...) has no validated growth reference (spec §7.1): the platform
 * must not pretend to know how it should grow. No verdict, and no forecast delivery date — the
 * forecast leaves the farm through {@code LivestockFacadeImpl.cycleOf()} into {@code
 * BatchCycleInfo}, the delivery window shown to a feed supplier on the partner portal.
 */
class GrowthAnalysisRusticTest {

  private WeighingSampleRepository weighingSampleRepository;
  private GrowthPerformanceRepository growthPerformanceRepository;
  private PoultryBatchRepository poultryBatchRepository;
  private DailyRecordRepository dailyRecordRepository;
  private LifecycleEventRepository lifecycleEventRepository;
  private BreedRepository breedRepository;
  private GrowthAnalysisService service;

  @BeforeEach
  void setUp() {
    weighingSampleRepository = Mockito.mock(WeighingSampleRepository.class);
    growthPerformanceRepository = Mockito.mock(GrowthPerformanceRepository.class);
    poultryBatchRepository = Mockito.mock(PoultryBatchRepository.class);
    dailyRecordRepository = Mockito.mock(DailyRecordRepository.class);
    lifecycleEventRepository = Mockito.mock(LifecycleEventRepository.class);
    breedRepository = Mockito.mock(BreedRepository.class);
    @SuppressWarnings("unchecked")
    ObjectProvider<GrowthAnalysisService> self = Mockito.mock(ObjectProvider.class);
    service =
        new GrowthAnalysisService(
            weighingSampleRepository,
            growthPerformanceRepository,
            poultryBatchRepository,
            dailyRecordRepository,
            lifecycleEventRepository,
            breedRepository,
            self);

    lenient()
        .when(growthPerformanceRepository.findByPoultryBatchIdAndSnapshotDate(anyLong(), any()))
        .thenReturn(Optional.empty());
    lenient()
        .when(growthPerformanceRepository.save(any(GrowthPerformance.class)))
        .thenAnswer(inv -> inv.getArgument(0));
    lenient().when(lifecycleEventRepository.sumMortalityDelta(anyLong())).thenReturn(0L);
    lenient()
        .when(dailyRecordRepository.sumFeedKgUpTo(anyLong(), any()))
        .thenReturn(BigDecimal.ZERO);
    lenient()
        .when(dailyRecordRepository.sumWaterLUpTo(anyLong(), any()))
        .thenReturn(BigDecimal.ZERO);
  }

  /** A batch aiming at 2 kg on day 42, weighed today at {@code avgWeightG}, {@code ageDays} old. */
  private PoultryBatch batchWeighed(int ageDays, String avgWeightG, Long breedId) {
    PoultryBatch b = new PoultryBatch();
    b.setId(1L);
    b.setInitialCount(500);
    b.setCurrentCount(500);
    b.setStartDate(LocalDate.now().minusDays(ageDays));
    b.setTargetWeightG(2000);
    b.setTargetAgeDays(42);
    b.setBreedId(breedId);
    when(poultryBatchRepository.findById(1L)).thenReturn(Optional.of(b));

    WeighingSample s = new WeighingSample();
    s.setAvgWeightG(new BigDecimal(avgWeightG));
    when(weighingSampleRepository.findFirstByPoultryBatchIdOrderBySampleDateDesc(1L))
        .thenReturn(Optional.of(s));
    return b;
  }

  private void breedWithProfile(Long breedId, BreedProfile profile) {
    Breed breed = new Breed();
    breed.setId(breedId);
    breed.setProfile(profile);
    when(breedRepository.findById(breedId)).thenReturn(Optional.of(breed));
  }

  @Test
  void un_lot_rustique_ne_recoit_aucun_verdict() {
    batchWeighed(21, "700", 9L);
    breedWithProfile(9L, BreedProfile.BROILER_RUSTIC);

    GrowthPerformance perf = service.computePerformance(1L, LocalDate.now());

    assertThat(perf.getPerformanceScore()).isNull();
  }

  @Test
  void un_lot_rustique_ne_recoit_aucune_date_de_livraison_prevue() {
    // part au portail partenaire via BatchCycleInfo (LivestockFacadeImpl.cycleOf)
    batchWeighed(21, "700", 9L);
    breedWithProfile(9L, BreedProfile.BROILER_RUSTIC);

    GrowthPerformance perf = service.computePerformance(1L, LocalDate.now());

    assertThat(perf.getForecastedTargetDate()).isNull();
  }

  @Test
  void un_lot_a_croissance_rapide_garde_son_verdict_et_sa_date() {
    batchWeighed(7, "200", 9L);
    breedWithProfile(9L, BreedProfile.BROILER_FAST);

    GrowthPerformance perf = service.computePerformance(1L, LocalDate.now());

    assertThat(perf.getPerformanceScore()).isEqualTo(GrowthAnalysisService.SCORE_AHEAD);
    assertThat(perf.getForecastedTargetDate()).isNotNull();
  }

  @Test
  void une_souche_sans_profil_se_comporte_comme_avant() {
    // Breed exists but carries no profile (legacy row / non-poultry) -> unchanged behaviour.
    batchWeighed(7, "150", 9L);
    Breed breed = new Breed();
    breed.setId(9L);
    breed.setProfile(null);
    when(breedRepository.findById(9L)).thenReturn(Optional.of(breed));

    GrowthPerformance perf = service.computePerformance(1L, LocalDate.now());

    assertThat(perf.getPerformanceScore()).isEqualTo(GrowthAnalysisService.SCORE_ON_TARGET);
    assertThat(perf.getForecastedTargetDate()).isNotNull();
  }

  @Test
  void un_lot_sans_breed_id_se_comporte_comme_avant() {
    // No breedId at all on the batch (legacy data) -> unchanged behaviour, no breed lookup needed.
    batchWeighed(7, "150", null);

    GrowthPerformance perf = service.computePerformance(1L, LocalDate.now());

    assertThat(perf.getPerformanceScore()).isEqualTo(GrowthAnalysisService.SCORE_ON_TARGET);
    assertThat(perf.getForecastedTargetDate()).isNotNull();
  }
}
