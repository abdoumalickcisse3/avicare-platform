package com.avicare.admin.continuity;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.admin.domain.AdminAuditLog;
import com.avicare.admin.repository.AdminAuditLogRepository;
import com.avicare.admin.service.AdminAuditService;
import com.avicare.identity.domain.User;
import com.avicare.identity.repository.UserRepository;
import com.avicare.notification.api.WhatsAppOutboxFacade;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * The one alarm nobody else can raise. It has to fire when it matters and stay quiet the rest of
 * the time — an alert that arrives every hour is one the recipient mutes by the second day, and
 * then it protects nobody.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ContinuityWatchJobTest {

  private static final Long FOUNDER_ID = 1L;

  @Mock private AdminAuditLogRepository auditLog;
  @Mock private UserRepository users;
  @Mock private AdminAuditService auditService;
  @Mock private WhatsAppOutboxFacade whatsApp;

  private ContinuityWatchJob job;

  @BeforeEach
  void setUp() {
    job = new ContinuityWatchJob(auditLog, users, auditService, whatsApp);
    ReflectionTestUtils.setField(job, "enabled", true);
    ReflectionTestUtils.setField(job, "silenceHours", 72);
    ReflectionTestUtils.setField(job, "reAlertHours", 24);
    ReflectionTestUtils.setField(job, "founderEmail", "malick@jawdi.app");
    ReflectionTestUtils.setField(job, "emergencyPhone", "221700000000");

    User founder = new User();
    founder.setId(FOUNDER_ID);
    founder.setEmail("malick@jawdi.app");
    when(users.findByEmailIgnoreCase("malick@jawdi.app")).thenReturn(Optional.of(founder));
    when(auditLog.findTop30ByActionStartingWithOrderByCreatedAtDesc(anyString()))
        .thenReturn(List.of());
  }

  private void lastSeen(LocalDateTime when) {
    AdminAuditLog entry =
        new AdminAuditLog(FOUNDER_ID, "staff.login", "User", 1L, null, Map.of(), null, null);
    ReflectionTestUtils.setField(entry, "createdAt", when);
    Page<AdminAuditLog> page = new PageImpl<>(List.of(entry));
    when(auditLog.findByActorUserIdOrderByCreatedAtDesc(eq(FOUNDER_ID), any())).thenReturn(page);
  }

  private void lastAlert(LocalDateTime when) {
    AdminAuditLog entry =
        new AdminAuditLog(
            null, ContinuityWatchJob.SILENT_ACTION, "User", 1L, null, Map.of(), null, null);
    ReflectionTestUtils.setField(entry, "createdAt", when);
    when(auditLog.findTop30ByActionStartingWithOrderByCreatedAtDesc(
            ContinuityWatchJob.SILENT_ACTION))
        .thenReturn(List.of(entry));
  }

  @Test
  void staysQuietWhileTheOwnerIsAround() {
    lastSeen(LocalDateTime.now().minusHours(6));

    job.checkOwnerHeartbeat();

    verify(whatsApp, never()).enqueue(any(), any());
    verify(auditService, never()).record(any(), anyString(), any(), any(), any(), any());
  }

  @Test
  void staysQuietOneHourShortOfTheThreshold() {
    lastSeen(LocalDateTime.now().minusHours(71));

    job.checkOwnerHeartbeat();

    verify(whatsApp, never()).enqueue(any(), any());
  }

  @Test
  void warnsTheEmergencyContactAfterThreeDaysOfSilence() {
    lastSeen(LocalDateTime.now().minusHours(80));

    job.checkOwnerHeartbeat();

    verify(whatsApp).enqueue(eq("221700000000"), anyString());
    verify(auditService)
        .record(
            isNull(),
            eq(ContinuityWatchJob.SILENT_ACTION),
            eq("User"),
            eq(FOUNDER_ID),
            isNull(),
            any());
  }

  @Test
  void doesNotRepeatItselfEveryHour() {
    lastSeen(LocalDateTime.now().minusHours(80));
    lastAlert(LocalDateTime.now().minusHours(2));

    job.checkOwnerHeartbeat();

    // Already said two hours ago. Saying it again now is how an alert becomes background noise.
    verify(whatsApp, never()).enqueue(any(), any());
  }

  @Test
  void saysItAgainOnceTheSilenceHasLasted() {
    lastSeen(LocalDateTime.now().minusHours(120));
    lastAlert(LocalDateTime.now().minusHours(30));

    job.checkOwnerHeartbeat();

    verify(whatsApp).enqueue(eq("221700000000"), anyString());
  }

  @Test
  void recordsTheAlarmEvenWithNobodyToCall() {
    ReflectionTestUtils.setField(job, "emergencyPhone", "");
    lastSeen(LocalDateTime.now().minusHours(80));

    job.checkOwnerHeartbeat();

    // The trail is written whatever happens: an alarm that could not be delivered still has to be
    // findable afterwards.
    verify(auditService)
        .record(isNull(), eq(ContinuityWatchJob.SILENT_ACTION), any(), any(), any(), any());
    verify(whatsApp, never()).enqueue(any(), any());
  }

  @Test
  void ignoresAPlatformNobodyHasEverSignedInTo() {
    when(auditLog.findByActorUserIdOrderByCreatedAtDesc(eq(FOUNDER_ID), any()))
        .thenReturn(Page.empty());

    job.checkOwnerHeartbeat();

    // A fresh deployment is not a missing person.
    verify(whatsApp, never()).enqueue(any(), any());
  }

  @Test
  void doesNothingWhenNoFounderIsConfigured() {
    ReflectionTestUtils.setField(job, "founderEmail", "");

    job.checkOwnerHeartbeat();

    verify(users, never()).findByEmailIgnoreCase(any());
  }
}
