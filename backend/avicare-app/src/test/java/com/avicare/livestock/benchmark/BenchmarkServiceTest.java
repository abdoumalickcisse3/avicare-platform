package com.avicare.livestock.benchmark;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.avicare.livestock.repository.DailyRecordRepository;
import com.avicare.livestock.repository.FarmTotal;
import com.avicare.livestock.repository.PoultryBatchRepository;
import com.avicare.parameters.api.ParametersFacade;
import com.avicare.parameters.api.dto.CatalogEntryInfo;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class BenchmarkServiceTest {

  @Mock DailyRecordRepository dailyRecords;
  @Mock PoultryBatchRepository batches;
  @Mock ParametersFacade parameters;

  @InjectMocks BenchmarkService service;

  private FarmTotal total(Long farmId, long value) {
    return new FarmTotal() {
      @Override
      public Long getFarmId() {
        return farmId;
      }

      @Override
      public long getTotal() {
        return value;
      }
    };
  }

  private void settings(boolean enabled, int minCohort) {
    when(parameters.listPlatform("admin"))
        .thenReturn(
            List.of(
                new CatalogEntryInfo(
                    "admin",
                    "benchmarks",
                    Map.of("enabled", enabled, "min_cohort", minCohort),
                    false)));
  }

  /** Five farms, each with a different mortality rate. */
  private void cohortOfFive() {
    when(batches.sumInitialCountByFarm())
        .thenReturn(
            List.of(
                total(1L, 1000),
                total(2L, 1000),
                total(3L, 1000),
                total(4L, 1000),
                total(5L, 1000)));
    when(dailyRecords.mortalityTotalsByFarm())
        .thenReturn(
            List.of(total(1L, 20), total(2L, 40), total(3L, 60), total(4L, 80), total(5L, 100)));
  }

  @Test
  void publishesNothingWhenTheFeatureIsOff() {
    settings(false, 5);
    cohortOfFive();

    BenchmarkService.Comparison result = service.comparison(1L);

    // A farm's mortality is its own business until the platform decides otherwise.
    assertThat(result.available()).isFalse();
    assertThat(result.platformMortalityRate()).isNull();
    assertThat(result.unavailableReason()).contains("pas activée");
  }

  @Test
  void publishesNothingBelowTheCohortFloor() {
    settings(true, 10);
    cohortOfFive();

    BenchmarkService.Comparison result = service.comparison(1L);

    // An average over a handful of farms lets any of them work out the others' figures.
    assertThat(result.available()).isFalse();
    assertThat(result.platformMortalityRate()).isNull();
    // The floor is named, so a farmer reads a privacy rule rather than a failure.
    assertThat(result.unavailableReason()).contains("10 fermes");
  }

  @Test
  void averagesTheFarmRatesRatherThanPoolingTheBirds() {
    settings(true, 5);
    // Farm 1 is tiny and clean, farm 2 is huge and worse. Pooling would drown farm 1.
    when(batches.sumInitialCountByFarm())
        .thenReturn(
            List.of(
                total(1L, 100), total(2L, 100000), total(3L, 100), total(4L, 100), total(5L, 100)));
    when(dailyRecords.mortalityTotalsByFarm())
        .thenReturn(
            List.of(total(1L, 1), total(2L, 10000), total(3L, 1), total(4L, 1), total(5L, 1)));

    BigDecimal platform = service.comparison(null).platformMortalityRate();

    // Mean of farm rates: (1 + 10 + 1 + 1 + 1) / 5 = 2.80. Pooling would give ~9.97.
    assertThat(platform).isEqualByComparingTo("2.80");
  }

  @Test
  void reportsTheAskingFarmAlongsideTheAverage() {
    settings(true, 5);
    cohortOfFive();

    BenchmarkService.Comparison result = service.comparison(3L);

    assertThat(result.available()).isTrue();
    assertThat(result.farmMortalityRate()).isEqualByComparingTo("6.00");
    assertThat(result.platformMortalityRate()).isEqualByComparingTo("6.00");
    assertThat(result.cohortSize()).isEqualTo(5);
  }

  @Test
  void givesTheConsoleTheAverageWithoutAnyFarmAttached() {
    settings(true, 5);
    cohortOfFive();

    BenchmarkService.Comparison result = service.comparison(null);

    assertThat(result.platformMortalityRate()).isNotNull();
    assertThat(result.farmMortalityRate()).isNull();
  }

  @Test
  void leavesOutFarmsThatHaveNoBirdsPlaced() {
    settings(true, 2);
    when(batches.sumInitialCountByFarm()).thenReturn(List.of(total(1L, 1000), total(2L, 500)));
    // Farm 9 recorded deaths but placed nothing — a data artefact, not a 900% mortality rate.
    when(dailyRecords.mortalityTotalsByFarm())
        .thenReturn(List.of(total(1L, 50), total(2L, 50), total(9L, 9)));

    assertThat(service.ratesByFarm()).containsOnlyKeys(1L, 2L);
  }

  @Test
  void fallsBackToASafeFloorWhenTheSettingIsMissingOrAbsurd() {
    when(parameters.listPlatform("admin")).thenReturn(List.of());

    // No row at all: off, and the floor still defends the cohort if it is ever switched on.
    assertThat(service.settings().enabled()).isFalse();
    assertThat(service.settings().minCohort()).isEqualTo(BenchmarkService.DEFAULT_MIN_COHORT);

    when(parameters.listPlatform("admin"))
        .thenReturn(
            List.of(
                new CatalogEntryInfo(
                    "admin", "benchmarks", Map.of("enabled", true, "min_cohort", 0), false)));

    // A zero floor would publish an "average" of one farm — refused in favour of the default.
    assertThat(service.settings().minCohort()).isEqualTo(BenchmarkService.DEFAULT_MIN_COHORT);
  }
}
