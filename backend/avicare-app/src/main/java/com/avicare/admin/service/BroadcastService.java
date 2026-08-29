package com.avicare.admin.service;

import com.avicare.identity.domain.User;
import com.avicare.identity.repository.UserRepository;
import com.avicare.notification.api.WhatsAppOutboxFacade;
import com.avicare.tenancy.repository.FarmRepository;
import com.avicare.tenancy.repository.UserFarmRepository;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * WhatsApp campaigns to farms (console Phase 4).
 *
 * <p>Queued, never sent inline: the existing dispatcher already handles retries and the Konekt
 * client, and a campaign that sent synchronously would hold a request open for as many seconds as
 * there are recipients.
 *
 * <p>Recipients are deduplicated by phone number. One person managing three farms is one person,
 * and three copies of the same message is how a campaign becomes spam.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class BroadcastService {

  private final FarmRepository farms;
  private final UserFarmRepository memberships;
  private final UserRepository users;
  private final WhatsAppOutboxFacade outbox;
  private final AdminAuditService auditService;

  /** Phone number to the farm it was reached through — the shape the campaign then iterates. */
  @Transactional(readOnly = true)
  public Map<String, Long> recipients(List<Long> farmIds) {
    List<Long> targets =
        farmIds == null || farmIds.isEmpty() ? farms.findAllIds() : List.copyOf(farmIds);

    Map<String, Long> byPhone = new LinkedHashMap<>();
    for (Long farmId : targets) {
      for (var membership : memberships.findByFarmIdAndActiveTrue(farmId)) {
        users
            .findById(membership.getUserId())
            .filter(User::isActive)
            .map(User::getPhone)
            .filter(phone -> phone != null && !phone.isBlank())
            // putIfAbsent: the first farm that reaches a person is the one it is attributed to.
            .ifPresent(phone -> byPhone.putIfAbsent(phone, farmId));
      }
    }
    return byPhone;
  }

  /**
   * Queue the campaign.
   *
   * @return how many messages were queued
   */
  @Transactional
  public int send(String message, List<Long> farmIds) {
    Map<String, Long> targets = recipients(farmIds);
    targets.forEach((phone, farmId) -> outbox.enqueueBroadcast(phone, message, farmId));

    auditService.record(
        "broadcast.whatsapp.send",
        "Broadcast",
        null,
        null,
        Map.of(
            "recipients",
            targets.size(),
            "farms",
            farmIds == null ? List.of() : farmIds,
            // The text itself: a campaign nobody can read back is one nobody can be held to.
            "message",
            message));
    log.info("Broadcast queued for {} recipient(s)", targets.size());
    return targets.size();
  }
}
