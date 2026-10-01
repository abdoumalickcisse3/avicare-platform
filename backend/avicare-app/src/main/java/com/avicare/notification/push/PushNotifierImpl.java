package com.avicare.notification.push;

import com.avicare.notification.domain.Notification;
import com.avicare.notification.domain.NotificationChannel;
import com.avicare.notification.domain.NotificationPreference;
import com.avicare.notification.push.ExpoPushSender.PushMessage;
import com.avicare.notification.push.ExpoPushSender.PushResult;
import com.avicare.notification.repository.NotificationPreferenceRepository;
import com.avicare.notification.service.PreferenceResolver;
import com.avicare.notification.service.PreferenceResolver.ResolvedPreference;
import com.avicare.tenancy.api.TenancyFacade;
import com.avicare.tenancy.api.dto.FarmInfo;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Pushes a freshly materialized notification to every farm member who opted in for the PUSH channel
 * at a severity it meets and who has an active device.
 *
 * <p>Recipients and payload are worked out immediately; the <em>sending</em> waits for the commit
 * of the surrounding transaction. The scan creates notifications inside one, and a rolled-back scan
 * must not have already buzzed a phone about something that never existed. There is no retry queue:
 * if Expo is unreachable the bell still holds the alert, and WhatsApp covers the urgent ones.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class PushNotifierImpl implements PushNotifier {

  private final TenancyFacade tenancyFacade;
  private final NotificationPreferenceRepository preferences;
  private final PreferenceResolver preferenceResolver;
  private final PushDeviceService devices;
  private final ExpoPushSender expo;

  @Value("${notifications.push.enabled:false}")
  private boolean pushEnabled;

  @Override
  public void notifyFor(Notification n) {
    if (!pushEnabled) {
      return;
    }
    try {
      List<PushMessage> messages = messagesFor(n);
      if (messages.isEmpty()) {
        return;
      }
      afterCommit(() -> deliver(messages));
    } catch (RuntimeException e) {
      log.warn("Push fan-out failed for notification {}: {}", n.getId(), e.getMessage(), e);
    }
  }

  private List<PushMessage> messagesFor(Notification n) {
    List<Long> recipients = new ArrayList<>();
    for (Long userId : tenancyFacade.listMemberUserIds(n.getFarmId())) {
      List<NotificationPreference> overrides =
          preferences.findByFarmIdAndUserId(n.getFarmId(), userId);
      ResolvedPreference pref =
          preferenceResolver.resolve(n.getCategory(), NotificationChannel.PUSH, overrides);
      if (pref.enabled() && n.getSeverity().atLeast(pref.minSeverity())) {
        recipients.add(userId);
      }
    }
    if (recipients.isEmpty()) {
      return List.of();
    }
    List<String> tokens = devices.activeTokensOf(recipients);
    if (tokens.isEmpty()) {
      return List.of();
    }
    String title = n.getTitle();
    String body = body(farmName(n.getFarmId()), n.getBody());
    Map<String, Object> data = new LinkedHashMap<>();
    data.put("notificationId", n.getId());
    data.put("farmId", n.getFarmId());
    data.put("sourceRef", n.getSourceRef());
    return tokens.stream().map(t -> new PushMessage(t, title, body, data)).toList();
  }

  /** Farm first, as on WhatsApp: a farmer may run more than one, and the lock screen is tiny. */
  private static String body(String farmName, String detail) {
    boolean hasDetail = detail != null && !detail.isBlank();
    if (farmName == null) {
      return hasDetail ? detail : "";
    }
    return hasDetail ? farmName + " · " + detail : farmName;
  }

  /** Unlike WhatsApp, an unnameable farm does not cancel the push: the title carries the news. */
  private String farmName(Long farmId) {
    try {
      FarmInfo farm = tenancyFacade.findById(farmId);
      return farm == null || farm.name() == null || farm.name().isBlank() ? null : farm.name();
    } catch (RuntimeException e) {
      return null;
    }
  }

  private void deliver(List<PushMessage> messages) {
    try {
      List<PushResult> results = expo.send(messages);
      List<String> dead = new ArrayList<>();
      for (int i = 0; i < results.size() && i < messages.size(); i++) {
        if (results.get(i).deviceNotRegistered()) {
          dead.add(messages.get(i).to());
        } else if (!results.get(i).ok()) {
          log.warn("Push not delivered: {}", results.get(i).error());
        }
      }
      if (!dead.isEmpty()) {
        devices.revoke(dead);
      }
    } catch (RuntimeException e) {
      log.warn("Push delivery failed: {}", e.getMessage(), e);
    }
  }

  private static void afterCommit(Runnable action) {
    if (!TransactionSynchronizationManager.isSynchronizationActive()) {
      action.run();
      return;
    }
    TransactionSynchronizationManager.registerSynchronization(
        new TransactionSynchronization() {
          @Override
          public void afterCommit() {
            action.run();
          }
        });
  }
}
