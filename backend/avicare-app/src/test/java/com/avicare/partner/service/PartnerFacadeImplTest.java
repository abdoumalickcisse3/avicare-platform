package com.avicare.partner.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.avicare.partner.domain.MembershipStatus;
import com.avicare.partner.domain.Partner;
import com.avicare.partner.domain.PartnerFarmMembership;
import com.avicare.partner.domain.PartnerType;
import com.avicare.partner.repository.PartnerFarmMembershipRepository;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PartnerFacadeImplTest {

  @Mock PartnerFarmMembershipRepository membershipRepository;
  @Mock PartnerService partnerService;

  private PartnerFarmMembership membership(long farmId, MembershipStatus status) {
    PartnerFarmMembership m = new PartnerFarmMembership();
    m.setPartnerId(1L);
    m.setFarmId(farmId);
    m.setStatus(status);
    return m;
  }

  @Test
  void farmIdsInNetworkReturnsOnlyConfirmed() {
    when(membershipRepository.findByPartnerIdAndStatusNot(1L, MembershipStatus.LEFT))
        .thenReturn(
            List.of(
                membership(10L, MembershipStatus.CONFIRMED),
                membership(11L, MembershipStatus.DECLARED)));

    PartnerFacadeImpl facade = new PartnerFacadeImpl(membershipRepository, partnerService);

    assertThat(facade.farmIdsInNetwork(1L)).containsExactly(10L);
  }

  @Test
  void sharedScopesReflectsBooleans() {
    PartnerFarmMembership m = membership(10L, MembershipStatus.CONFIRMED);
    m.setShareActivity(true);
    m.setShareFinances(false);
    m.setShareSalesVolume(true);
    when(membershipRepository.findByPartnerIdAndFarmIdAndStatusNot(1L, 10L, MembershipStatus.LEFT))
        .thenReturn(Optional.of(m));

    PartnerFacadeImpl facade = new PartnerFacadeImpl(membershipRepository, partnerService);

    assertThat(facade.sharedScopes(1L, 10L))
        .contains("activity", "sales_volume")
        .doesNotContain("finances");
  }

  @Test
  void sharedScopesEmptyWhenNoMembership() {
    when(membershipRepository.findByPartnerIdAndFarmIdAndStatusNot(1L, 99L, MembershipStatus.LEFT))
        .thenReturn(Optional.empty());

    PartnerFacadeImpl facade = new PartnerFacadeImpl(membershipRepository, partnerService);

    assertThat(facade.sharedScopes(1L, 99L)).isEmpty();
  }

  @Test
  void partnersForFarmResolvesNameAndType() {
    PartnerFarmMembership m = membership(10L, MembershipStatus.CONFIRMED);
    m.setId(8L);
    m.setPartnerId(3L);
    Partner p = new Partner();
    p.setName("Provendier X");
    p.setType(PartnerType.FEED_SUPPLIER);
    when(membershipRepository.findByFarmIdAndStatusNot(10L, MembershipStatus.LEFT))
        .thenReturn(List.of(m));
    when(partnerService.mapByIds(List.of(3L))).thenReturn(Map.of(3L, p));

    PartnerFacadeImpl facade = new PartnerFacadeImpl(membershipRepository, partnerService);

    var links = facade.partnersForFarm(10L);
    assertThat(links).hasSize(1);
    assertThat(links.get(0).partnerName()).isEqualTo("Provendier X");
    assertThat(links.get(0).partnerType()).isEqualTo("FEED_SUPPLIER");
  }
}
