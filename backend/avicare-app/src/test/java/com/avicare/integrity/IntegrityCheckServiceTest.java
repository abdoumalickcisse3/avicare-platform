package com.avicare.integrity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.integrity.check.FindingCandidate;
import com.avicare.integrity.check.IntegrityCheck;
import com.avicare.integrity.domain.IntegrityFinding;
import com.avicare.integrity.domain.Severity;
import com.avicare.integrity.repository.IntegrityFindingRepository;
import com.avicare.integrity.service.IntegrityAlerter;
import com.avicare.integrity.service.IntegrityCheckService;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * The bookkeeping around the checks — the part that decides whether the console stays readable: one
 * row per claim, closed when it clears, and a broken check that does not take the others down.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class IntegrityCheckServiceTest {

  @Mock private IntegrityFindingRepository repository;
  @Mock private IntegrityAlerter alerter;

  /** A check that reports whatever it is handed, or explodes. */
  private static IntegrityCheck check(
      String key, RuntimeException boom, FindingCandidate... found) {
    return new IntegrityCheck() {
      @Override
      public String key() {
        return key;
      }

      @Override
      public String label() {
        return "Contrôle " + key;
      }

      @Override
      public Severity severity() {
        return Severity.CRITICAL;
      }

      @Override
      public List<FindingCandidate> run(LocalDateTime graceCutoff) {
        if (boom != null) {
          throw boom;
        }
        return List.of(found);
      }
    };
  }

  private static FindingCandidate candidate(long id, String actual) {
    return new FindingCandidate("client", id, 8L, "700000", actual, Map.of());
  }

  private IntegrityCheckService service(IntegrityCheck... checks) {
    IntegrityCheckService service = new IntegrityCheckService(List.of(checks), repository, alerter);
    ReflectionTestUtils.setField(service, "graceMinutes", 15);
    return service;
  }

  @Test
  void opensAFindingTheFirstTimeAndUpdatesItAfterwards() {
    IntegrityCheckService service = service(check("client_balance", null, candidate(3, "999999")));
    when(repository.findByCheckKeyAndEntityTypeAndEntityIdAndResolvedAtIsNull(any(), any(), any()))
        .thenReturn(Optional.empty());
    when(repository.findByCheckKeyAndResolvedAtIsNull(any())).thenReturn(List.of());

    assertThat(service.runAllChecks().opened()).isEqualTo(1);
    verify(repository).save(any(IntegrityFinding.class));

    // Second night, same defect: the row is refreshed, not duplicated — otherwise one unfixed bug
    // buries the console in a week.
    IntegrityFinding existing = finding("client_balance", "client", 3L);
    when(repository.findByCheckKeyAndEntityTypeAndEntityIdAndResolvedAtIsNull(
            "client_balance", "client", 3L))
        .thenReturn(Optional.of(existing));
    when(repository.findByCheckKeyAndResolvedAtIsNull("client_balance"))
        .thenReturn(List.of(existing));

    IntegrityCheckService.SweepReport second =
        service(check("client_balance", null, candidate(3, "888888"))).runAllChecks();

    assertThat(second.opened()).isZero();
    assertThat(second.stillOpen()).isEqualTo(1);
    assertThat(existing.getActualValue()).isEqualTo("888888");
  }

  @Test
  void closesAFindingWhoseConditionNoLongerHolds() {
    IntegrityFinding stale = finding("client_balance", "client", 3L);
    when(repository.findByCheckKeyAndResolvedAtIsNull("client_balance")).thenReturn(List.of(stale));

    // The check reports nothing this time.
    IntegrityCheckService.SweepReport report =
        service(check("client_balance", null)).runAllChecks();

    assertThat(report.resolved()).isEqualTo(1);
    assertThat(stale.isOpen()).isFalse();
    assertThat(stale.getResolutionAction()).isEqualTo("auto_resolved");
    // Nobody is credited with a fix that happened on its own.
    assertThat(stale.getResolvedBy()).isNull();
  }

  @Test
  void oneBrokenCheckDoesNotStopTheOthers() {
    when(repository.findByCheckKeyAndEntityTypeAndEntityIdAndResolvedAtIsNull(any(), any(), any()))
        .thenReturn(Optional.empty());
    when(repository.findByCheckKeyAndResolvedAtIsNull(any())).thenReturn(List.of());

    IntegrityCheckService.SweepReport report =
        service(
                check("broken", new IllegalStateException("bad SQL")),
                check("client_balance", null, candidate(3, "999999")))
            .runAllChecks();

    assertThat(report.failed()).isEqualTo(1);
    assertThat(report.opened()).isEqualTo(1);
  }

  @Test
  void tellsTheOnCallAboutACriticalOnceAndOnlyOnce() {
    IntegrityFinding fresh = finding("client_balance", "client", 3L);
    when(repository.findBySeverityAndResolvedAtIsNullAndNotifiedAtIsNull(Severity.CRITICAL))
        .thenReturn(List.of(fresh));
    IntegrityCheckService service = service(check("client_balance", null));

    assertThat(service.notifyNewCriticals()).isEqualTo(1);

    verify(alerter).criticalFound("client_balance", "Contrôle client_balance", "client", 3L, 8L);
    // Stamped, so the next sweep leaves it alone: an alert that repeats is an alert people ignore.
    assertThat(fresh.getNotifiedAt()).isNotNull();
  }

  @Test
  void aQuietNightSaysNothing() {
    when(repository.findBySeverityAndResolvedAtIsNullAndNotifiedAtIsNull(Severity.CRITICAL))
        .thenReturn(List.of());

    assertThat(service(check("client_balance", null)).notifyNewCriticals()).isZero();

    verify(alerter, never()).criticalFound(any(), any(), any(), any(), any());
  }

  private static IntegrityFinding finding(String checkKey, String entityType, Long entityId) {
    IntegrityFinding finding = new IntegrityFinding();
    finding.setCheckKey(checkKey);
    finding.setSeverity(Severity.CRITICAL);
    finding.setEntityType(entityType);
    finding.setEntityId(entityId);
    finding.setFarmId(8L);
    return finding;
  }
}
