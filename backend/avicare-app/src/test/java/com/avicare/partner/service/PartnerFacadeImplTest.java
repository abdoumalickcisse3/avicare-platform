package com.avicare.partner.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.avicare.partner.domain.MembershipStatus;
import com.avicare.partner.domain.PartnerFarmMembership;
import com.avicare.partner.repository.PartnerFarmMembershipRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PartnerFacadeImplTest {

  @Mock PartnerFarmMembershipRepository membershipRepository;

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

    PartnerFacadeImpl facade = new PartnerFacadeImpl(membershipRepository);

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

    PartnerFacadeImpl facade = new PartnerFacadeImpl(membershipRepository);

    assertThat(facade.sharedScopes(1L, 10L))
        .contains("activity", "sales_volume")
        .doesNotContain("finances");
  }

  @Test
  void sharedScopesEmptyWhenNoMembership() {
    when(membershipRepository.findByPartnerIdAndFarmIdAndStatusNot(1L, 99L, MembershipStatus.LEFT))
        .thenReturn(Optional.empty());

    PartnerFacadeImpl facade = new PartnerFacadeImpl(membershipRepository);

    assertThat(facade.sharedScopes(1L, 99L)).isEmpty();
  }
}
