package com.avicare.partner.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.notification.api.WhatsAppOutboxFacade;
import com.avicare.partner.domain.AlertCategory;
import com.avicare.partner.domain.AlertSeverity;
import com.avicare.partner.domain.AlertStatus;
import com.avicare.partner.domain.Partner;
import com.avicare.partner.domain.PartnerAlert;
import com.avicare.partner.repository.PartnerAlertRepository;
import com.avicare.tenancy.api.TenancyFacade;
import com.avicare.tenancy.api.dto.FarmInfo;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PartnerAlertServiceTest {

  private static final Long PARTNER_ID = 1L;
  private static final Long FARM_ID = 42L;
  private static final String KEY = "FARM_SILENT:farm:42:WARNING";

  @Mock PartnerAlertRepository alertRepository;
  @Mock PartnerService partnerService;
  @Mock TenancyFacade tenancyFacade;
  @Mock WhatsAppOutboxFacade whatsAppOutboxFacade;

  private PartnerAlertService service() {
    return new PartnerAlertService(
        alertRepository, partnerService, tenancyFacade, whatsAppOutboxFacade);
  }

  private PartnerAlertCondition condition() {
    return new PartnerAlertCondition(
        AlertCategory.FARM_SILENT,
        AlertSeverity.WARNING,
        KEY,
        "Éleveur silencieux : Ferme A",
        "« Ferme A » n'a rien saisi depuis 20 jours.");
  }

  private PartnerAlert existing(String dedupKey, Long farmId) {
    PartnerAlert a = new PartnerAlert();
    a.setPartnerId(PARTNER_ID);
    a.setFarmId(farmId);
    a.setCategory(AlertCategory.FARM_SILENT);
    a.setSeverity(AlertSeverity.WARNING);
    a.setDedupKey(dedupKey);
    a.setStatus(AlertStatus.ACTIVE);
    return a;
  }

  private Partner partnerWithPhone(String phone) {
    Partner p = new Partner();
    p.setId(PARTNER_ID);
    p.setName("Provende du Sahel");
    p.setContactPhone(phone);
    return p;
  }

  @Test
  void materializesTheAlertAndPushesOnceOnFirstSight() {
    when(alertRepository.findByPartnerIdAndDedupKeyAndStatus(PARTNER_ID, KEY, AlertStatus.ACTIVE))
        .thenReturn(Optional.empty());
    when(alertRepository.save(any())).thenAnswer(i -> i.getArgument(0));
    when(partnerService.get(PARTNER_ID)).thenReturn(partnerWithPhone("770000001"));

    service().raise(PARTNER_ID, FARM_ID, condition());

    verify(alertRepository).save(any(PartnerAlert.class));
    verify(whatsAppOutboxFacade)
        .enqueue(
            "770000001",
            "Éleveur silencieux : Ferme A\n« Ferme A » n'a rien saisi depuis 20 jours.");
  }

  @Test
  void doesNotPushAgainWhileTheSameEpisodeIsOpen() {
    when(alertRepository.findByPartnerIdAndDedupKeyAndStatus(PARTNER_ID, KEY, AlertStatus.ACTIVE))
        .thenReturn(Optional.of(existing(KEY, FARM_ID)));

    service().raise(PARTNER_ID, FARM_ID, condition());

    // The daily re-scan must be free of side effects.
    verify(alertRepository, never()).save(any());
    verify(whatsAppOutboxFacade, never()).enqueue(anyString(), anyString());
  }

  @Test
  void aFailingPushNeverBreaksTheAlert() {
    when(alertRepository.findByPartnerIdAndDedupKeyAndStatus(PARTNER_ID, KEY, AlertStatus.ACTIVE))
        .thenReturn(Optional.empty());
    when(alertRepository.save(any())).thenAnswer(i -> i.getArgument(0));
    when(partnerService.get(PARTNER_ID)).thenThrow(new IllegalStateException("partner gone"));

    PartnerAlert raised = service().raise(PARTNER_ID, FARM_ID, condition());

    assertThat(raised.getDedupKey()).isEqualTo(KEY);
    verify(alertRepository).save(any(PartnerAlert.class));
  }

  @Test
  void raisesACriticalAlertWhenAFarmLeavesTheNetwork() {
    when(tenancyFacade.findById(FARM_ID))
        .thenReturn(new FarmInfo(FARM_ID, "Ferme A", "XOF", "Africa/Dakar", true));
    when(alertRepository.findByPartnerIdAndDedupKeyAndStatus(
            PARTNER_ID, "FARM_LEFT:farm:42", AlertStatus.ACTIVE))
        .thenReturn(Optional.empty());
    when(alertRepository.save(any())).thenAnswer(i -> i.getArgument(0));
    when(partnerService.get(PARTNER_ID)).thenReturn(partnerWithPhone("770000001"));

    service().raiseFarmLeft(PARTNER_ID, FARM_ID);

    ArgumentCaptor<PartnerAlert> saved = ArgumentCaptor.captor();
    verify(alertRepository).save(saved.capture());
    assertThat(saved.getValue().getCategory()).isEqualTo(AlertCategory.FARM_LEFT);
    assertThat(saved.getValue().getSeverity()).isEqualTo(AlertSeverity.CRITICAL);
    assertThat(saved.getValue().getBody()).contains("Ferme A");
  }

  @Test
  void aFarmLeavingIsNeverBlockedByABrokenAlert() {
    when(tenancyFacade.findById(FARM_ID)).thenThrow(new IllegalStateException("farm gone"));

    // The farmer's right to leave outranks the partner's right to be told about it.
    service().raiseFarmLeft(PARTNER_ID, FARM_ID);

    verify(alertRepository, never()).save(any());
  }

  @Test
  void resolvesTheAlertsWhoseConditionIsGone() {
    PartnerAlert gone = existing("FARM_SILENT:farm:42:WARNING", FARM_ID);
    PartnerAlert stillTrue = existing("FARM_SILENT:farm:43:WARNING", 43L);
    when(alertRepository.findByPartnerIdAndCategoryAndStatus(
            PARTNER_ID, AlertCategory.FARM_SILENT, AlertStatus.ACTIVE))
        .thenReturn(List.of(gone, stillTrue));

    service()
        .resolveDisappeared(
            PARTNER_ID,
            AlertCategory.FARM_SILENT,
            Set.of("FARM_SILENT:farm:43:WARNING"),
            List.of());

    assertThat(gone.getStatus()).isEqualTo(AlertStatus.RESOLVED);
    assertThat(gone.getResolvedAt()).isNotNull();
    assertThat(stillTrue.getStatus()).isEqualTo(AlertStatus.ACTIVE);
    verify(alertRepository).save(gone);
    verify(alertRepository, never()).save(stillTrue);
  }

  @Test
  void leavesAlertsOfFarmsThatCouldNotBeEvaluated() {
    PartnerAlert skipped = existing(KEY, FARM_ID);
    when(alertRepository.findByPartnerIdAndCategoryAndStatus(
            PARTNER_ID, AlertCategory.FARM_SILENT, AlertStatus.ACTIVE))
        .thenReturn(List.of(skipped));

    // The farm blew up mid-scan: its silence is unknown, not over.
    service().resolveDisappeared(PARTNER_ID, AlertCategory.FARM_SILENT, Set.of(), List.of(FARM_ID));

    assertThat(skipped.getStatus()).isEqualTo(AlertStatus.ACTIVE);
    verify(alertRepository, never()).save(any());
  }
}
