package com.avicare.admin.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.avicare.admin.dto.response.FarmHealthRow;
import com.avicare.livestock.api.LivestockFacade;
import com.avicare.parameters.api.ParametersFacade;
import com.avicare.parameters.api.dto.CatalogEntryInfo;
import com.avicare.tenancy.api.TenancyFacade;
import com.avicare.tenancy.api.dto.FarmInfo;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class FarmHealthScoreServiceTest {

  @Mock TenancyFacade tenancyFacade;
  @Mock LivestockFacade livestockFacade;
  @Mock ParametersFacade parametersFacade;

  private FarmHealthScoreService service() {
    return new FarmHealthScoreService(tenancyFacade, livestockFacade, parametersFacade);
  }

  private FarmInfo farm(long id, String name) {
    return new FarmInfo(id, name, "XOF", "Africa/Dakar", true);
  }

  private void thresholds(int watchDays, int atRiskDays) {
    when(parametersFacade.listPlatform("admin"))
        .thenReturn(
            List.of(
                new CatalogEntryInfo(
                    "admin",
                    "health_score_thresholds",
                    Map.of("watch_days", watchDays, "at_risk_days", atRiskDays),
                    false)));
  }

  private void farms(List<FarmInfo> list, Map<Long, LocalDateTime> activity) {
    when(tenancyFacade.listAllFarms()).thenReturn(list);
    when(livestockFacade.lastActivityByFarm(any())).thenReturn(activity);
  }

  @Test
  void flagsAFarmThatWentQuietPastTheAtRiskThreshold() {
    thresholds(7, 21);
    farms(List.of(farm(1, "Ferme A")), Map.of(1L, LocalDateTime.now().minusDays(30)));

    List<FarmHealthRow> rows = service().farmsAtRisk();

    assertThat(rows)
        .singleElement()
        .satisfies(
            r -> {
              assertThat(r.level()).isEqualTo(FarmHealthRow.AT_RISK);
              assertThat(r.daysSinceLastEntry()).isEqualTo(30);
              // Support needs to know what to say when they call, not just a level.
              assertThat(r.reason()).contains("30 jours");
            });
  }

  @Test
  void treatsAFarmThatNeverRecordedAnythingAsItsOwnCase() {
    thresholds(7, 21);
    farms(List.of(farm(1, "Jamais démarrée")), Map.of());

    List<FarmHealthRow> rows = service().farmsAtRisk();

    assertThat(rows)
        .singleElement()
        .satisfies(
            r -> {
              assertThat(r.level()).isEqualTo(FarmHealthRow.AT_RISK);
              // Not "quiet for N days": it never started, which is a different conversation.
              assertThat(r.daysSinceLastEntry()).isNull();
              assertThat(r.reason()).contains("depuis la création");
            });
  }

  @Test
  void leavesActiveFarmsOutOfTheList() {
    thresholds(7, 21);
    farms(List.of(farm(1, "Active")), Map.of(1L, LocalDateTime.now().minusDays(1)));

    assertThat(service().farmsAtRisk()).isEmpty();
  }

  @Test
  void thresholdsComeFromTheCatalogAndNotFromConstants() {
    // The proof that nothing is hardcoded: the same farm changes level when the catalog changes.
    farms(List.of(farm(1, "Ferme A")), Map.of(1L, LocalDateTime.now().minusDays(10)));

    thresholds(7, 21);
    assertThat(service().farmsAtRisk())
        .singleElement()
        .satisfies(r -> assertThat(r.level()).isEqualTo(FarmHealthRow.WATCH));

    thresholds(3, 9);
    assertThat(service().farmsAtRisk())
        .singleElement()
        .satisfies(r -> assertThat(r.level()).isEqualTo(FarmHealthRow.AT_RISK));

    thresholds(30, 60);
    assertThat(service().farmsAtRisk()).isEmpty();
  }

  @Test
  void fallsBackToSaneDefaultsWhenTheCatalogEntryIsMissing() {
    when(parametersFacade.listPlatform("admin")).thenReturn(List.of());
    farms(List.of(farm(1, "Ferme A")), Map.of(1L, LocalDateTime.now().minusDays(30)));

    // A missing catalog row must not silently mark every farm healthy.
    assertThat(service().farmsAtRisk())
        .singleElement()
        .satisfies(r -> assertThat(r.level()).isEqualTo(FarmHealthRow.AT_RISK));
  }
}
