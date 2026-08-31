package com.avicare.subscription.flags;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import org.assertj.core.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * The switch itself: what blocks, what stops blocking on its own, and the one thing that must never
 * happen — a flag table that cannot be read taking the platform down with it.
 */
@ExtendWith(MockitoExtension.class)
class FeatureFlagServiceTest {

  @Mock private FeatureFlagRepository repository;
  @Mock private FlagChangeRecorder recorder;

  private FeatureFlagService service;

  @BeforeEach
  void setUp() {
    service = new FeatureFlagService(repository, recorder);
    ReflectionTestUtils.setField(service, "flagsEnabled", true);
  }

  private static FeatureFlag flag(String key) {
    FeatureFlag flag = new FeatureFlag();
    flag.setFlagKey(key);
    return flag;
  }

  @Test
  void blocksNothingWhenNoSwitchIsThrown() {
    when(repository.findAll()).thenReturn(List.of(flag("module.inventory")));

    assertThat(service.isBlocked("module.inventory")).isFalse();
  }

  @Test
  void blocksAFeatureUnderAnActiveCut() {
    FeatureFlag cut = flag("module.inventory");
    cut.setKillswitchActive(true);
    cut.setKillswitchReason("comptage faux");
    cut.setKillswitchExpiresAt(LocalDateTime.now().plusMinutes(30));
    when(repository.findAll()).thenReturn(List.of(cut));

    assertThat(service.isBlocked("module.inventory")).isTrue();
    assertThat(service.reasonFor("module.inventory")).isEqualTo("comptage faux");
  }

  @Test
  void stopsBlockingTheMomentTheWindowLapses() {
    FeatureFlag lapsed = flag("module.inventory");
    lapsed.setKillswitchActive(true);
    lapsed.setKillswitchExpiresAt(LocalDateTime.now().minusSeconds(1));
    when(repository.findAll()).thenReturn(List.of(lapsed));

    // The row still says "active"; the window is what decides, so the sweep is tidy-up rather than
    // the mechanism. A cut outliving its window by five minutes would be an outage we chose.
    assertThat(service.isBlocked("module.inventory")).isFalse();
  }

  @Test
  void blocksWhatIsSwitchedOffGlobally() {
    FeatureFlag off = flag("module.qr_codes");
    off.setEnabledGlobally(false);
    when(repository.findAll()).thenReturn(List.of(off));

    assertThat(service.isBlocked("module.qr_codes")).isTrue();
    assertThat(service.reasonFor("module.qr_codes")).isNull();
  }

  @Test
  void failsOpenWhenTheFlagTableCannotBeRead() {
    when(repository.findAll()).thenThrow(new RuntimeException("db down"));

    // A kill switch that causes outages is worse than the bug it was built to contain.
    assertThat(service.isBlocked("module.inventory")).isFalse();
  }

  @Test
  void servesEverythingWhenTheMechanismIsTurnedOff() {
    ReflectionTestUtils.setField(service, "flagsEnabled", false);

    assertThat(service.isBlocked("module.inventory")).isFalse();
    verify(repository, never()).findAll();
  }

  @Test
  void aCutIsRecordedAsUrgentAndExpiresInThirtyMinutes() {
    FeatureFlag target = flag("module.inventory");
    when(repository.findByFlagKey("module.inventory")).thenReturn(Optional.of(target));
    when(repository.findAll()).thenReturn(List.of(target));

    FeatureFlag cut = service.activateKillswitch("module.inventory", "comptage faux", 7L);

    assertThat(cut.isKillswitchActive()).isTrue();
    assertThat(cut.getKillswitchBy()).isEqualTo(7L);
    Assertions.assertThat(cut.getKillswitchExpiresAt())
        .isCloseTo(LocalDateTime.now().plusMinutes(30), Assertions.within(5, ChronoUnit.SECONDS));
    verify(recorder).record("module.inventory", "killswitch", 7L, "comptage faux", true);
  }

  @Test
  void aCutTakesEffectWithoutWaitingForTheCache() {
    FeatureFlag target = flag("module.inventory");
    when(repository.findByFlagKey("module.inventory")).thenReturn(Optional.of(target));
    when(repository.findAll()).thenReturn(List.of(target));
    // Warm the cache on the un-cut state first.
    assertThat(service.isBlocked("module.inventory")).isFalse();

    service.activateKillswitch("module.inventory", "urgence", 7L);

    assertThat(service.isBlocked("module.inventory")).isTrue();
  }

  @Test
  void theSweepLiftsLapsedCutsAndSaysSoWithNoUserBehindIt() {
    FeatureFlag lapsed = flag("module.finance");
    lapsed.setKillswitchActive(true);
    lapsed.setKillswitchReason("doublons");
    lapsed.setKillswitchExpiresAt(LocalDateTime.now().minusMinutes(1));
    when(repository.findByKillswitchActiveTrueAndKillswitchExpiresAtBefore(any()))
        .thenReturn(List.of(lapsed));
    when(repository.findAll()).thenReturn(List.of(lapsed));

    service.sweepExpiredKillswitches();

    assertThat(lapsed.isKillswitchActive()).isFalse();
    assertThat(lapsed.getKillswitchReason()).isNull();
    verify(recorder)
        .record(eq("module.finance"), eq("killswitch.expire"), isNull(), isNull(), eq(true));
  }

  @Test
  void liftingACutIsAlsoWorthTellingStaffAbout() {
    FeatureFlag cut = flag("module.inventory");
    cut.setKillswitchActive(true);
    when(repository.findByFlagKey("module.inventory")).thenReturn(Optional.of(cut));
    when(repository.findAll()).thenReturn(List.of(cut));

    service.deactivateKillswitch("module.inventory", 9L);

    assertThat(cut.isKillswitchActive()).isFalse();
    verify(recorder).record("module.inventory", "killswitch.lift", 9L, null, true);
  }

  @Test
  void theStandingSwitchIsNotAnEmergency() {
    FeatureFlag target = flag("module.qr_codes");
    when(repository.findByFlagKey("module.qr_codes")).thenReturn(Optional.of(target));
    when(repository.findAll()).thenReturn(List.of(target));

    service.setEnabledGlobally("module.qr_codes", false, 3L);

    // No reason, no expiry, and nobody woken up.
    verify(recorder).record("module.qr_codes", "global.disable", 3L, null, false);
    verify(recorder, never()).record(any(), any(), any(), any(), eq(true));
  }
}
