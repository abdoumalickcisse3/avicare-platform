package com.avicare.reporting.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.common.api.dto.DayValue;
import com.avicare.common.api.dto.NamedValue;
import com.avicare.common.security.access.FarmAccessChecker;
import com.avicare.livestock.api.LivestockFacade;
import com.avicare.livestock.api.dto.LivestockStats;
import com.avicare.livestock.commercial.CommercialFacade;
import com.avicare.livestock.commercial.dto.CommercialStats;
import com.avicare.reporting.api.dto.DashboardResponse;
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
  @Mock LivestockFacade livestockFacade;
  @Mock FarmAccessChecker farmAccess;
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

  /**
   * Fixture LivestockStats with known values. mortalityRate is null to verify nullable
   * pass-through.
   */
  private static final LivestockStats LIVESTOCK_STATS =
      new LivestockStats(
          4L,
          2800L,
          35L,
          null, // mortalityRate null — proves nullable pass-through
          List.of(new DayValue(LocalDate.of(2026, 6, 10), 5L)),
          52.3,
          null, // layingRate null (broiler batch, no laying data)
          List.of(),
          6L,
          3L);

  @Test
  void commercial_active_populatesSectionAndCallsFacade() {
    when(subscriptionFacade.isModuleEnabled(1L, "module.commercial.basic")).thenReturn(true);
    when(subscriptionFacade.isModuleEnabled(1L, "module.inventory")).thenReturn(false);
    when(subscriptionFacade.isModuleEnabled(1L, "module.poultry.broiler")).thenReturn(false);
    when(subscriptionFacade.isModuleEnabled(1L, "module.poultry.layer")).thenReturn(false);
    when(farmAccess.hasAnyPermission(1L, "commercial:read", "finance:read")).thenReturn(true);
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
    when(farmAccess.hasAnyPermission(1L, "commercial:read", "finance:read")).thenReturn(true);
    when(commercialFacade.commercialStats(1L, P.from(), P.to())).thenReturn(STATS);

    var resp = service.buildDashboard(1L, P);

    assertThat(resp.commercial()).isNotNull();
    assertThat(resp.inventory()).isNull();
    assertThat(resp.livestock()).isNull();
    assertThat(resp.period().value()).isEqualTo("30d");
  }

  @Test
  void livestock_active_broilerEnabled_populatesSectionAndCallsFacade() {
    when(subscriptionFacade.isModuleEnabled(1L, "module.commercial.basic")).thenReturn(false);
    when(subscriptionFacade.isModuleEnabled(1L, "module.inventory")).thenReturn(false);
    // broiler=true short-circuits the || so layer is never evaluated — do not stub layer
    when(subscriptionFacade.isModuleEnabled(1L, "module.poultry.broiler")).thenReturn(true);
    when(farmAccess.hasPermission(1L, "poultry:read")).thenReturn(true);
    when(livestockFacade.livestockStats(1L, P.from(), P.to())).thenReturn(LIVESTOCK_STATS);

    var resp = service.buildDashboard(1L, P);

    assertThat(resp.livestock()).isNotNull();
    var ls = resp.livestock();
    assertThat(ls.activeBatches()).isEqualTo(4L);
    assertThat(ls.totalHeadcount()).isEqualTo(2800L);
    assertThat(ls.deaths()).isEqualTo(35L);
    assertThat(ls.mortalityRate()).isNull(); // nullable — passes through as null
    assertThat(ls.mortalitySeries()).hasSize(1);
    assertThat(ls.mortalitySeries().get(0).valueXof()).isEqualTo(5L);
    assertThat(ls.avgDailyGainG()).isEqualTo(52.3);
    assertThat(ls.layingRate()).isNull(); // nullable — passes through as null
    assertThat(ls.layingSeries()).isEmpty();
    assertThat(ls.vaccinationsCount()).isEqualTo(6L);
    assertThat(ls.treatmentsCount()).isEqualTo(3L);

    verify(livestockFacade).livestockStats(1L, P.from(), P.to());

    assertThat(resp.commercial()).isNull();
    assertThat(resp.inventory()).isNull();
  }

  @Test
  void livestock_inactive_sectionNullAndFacadeNotCalled() {
    when(subscriptionFacade.isModuleEnabled(1L, "module.commercial.basic")).thenReturn(false);
    when(subscriptionFacade.isModuleEnabled(1L, "module.inventory")).thenReturn(false);
    when(subscriptionFacade.isModuleEnabled(1L, "module.poultry.broiler")).thenReturn(false);
    when(subscriptionFacade.isModuleEnabled(1L, "module.poultry.layer")).thenReturn(false);

    var resp = service.buildDashboard(1L, P);

    assertThat(resp.livestock()).isNull();
    verify(livestockFacade, never()).livestockStats(1L, P.from(), P.to());
  }

  @Test
  void buildDashboard_omitsCommercialWhenMemberLacksReadPermission() {
    // subscription enables commercial, but the member has neither commercial:read nor finance:read
    when(subscriptionFacade.isModuleEnabled(1L, "module.commercial.basic")).thenReturn(true);
    when(farmAccess.hasAnyPermission(1L, "commercial:read", "finance:read")).thenReturn(false);

    DashboardResponse res =
        service.buildDashboard(1L, DashboardPeriod.resolve("30d", null, null, LocalDate.now()));

    assertThat(res.commercial()).isNull();
  }
}
