package com.avicare.notification.push;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.notification.domain.Notification;
import com.avicare.notification.domain.NotificationCategory;
import com.avicare.notification.domain.NotificationChannel;
import com.avicare.notification.domain.NotificationPreference;
import com.avicare.notification.domain.NotificationSeverity;
import com.avicare.notification.push.ExpoPushSender.PushMessage;
import com.avicare.notification.push.ExpoPushSender.PushResult;
import com.avicare.notification.repository.NotificationPreferenceRepository;
import com.avicare.notification.service.PreferenceResolver;
import com.avicare.tenancy.api.TenancyFacade;
import com.avicare.tenancy.api.dto.FarmInfo;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@ExtendWith(MockitoExtension.class)
class PushNotifierTest {

  @Mock TenancyFacade tenancyFacade;
  @Mock NotificationPreferenceRepository preferences;
  @Mock PushDeviceService devices;
  @Mock ExpoPushSender expo;
  @Captor ArgumentCaptor<List<PushMessage>> sent;

  @AfterEach
  void clearSynchronization() {
    if (TransactionSynchronizationManager.isSynchronizationActive()) {
      TransactionSynchronizationManager.clearSynchronization();
    }
  }

  private PushNotifierImpl notifier(boolean enabled) {
    PushNotifierImpl n =
        new PushNotifierImpl(tenancyFacade, preferences, new PreferenceResolver(), devices, expo);
    ReflectionTestUtils.setField(n, "pushEnabled", enabled);
    return n;
  }

  private Notification notification(NotificationCategory c, NotificationSeverity s) {
    Notification n = new Notification();
    n.setId(5L);
    n.setFarmId(1L);
    n.setCategory(c);
    n.setSeverity(s);
    n.setTitle("Stock bas : Maïs");
    n.setBody("12 kg restants");
    n.setSourceRef(Map.of("itemId", 42L));
    return n;
  }

  private Notification lowStock() {
    return notification(NotificationCategory.LOW_STOCK, NotificationSeverity.WARNING);
  }

  private void farmIsNamed() {
    when(tenancyFacade.findById(1L)).thenReturn(new FarmInfo(1L, "Ferme Test", "XOF", "UTC", true));
  }

  private void memberWithDevice(long userId, String token) {
    when(tenancyFacade.listMemberUserIds(1L)).thenReturn(List.of(userId));
    when(preferences.findByFarmIdAndUserId(1L, userId)).thenReturn(List.of());
    when(devices.activeTokensOf(List.of(userId))).thenReturn(List.of(token));
  }

  @Test
  void sendsToTheActiveDevicesOfMembersWhoAreOptedInByDefault() {
    farmIsNamed();
    memberWithDevice(10L, "ExponentPushToken[a]");
    when(expo.send(anyCollection())).thenReturn(List.of(new PushResult(true, false, null)));

    notifier(true).notifyFor(lowStock());

    verify(expo).send(sent.capture());
    assertThat(sent.getValue()).hasSize(1);
    PushMessage m = sent.getValue().get(0);
    assertThat(m.to()).isEqualTo("ExponentPushToken[a]");
    assertThat(m.title()).isEqualTo("Stock bas : Maïs");
    assertThat(m.body()).isEqualTo("Ferme Test · 12 kg restants");
    assertThat(m.data())
        .containsEntry("notificationId", 5L)
        .containsEntry("farmId", 1L)
        .containsEntry("sourceRef", Map.of("itemId", 42L));
  }

  @Test
  void stillSendsWhenTheFarmCannotBeNamed() {
    when(tenancyFacade.findById(1L)).thenThrow(new IllegalStateException("gone"));
    memberWithDevice(10L, "ExponentPushToken[a]");
    when(expo.send(anyCollection())).thenReturn(List.of(new PushResult(true, false, null)));

    notifier(true).notifyFor(lowStock());

    verify(expo).send(sent.capture());
    assertThat(sent.getValue().get(0).body()).isEqualTo("12 kg restants");
  }

  @Test
  void doesNothingWhenPushIsDisabled() {
    notifier(false).notifyFor(lowStock());
    verify(expo, never()).send(any());
  }

  @Test
  void skipsAMemberWhoSwitchedPushOff() {
    NotificationPreference off = new NotificationPreference();
    off.setCategory(NotificationCategory.LOW_STOCK);
    off.setChannel(NotificationChannel.PUSH);
    off.setEnabled(false);
    off.setMinSeverity(NotificationSeverity.INFO);
    when(tenancyFacade.listMemberUserIds(1L)).thenReturn(List.of(10L));
    when(preferences.findByFarmIdAndUserId(1L, 10L)).thenReturn(List.of(off));

    notifier(true).notifyFor(lowStock());

    verify(expo, never()).send(any());
  }

  /** The desk floor for push is WARNING: an INFO-level overdue order does not buzz a phone. */
  @Test
  void skipsAMemberWhenTheSeverityIsUnderTheirFloor() {
    when(tenancyFacade.listMemberUserIds(1L)).thenReturn(List.of(10L));
    when(preferences.findByFarmIdAndUserId(1L, 10L)).thenReturn(List.of());

    notifier(true)
        .notifyFor(notification(NotificationCategory.PO_OVERDUE, NotificationSeverity.INFO));

    verify(expo, never()).send(any());
  }

  @Test
  void doesNotCallExpoWhenNobodyHasADevice() {
    when(tenancyFacade.listMemberUserIds(1L)).thenReturn(List.of(10L));
    when(preferences.findByFarmIdAndUserId(1L, 10L)).thenReturn(List.of());
    when(devices.activeTokensOf(List.of(10L))).thenReturn(List.of());

    notifier(true).notifyFor(lowStock());

    verify(expo, never()).send(any());
  }

  @Test
  void revokesTokensExpoReportsAsNotRegistered() {
    farmIsNamed();
    memberWithDevice(10L, "ExponentPushToken[dead]");
    when(expo.send(anyCollection())).thenReturn(List.of(new PushResult(false, true, "gone")));

    notifier(true).notifyFor(lowStock());

    verify(devices).revoke(List.of("ExponentPushToken[dead]"));
  }

  @Test
  void aFailedSendDoesNotRevokeAndNeverThrows() {
    farmIsNamed();
    memberWithDevice(10L, "ExponentPushToken[a]");
    when(expo.send(anyCollection())).thenReturn(List.of(new PushResult(false, false, "HTTP 500")));

    notifier(true).notifyFor(lowStock());

    verify(devices, never()).revoke(any());
  }

  @Test
  void aThrowingSenderNeverBreaksTheScan() {
    farmIsNamed();
    memberWithDevice(10L, "ExponentPushToken[a]");
    when(expo.send(anyCollection())).thenThrow(new IllegalStateException("boom"));

    notifier(true).notifyFor(lowStock());
  }

  /** The scan wraps this in a transaction: nothing may leave the building before it commits. */
  @Test
  void sendsOnlyAfterTheSurroundingTransactionCommits() {
    farmIsNamed();
    memberWithDevice(10L, "ExponentPushToken[a]");
    when(expo.send(anyCollection())).thenReturn(List.of(new PushResult(true, false, null)));
    TransactionSynchronizationManager.initSynchronization();

    notifier(true).notifyFor(lowStock());

    verify(expo, never()).send(any());
    TransactionSynchronizationManager.getSynchronizations()
        .forEach(TransactionSynchronization::afterCommit);
    verify(expo).send(any());
  }
}
