package com.avicare.reporting.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.common.api.dto.DayValue;
import com.avicare.common.api.dto.NamedValue;
import com.avicare.livestock.commercial.CommercialFacade;
import com.avicare.livestock.commercial.dto.CommercialStats;
import com.avicare.reporting.domain.DashboardPeriod;
import com.avicare.subscription.api.SubscriptionFacade;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ReportingServiceTest {

  @Mock SubscriptionFacade subscriptionFacade;
  @Mock CommercialFacade commercialFacade;
  @InjectMocks ReportingService service;

  private static final DashboardPeriod P =
      DashboardPeriod.resolve("30d", null, null, LocalDate.of(2026, 6, 22));

  /** Fixture CommercialStats with known values for field-mapping assertions. */
  private static final CommercialStats STATS =
      new CommercialStats(
          500_000L,
          List.of(new DayValue(LocalDate.of(2026, 6, 1), 50_000L)),
          120_000L,
          30_000L,
          List.of(new NamedValue(1L, "Ferme Alpha", 200_000L)),
          List.of(new NamedValue(2L, "Ferme Beta", 30_000L)),
          3L,
          7L);

  @Test
  void commercial_active_populatesSectionAndCallsFacade() {
    when(subscriptionFacade.isModuleEnabled(1L, "module.commercial.basic")).thenReturn(true);
    when(subscriptionFacade.isModuleEnabled(1L, "module.inventory")).thenReturn(false);
    when(subscriptionFacade.isModuleEnabled(1L, "module.poultry.broiler")).thenReturn(false);
    when(subscriptionFacade.isModuleEnabled(1L, "module.poultry.layer")).thenReturn(false);
    when(commercialFacade.commercialStats(1L, P.from(), P.to())).thenReturn(STATS);

    var resp = service.buildDashboard(1L, P);

    assertThat(resp.commercial()).isNotNull();
    var c = resp.commercial();
    assertThat(c.revenueXof()).isEqualTo(500_000L);
    assertThat(c.revenueSeries()).hasSize(1);
    assertThat(c.revenueSeries().get(0).valueXof()).isEqualTo(50_000L);
    assertThat(c.outstandingXof()).isEqualTo(120_000L);
    assertThat(c.overdueXof()).isEqualTo(30_000L);
    assertThat(c.topClients()).hasSize(1);
    assertThat(c.topClients().get(0).name()).isEqualTo("Ferme Alpha");
    assertThat(c.topDebtors()).hasSize(1);
    assertThat(c.topDebtors().get(0).clientId()).isEqualTo(2L);
    assertThat(c.ordersToDeliver()).isEqualTo(3L);
    assertThat(c.invoicesToCollect()).isEqualTo(7L);

    verify(commercialFacade).commercialStats(1L, P.from(), P.to());

    assertThat(resp.inventory()).isNull();
    assertThat(resp.livestock()).isNull();
    assertThat(resp.period().value()).isEqualTo("30d");
  }

  @Test
  void commercial_inactive_sectionNullAndFacadeNotCalled() {
    when(subscriptionFacade.isModuleEnabled(1L, "module.commercial.basic")).thenReturn(false);
    when(subscriptionFacade.isModuleEnabled(1L, "module.inventory")).thenReturn(false);
    when(subscriptionFacade.isModuleEnabled(1L, "module.poultry.broiler")).thenReturn(false);
    when(subscriptionFacade.isModuleEnabled(1L, "module.poultry.layer")).thenReturn(false);

    var resp = service.buildDashboard(1L, P);

    assertThat(resp.commercial()).isNull();
    verify(commercialFacade, never()).commercialStats(1L, P.from(), P.to());
  }

  @Test
  void includesOnlyActiveModuleSections() {
    when(subscriptionFacade.isModuleEnabled(1L, "module.commercial.basic")).thenReturn(true);
    when(subscriptionFacade.isModuleEnabled(1L, "module.inventory")).thenReturn(false);
    when(subscriptionFacade.isModuleEnabled(1L, "module.poultry.broiler")).thenReturn(false);
    when(subscriptionFacade.isModuleEnabled(1L, "module.poultry.layer")).thenReturn(false);
    when(commercialFacade.commercialStats(1L, P.from(), P.to())).thenReturn(STATS);

    var resp = service.buildDashboard(1L, P);

    assertThat(resp.commercial()).isNotNull();
    assertThat(resp.inventory()).isNull();
    assertThat(resp.livestock()).isNull();
    assertThat(resp.period().value()).isEqualTo("30d");
  }
}
