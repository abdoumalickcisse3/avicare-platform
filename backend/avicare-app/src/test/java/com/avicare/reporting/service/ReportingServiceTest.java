package com.avicare.reporting.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.avicare.reporting.domain.DashboardPeriod;
import com.avicare.subscription.api.SubscriptionFacade;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ReportingServiceTest {

  @Mock SubscriptionFacade subscriptionFacade;
  @InjectMocks ReportingService service;

  private static final DashboardPeriod P =
      DashboardPeriod.resolve("30d", null, null, LocalDate.of(2026, 6, 22));

  @Test
  void includesOnlyActiveModuleSections() {
    when(subscriptionFacade.isModuleEnabled(1L, "module.commercial.basic")).thenReturn(true);
    when(subscriptionFacade.isModuleEnabled(1L, "module.inventory")).thenReturn(false);
    // élevage : aucun module poultry actif
    when(subscriptionFacade.isModuleEnabled(1L, "module.poultry.broiler")).thenReturn(false);
    when(subscriptionFacade.isModuleEnabled(1L, "module.poultry.layer")).thenReturn(false);
    var resp = service.buildDashboard(1L, P);
    assertThat(resp.commercial()).isNotNull();
    assertThat(resp.inventory()).isNull();
    assertThat(resp.livestock()).isNull();
    assertThat(resp.period().value()).isEqualTo("30d");
  }
}
