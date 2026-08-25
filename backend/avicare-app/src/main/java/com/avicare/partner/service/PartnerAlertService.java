package com.avicare.partner.service;

import com.avicare.notification.api.WhatsAppOutboxFacade;
import com.avicare.partner.domain.AlertCategory;
import com.avicare.partner.domain.AlertSeverity;
import com.avicare.partner.domain.AlertStatus;
import com.avicare.partner.domain.Partner;
import com.avicare.partner.domain.PartnerAlert;
import com.avicare.partner.repository.PartnerAlertRepository;
import com.avicare.tenancy.api.TenancyFacade;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Materializes partner alerts and keeps them in sync with reality (couche « Garder »).
 *
 * <p>{@link #raise} is idempotent on {@code (partnerId, dedupKey)} while the alert is ACTIVE — the
 * daily scan can run any number of times without duplicating anything, and <b>the WhatsApp push
 * happens only on the first materialization</b>, never on a repeat.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PartnerAlertService {

  private final PartnerAlertRepository alertRepository;
  private final PartnerService partnerService;
  private final TenancyFacade tenancyFacade;
  private final WhatsAppOutboxFacade whatsAppOutboxFacade;

  /** Create the alert if this episode is not already open; return the open one either way. */
  @Transactional
  public PartnerAlert raise(Long partnerId, Long farmId, PartnerAlertCondition c) {
    return alertRepository
        .findByPartnerIdAndDedupKeyAndStatus(partnerId, c.dedupKey(), AlertStatus.ACTIVE)
        .orElseGet(() -> create(partnerId, farmId, c));
  }

  /**
   * A farm left the network — a one-off fact the partner is entitled to know (it lost a member),
   * not a data point about the farm's operations. Never reconciled by the scan: the departure does
   * not stop being true. Best-effort: a farmer leaving must never fail because of an alert.
   */
  @Transactional
  public void raiseFarmLeft(Long partnerId, Long farmId) {
    try {
      String farmName = tenancyFacade.findById(farmId).name();
      raise(
          partnerId,
          farmId,
          new PartnerAlertCondition(
              AlertCategory.FARM_LEFT,
              AlertSeverity.CRITICAL,
              "FARM_LEFT:farm:" + farmId,
              "Départ du réseau : " + farmName,
              "« " + farmName + " » a quitté votre réseau."));
    } catch (RuntimeException e) {
      log.warn(
          "Could not raise the FARM_LEFT alert for partner {} farm {}: {}",
          partnerId,
          farmId,
          e.getMessage());
    }
  }

  /**
   * Close the ACTIVE alerts of {@code category} whose condition is no longer reported, which
   * re-arms their dedup key for a future episode. Farms in {@code skippedFarmIds} are left
   * untouched: they were not evaluated this round, so their silence is unknown, not over.
   */
  @Transactional
  public void resolveDisappeared(
      Long partnerId,
      AlertCategory category,
      Set<String> currentKeys,
      Collection<Long> skippedFarmIds) {
    for (PartnerAlert alert :
        alertRepository.findByPartnerIdAndCategoryAndStatus(
            partnerId, category, AlertStatus.ACTIVE)) {
      if (currentKeys.contains(alert.getDedupKey()) || skippedFarmIds.contains(alert.getFarmId())) {
        continue;
      }
      alert.setStatus(AlertStatus.RESOLVED);
      alert.setResolvedAt(LocalDateTime.now());
      alertRepository.save(alert);
    }
  }

  @Transactional(readOnly = true)
  public List<PartnerAlert> listActive(Long partnerId) {
    return alertRepository.findByPartnerIdAndStatusOrderByCreatedAtDesc(
        partnerId, AlertStatus.ACTIVE);
  }

  private PartnerAlert create(Long partnerId, Long farmId, PartnerAlertCondition c) {
    PartnerAlert alert = new PartnerAlert();
    alert.setPartnerId(partnerId);
    alert.setFarmId(farmId);
    alert.setCategory(c.category());
    alert.setSeverity(c.severity());
    alert.setTitle(c.title());
    alert.setBody(c.body());
    alert.setDedupKey(c.dedupKey());
    alert.setStatus(AlertStatus.ACTIVE);
    PartnerAlert saved = alertRepository.save(alert);
    push(partnerId, c);
    return saved;
  }

  /** Best-effort WhatsApp fan-out to the partner's contact number; never breaks the transaction. */
  private void push(Long partnerId, PartnerAlertCondition c) {
    try {
      Partner partner = partnerService.get(partnerId);
      whatsAppOutboxFacade.enqueue(partner.getContactPhone(), render(c));
    } catch (RuntimeException e) {
      log.warn("Could not queue the WhatsApp push for partner {}: {}", partnerId, e.getMessage());
    }
  }

  private static String render(PartnerAlertCondition c) {
    return c.body() == null || c.body().isBlank() ? c.title() : c.title() + "\n" + c.body();
  }
}
