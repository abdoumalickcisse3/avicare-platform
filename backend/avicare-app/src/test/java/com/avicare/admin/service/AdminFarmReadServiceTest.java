package com.avicare.admin.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;

import com.avicare.admin.dto.response.AdminFarmRow;
import com.avicare.livestock.api.LivestockFacade;
import com.avicare.livestock.api.dto.LivestockStats;
import com.avicare.partner.api.PartnerFacade;
import com.avicare.partner.api.dto.PartnerLink;
import com.avicare.subscription.api.SubscriptionFacade;
import com.avicare.tenancy.api.TenancyFacade;
import com.avicare.tenancy.api.dto.FarmInfo;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AdminFarmReadServiceTest {

  @Mock TenancyFacade tenancyFacade;
  @Mock LivestockFacade livestockFacade;
  @Mock SubscriptionFacade subscriptionFacade;
  @Mock PartnerFacade partnerFacade;

  private AdminFarmReadService service() {
    return new AdminFarmReadService(
        tenancyFacade, livestockFacade, subscriptionFacade, partnerFacade);
  }

  private FarmInfo farm(long id, String name) {
    return new FarmInfo(id, name, "XOF", "Africa/Dakar", true);
  }

  @Test
  void listsFarmsWithTheirBatchedColumns() {
    when(tenancyFacade.listAllFarms()).thenReturn(List.of(farm(1, "Ferme A"), farm(2, "Ferme B")));
    when(tenancyFacade.memberCountByFarm(any())).thenReturn(Map.of(1L, 3L, 2L, 1L));
    when(livestockFacade.activeUnitCountByFarm(any())).thenReturn(Map.of(1L, 2L));
    when(livestockFacade.lastActivityByFarm(any()))
        .thenReturn(Map.of(1L, LocalDateTime.now().minusDays(1)));

    List<AdminFarmRow> rows = service().list(null);

    assertThat(rows).hasSize(2);
    assertThat(rows.get(0).name()).isEqualTo("Ferme A");
    assertThat(rows.get(0).memberCount()).isEqualTo(3);
    assertThat(rows.get(0).activeUnitCount()).isEqualTo(2);
    // Absent from the map means "no unit", not a missing value.
    assertThat(rows.get(1).activeUnitCount()).isZero();
  }

  @Test
  void sortsFarmsThatNeverRecordedAnythingLast() {
    when(tenancyFacade.listAllFarms())
        .thenReturn(List.of(farm(1, "Jamais active"), farm(2, "Active")));
    when(tenancyFacade.memberCountByFarm(any())).thenReturn(Map.of());
    when(livestockFacade.activeUnitCountByFarm(any())).thenReturn(Map.of());
    when(livestockFacade.lastActivityByFarm(any()))
        .thenReturn(Map.of(2L, LocalDateTime.now().minusDays(3)));

    List<AdminFarmRow> rows = service().list(null);

    // A never-active farm is exactly the one to look at, but it carries no date to rank by.
    assertThat(rows.get(0).name()).isEqualTo("Active");
    assertThat(rows.get(1).lastActivityAt()).isNull();
  }

  @Test
  void filtersOnTheNameCaseInsensitively() {
    when(tenancyFacade.listAllFarms())
        .thenReturn(List.of(farm(1, "Ferme Complète"), farm(2, "Tiworld")));
    when(tenancyFacade.memberCountByFarm(any())).thenReturn(Map.of());
    when(livestockFacade.activeUnitCountByFarm(any())).thenReturn(Map.of());
    when(livestockFacade.lastActivityByFarm(any())).thenReturn(Map.of());

    assertThat(service().list("tiwo")).extracting(AdminFarmRow::name).containsExactly("Tiworld");
  }

  @Test
  void assemblesTheDetailFromTheFacadesOnly() {
    when(tenancyFacade.findById(8L)).thenReturn(farm(8, "Ferme Complète"));
    when(tenancyFacade.memberCountByFarm(any())).thenReturn(Map.of(8L, 4L));
    when(livestockFacade.livestockStats(anyLong(), any(), any()))
        .thenReturn(
            new LivestockStats(2, 950, 0, null, List.of(), null, null, List.of(), 0, 0, null));
    when(livestockFacade.lastActivityByFarm(any())).thenReturn(Map.of());
    when(subscriptionFacade.listEnabledModules(8L)).thenReturn(List.of("poultry", "commercial"));
    when(partnerFacade.partnersForFarm(8L))
        .thenReturn(
            List.of(new PartnerLink(2L, "Provende du Sahel", "FEED_SUPPLIER", 5L, "CONFIRMED")));

    var detail = service().detail(8L);

    assertThat(detail.activeUnitCount()).isEqualTo(2);
    assertThat(detail.totalHeadcount()).isEqualTo(950);
    assertThat(detail.enabledModules()).containsExactly("poultry", "commercial");
    assertThat(detail.partners())
        .singleElement()
        .satisfies(
            p -> {
              assertThat(p.partnerName()).isEqualTo("Provende du Sahel");
              assertThat(p.status()).isEqualTo("CONFIRMED");
            });
    // A farm that never recorded anything must show null, never a fabricated date.
    assertThat(detail.lastActivityAt()).isNull();
  }
}
