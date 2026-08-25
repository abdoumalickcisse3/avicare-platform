package com.avicare.partner.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.common.api.dto.ActivityItem;
import com.avicare.livestock.api.LivestockFacade;
import com.avicare.partner.api.PartnerFacade;
import com.avicare.partner.domain.AlertCategory;
import com.avicare.partner.domain.AlertSeverity;
import com.avicare.tenancy.api.TenancyFacade;
import com.avicare.tenancy.api.dto.FarmInfo;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class PartnerAlertScannerTest {

  private static final Long PARTNER_ID = 1L;
  private static final Long FARM_ID = 42L;

  @Mock PartnerService partnerService;
  @Mock PartnerFacade partnerFacade;
  @Mock PartnerAlertService alertService;
  @Mock LivestockFacade livestockFacade;
  @Mock TenancyFacade tenancyFacade;

  private PartnerAlertScanner scanner() {
    PartnerRiskEvaluator evaluator = new PartnerRiskEvaluator(livestockFacade);
    ReflectionTestUtils.setField(evaluator, "watchDays", 7);
    ReflectionTestUtils.setField(evaluator, "atRiskDays", 14);
    ReflectionTestUtils.setField(evaluator, "criticalDays", 30);
    return new PartnerAlertScanner(
        partnerService, partnerFacade, alertService, evaluator, tenancyFacade);
  }

  /** A network of one farm, sharing the given scopes, last active {@code daysAgo} days ago. */
  private void network(Set<String> scopes, Integer daysAgo) {
    when(partnerFacade.farmIdsInNetwork(PARTNER_ID)).thenReturn(List.of(FARM_ID));
    when(partnerFacade.sharedScopes(PARTNER_ID, FARM_ID)).thenReturn(scopes);
    if (daysAgo != null) {
      when(livestockFacade.recentActivity(FARM_ID, 1))
          .thenReturn(
              List.of(
                  new ActivityItem(
                      "MORTALITY", LocalDateTime.now().minusDays(daysAgo), "Mortalité", null)));
    }
  }

  private PartnerAlertCondition raised() {
    ArgumentCaptor<PartnerAlertCondition> captor =
        ArgumentCaptor.forClass(PartnerAlertCondition.class);
    verify(alertService).raise(eq(PARTNER_ID), eq(FARM_ID), captor.capture());
    return captor.getValue();
  }

  @Test
  void raisesAWarningWhenAFarmHasBeenSilentPastTheThreshold() {
    network(Set.of("activity"), 20);
    when(tenancyFacade.findById(FARM_ID))
        .thenReturn(new FarmInfo(FARM_ID, "Ferme A", "XOF", "Africa/Dakar", true));

    scanner().scanPartner(PARTNER_ID);

    PartnerAlertCondition condition = raised();
    assertThat(condition.category()).isEqualTo(AlertCategory.FARM_SILENT);
    assertThat(condition.severity()).isEqualTo(AlertSeverity.WARNING);
    assertThat(condition.dedupKey()).isEqualTo("FARM_SILENT:farm:42:WARNING");
    assertThat(condition.body()).contains("Ferme A").contains("20 jours");
  }

  @Test
  void escalatesToACriticalAlertUnderItsOwnKey() {
    network(Set.of("activity"), 31);
    when(tenancyFacade.findById(FARM_ID))
        .thenReturn(new FarmInfo(FARM_ID, "Ferme A", "XOF", "Africa/Dakar", true));

    scanner().scanPartner(PARTNER_ID);

    // A distinct key is what makes the escalation audible: the WARNING episode resolves and a new
    // CRITICAL alert is materialized, so exactly one further push goes out.
    assertThat(raised().severity()).isEqualTo(AlertSeverity.CRITICAL);
    assertThat(raised().dedupKey()).isEqualTo("FARM_SILENT:farm:42:CRITICAL");
  }

  @Test
  void raisesNothingForAFarmThatDoesNotShareItsActivity() {
    // The trust boundary: the farmer turned the activity slider off, so the silence is not
    // observable by this partner — no alert, no push, no count.
    network(Set.of("feed_consumption", "flock_health"), null);

    scanner().scanPartner(PARTNER_ID);

    verify(alertService, never()).raise(anyLong(), anyLong(), any());
    verify(livestockFacade, never()).recentActivity(anyLong(), anyInt());
  }

  @Test
  void raisesNothingWhileTheFarmIsMerelyWatched() {
    network(Set.of("activity"), 9); // WATCH: visible in the table, not worth a notification

    scanner().scanPartner(PARTNER_ID);

    verify(alertService, never()).raise(anyLong(), anyLong(), any());
  }

  @Test
  void raisesNothingWhenTheFarmHasNoRecordedActivityAtAll() {
    network(Set.of("activity"), null);
    when(livestockFacade.recentActivity(FARM_ID, 1)).thenReturn(List.of());

    scanner().scanPartner(PARTNER_ID);

    // Unmeasured is not the same as silent.
    verify(alertService, never()).raise(anyLong(), anyLong(), any());
  }

  @Test
  void resolvesTheEpisodeOnceTheFarmStartsEnteringAgain() {
    network(Set.of("activity"), 2);

    scanner().scanPartner(PARTNER_ID);

    verify(alertService, never()).raise(anyLong(), anyLong(), any());
    // No current key → the standing alert is reconciled away.
    verify(alertService)
        .resolveDisappeared(
            eq(PARTNER_ID), eq(AlertCategory.FARM_SILENT), eq(Set.of()), eq(List.of()));
  }

  @Test
  void keepsTheAlertOfAFarmWhoseScanBlewUp() {
    when(partnerFacade.farmIdsInNetwork(PARTNER_ID)).thenReturn(List.of(FARM_ID));
    when(partnerFacade.sharedScopes(PARTNER_ID, FARM_ID))
        .thenThrow(new IllegalStateException("membership vanished"));

    scanner().scanPartner(PARTNER_ID);

    ArgumentCaptor<Collection<Long>> skipped = ArgumentCaptor.captor();
    verify(alertService)
        .resolveDisappeared(
            eq(PARTNER_ID), eq(AlertCategory.FARM_SILENT), eq(Set.of()), skipped.capture());
    assertThat(skipped.getValue()).containsExactly(FARM_ID);
  }
}
