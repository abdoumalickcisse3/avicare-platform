package com.avicare.threat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.threat.domain.BlockedIp;
import com.avicare.threat.domain.SecurityEvent;
import com.avicare.threat.domain.SecurityEventType;
import com.avicare.threat.domain.ThreatSeverity;
import com.avicare.threat.repository.BlockedIpRepository;
import com.avicare.threat.repository.SecurityEventRepository;
import com.avicare.threat.service.ThreatAlerter;
import com.avicare.threat.service.ThreatDetectionService;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * When the door gets shut, and — just as important — when it does not. Every false block is a
 * farmer locked out of their own records, so the threshold has to hold.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ThreatDetectionServiceTest {

  private static final String IP = "41.82.10.5";

  @Mock private SecurityEventRepository events;
  @Mock private BlockedIpRepository blockedIps;
  @Mock private ThreatAlerter alerter;

  private ThreatDetectionService service;

  @BeforeEach
  void setUp() {
    service = new ThreatDetectionService(events, blockedIps, alerter);
    ReflectionTestUtils.setField(service, "maxFailures", 5);
    ReflectionTestUtils.setField(service, "windowMinutes", 15);
    ReflectionTestUtils.setField(service, "blockMinutes", 60);
    ReflectionTestUtils.setField(service, "maxSignupsPerHour", 3);
    when(blockedIps.findByBlockedUntilAfterOrderByBlockedAtDesc(any())).thenReturn(List.of());
    when(blockedIps.findById(anyString())).thenReturn(Optional.empty());
  }

  @Test
  void aWrongPasswordIsJustRecorded() {
    when(events.countRecent(eq(IP), eq(SecurityEventType.FAILED_LOGIN), any())).thenReturn(0L);

    service.recordFailedLogin(IP, "eleveur@ferme.sn", "curl/8");

    verify(blockedIps, never()).save(any());
    assertThat(savedEvent().getSeverity()).isEqualTo(ThreatSeverity.INFO);
    assertThat(savedEvent().getEmail()).isEqualTo("eleveur@ferme.sn");
  }

  @Test
  void staysOpenOneAttemptShortOfTheThreshold() {
    // Four failures already, this is the fifth-from-last: a person mistyping twice on a bad line
    // must not be locked out of their own farm.
    when(events.countRecent(eq(IP), eq(SecurityEventType.FAILED_LOGIN), any())).thenReturn(3L);

    service.recordFailedLogin(IP, "eleveur@ferme.sn", null);

    verify(blockedIps, never()).save(any());
    verify(alerter, never()).criticalThreat(any(), any(), any());
  }

  @Test
  void shutsTheDoorAtTheThresholdAndTellsSomeone() {
    when(events.countRecent(eq(IP), eq(SecurityEventType.FAILED_LOGIN), any())).thenReturn(4L);

    service.recordFailedLogin(IP, "eleveur@ferme.sn", null);

    ArgumentCaptor<BlockedIp> blocked = ArgumentCaptor.forClass(BlockedIp.class);
    verify(blockedIps).save(blocked.capture());
    assertThat(blocked.getValue().getIpAddress()).isEqualTo(IP);
    assertThat(blocked.getValue().getBlockedBy()).isEqualTo("AUTO_BRUTEFORCE");
    // Bounded: a whole town can share one operator NAT.
    assertThat(blocked.getValue().getBlockedUntil()).isAfter(LocalDateTime.now());
    assertThat(blocked.getValue().getBlockedUntil()).isBefore(LocalDateTime.now().plusHours(2));
    verify(alerter).criticalThreat(any(), eq(IP), eq("eleveur@ferme.sn"));
  }

  @Test
  void doesNotBlockTwiceOverTheSameBurst() {
    BlockedIp existing = new BlockedIp();
    existing.setIpAddress(IP);
    existing.setBlockedUntil(LocalDateTime.now().plusMinutes(30));
    when(blockedIps.findByBlockedUntilAfterOrderByBlockedAtDesc(any()))
        .thenReturn(List.of(existing));
    when(events.countRecent(eq(IP), eq(SecurityEventType.FAILED_LOGIN), any())).thenReturn(20L);

    service.recordFailedLogin(IP, "eleveur@ferme.sn", null);

    verify(alerter, never()).criticalThreat(any(), any(), any());
  }

  @Test
  void recordsARateLimitHitAtMostOncePerMinute() {
    service.recordRateLimitExceeded(IP, "/api/v1/auth/login");
    service.recordRateLimitExceeded(IP, "/api/v1/auth/login");
    service.recordRateLimitExceeded(IP, "/api/v1/auth/login");

    // Under an actual flood, one row per rejected request is how the incident becomes two.
    verify(events).save(any());
  }

  @Test
  void saysNothingAboutAnOrdinarySignup() {
    when(events.countRecent(eq(IP), eq(SecurityEventType.SIGNUP_ANOMALY), any())).thenReturn(0L);

    service.recordSignup(IP, "nouvelle@ferme.sn");

    verify(events, never()).save(any());
  }

  @Test
  void flagsSignupsComingInBursts() {
    when(events.countRecent(eq(IP), eq(SecurityEventType.SIGNUP_ANOMALY), any())).thenReturn(2L);

    service.recordSignup(IP, "encore@ferme.sn");

    assertThat(savedEvent().getEventType()).isEqualTo(SecurityEventType.SIGNUP_ANOMALY);
    assertThat(savedEvent().getSeverity()).isEqualTo(ThreatSeverity.WARNING);
    // Never an automatic block: a cooperative signing up its members shares one connection.
    verify(blockedIps, never()).save(any());
  }

  @Test
  void letsEveryoneThroughWhenTheBlockListCannotBeRead() {
    when(blockedIps.findByBlockedUntilAfterOrderByBlockedAtDesc(any()))
        .thenThrow(new RuntimeException("db down"));

    assertThat(service.isBlocked(IP)).isFalse();
  }

  @Test
  void aManualBlockIsAttributedAndAnnounced() {
    service.block(IP, "scraping", "malick@jawdi.app", Duration.ofMinutes(30));

    ArgumentCaptor<BlockedIp> blocked = ArgumentCaptor.forClass(BlockedIp.class);
    verify(blockedIps).save(blocked.capture());
    assertThat(blocked.getValue().getBlockedBy()).isEqualTo("malick@jawdi.app");
    verify(alerter).ipBlockChanged(IP, true, "scraping", "malick@jawdi.app");
  }

  @Test
  void releasingAnAddressIsTracedToo() {
    service.unblock(IP, "malick@jawdi.app", "faux positif");

    verify(blockedIps).deleteById(IP);
    verify(alerter).ipBlockChanged(IP, false, "faux positif", "malick@jawdi.app");
  }

  private SecurityEvent savedEvent() {
    ArgumentCaptor<SecurityEvent> captor = ArgumentCaptor.forClass(SecurityEvent.class);
    verify(events, org.mockito.Mockito.atLeastOnce()).save(captor.capture());
    return captor.getValue();
  }
}
