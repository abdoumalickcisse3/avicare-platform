package com.avicare.partner.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.avicare.common.api.exception.NotFoundException;
import com.avicare.partner.domain.MembershipOrigin;
import com.avicare.partner.domain.MembershipStatus;
import com.avicare.partner.domain.Partner;
import com.avicare.partner.domain.PartnerFarmMembership;
import com.avicare.partner.domain.PartnerInviteCode;
import com.avicare.partner.domain.PartnerType;
import com.avicare.partner.exception.DuplicateMembershipException;
import com.avicare.partner.exception.InviteCodeInvalidException;
import com.avicare.partner.repository.PartnerFarmMembershipRepository;
import com.avicare.partner.repository.PartnerInviteCodeRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PartnerNetworkServiceTest {

  @Mock PartnerFarmMembershipRepository membershipRepository;
  @Mock PartnerInviteCodeRepository inviteCodeRepository;
  @Mock PartnerService partnerService;

  PartnerNetworkService service() {
    return new PartnerNetworkService(membershipRepository, inviteCodeRepository, partnerService);
  }

  @Test
  void attachFarmManuallyCreatesConfirmedManualMembership() {
    when(membershipRepository.findByPartnerIdAndFarmIdAndStatusNot(1L, 2L, MembershipStatus.LEFT))
        .thenReturn(Optional.empty());
    when(membershipRepository.save(any(PartnerFarmMembership.class)))
        .thenAnswer(inv -> inv.getArgument(0));

    PartnerFarmMembership m = service().attachFarmManually(1L, 2L, 7L);

    assertThat(m.getPartnerId()).isEqualTo(1L);
    assertThat(m.getFarmId()).isEqualTo(2L);
    assertThat(m.getOrigin()).isEqualTo(MembershipOrigin.MANUAL_ADMIN);
    assertThat(m.getStatus()).isEqualTo(MembershipStatus.CONFIRMED);
    assertThat(m.getConfirmedAt()).isNotNull();
    assertThat(m.isShareActivity()).isTrue();
    assertThat(m.isShareFinances()).isFalse();
  }

  @Test
  void attachFarmManuallyRejectsDuplicate() {
    when(membershipRepository.findByPartnerIdAndFarmIdAndStatusNot(1L, 2L, MembershipStatus.LEFT))
        .thenReturn(Optional.of(new PartnerFarmMembership()));

    assertThatThrownBy(() -> service().attachFarmManually(1L, 2L, 7L))
        .isInstanceOf(DuplicateMembershipException.class);
  }

  @Test
  void joinViaCodeRejectsExpiredCode() {
    PartnerInviteCode code = new PartnerInviteCode();
    code.setPartnerId(1L);
    code.setActive(true);
    code.setExpiresAt(LocalDateTime.now().minusDays(1));
    when(inviteCodeRepository.findByCode("EXPIRED1")).thenReturn(Optional.of(code));

    assertThatThrownBy(() -> service().joinViaCode("EXPIRED1", 2L, 9L))
        .isInstanceOf(InviteCodeInvalidException.class);
  }

  @Test
  void joinViaCodeCreatesDeclaredMembershipAndIncrementsUses() {
    PartnerInviteCode code = new PartnerInviteCode();
    code.setId(5L);
    code.setPartnerId(1L);
    code.setActive(true);
    code.setMaxUses(10);
    code.setUsesCount(3);
    when(inviteCodeRepository.findByCode("GOOD1234")).thenReturn(Optional.of(code));
    when(membershipRepository.findByPartnerIdAndFarmIdAndStatusNot(1L, 2L, MembershipStatus.LEFT))
        .thenReturn(Optional.empty());
    when(membershipRepository.save(any(PartnerFarmMembership.class)))
        .thenAnswer(inv -> inv.getArgument(0));

    PartnerFarmMembership m = service().joinViaCode("GOOD1234", 2L, 9L);

    assertThat(m.getOrigin()).isEqualTo(MembershipOrigin.INVITE_CODE);
    assertThat(m.getStatus()).isEqualTo(MembershipStatus.DECLARED);
    assertThat(m.getInviteCodeId()).isEqualTo(5L);
    assertThat(code.getUsesCount()).isEqualTo(4);
  }

  @Test
  void updateSharingScopesAppliesAllFive() {
    PartnerFarmMembership existing = new PartnerFarmMembership();
    existing.setId(8L);
    when(membershipRepository.findById(8L)).thenReturn(Optional.of(existing));
    when(membershipRepository.save(any(PartnerFarmMembership.class)))
        .thenAnswer(inv -> inv.getArgument(0));

    PartnerFarmMembership m =
        service().updateSharingScopes(8L, new SharingScopes(true, true, false, true, false));

    assertThat(m.isShareActivity()).isTrue();
    assertThat(m.isShareFeedConsumption()).isFalse();
    assertThat(m.isShareSalesVolume()).isTrue();
    assertThat(m.isShareFinances()).isFalse();
  }

  @Test
  void updateSharingScopesForFarmRejectsMembershipOfAnotherFarm() {
    PartnerFarmMembership other = new PartnerFarmMembership();
    other.setId(8L);
    other.setFarmId(99L); // belongs to farm 99, caller acts on farm 2
    when(membershipRepository.findById(8L)).thenReturn(Optional.of(other));

    assertThatThrownBy(
            () ->
                service()
                    .updateSharingScopesForFarm(
                        2L, 8L, new SharingScopes(true, true, true, false, false)))
        .isInstanceOf(NotFoundException.class);
  }

  @Test
  void updateSharingScopesForFarmAppliesWhenFarmMatches() {
    PartnerFarmMembership m = new PartnerFarmMembership();
    m.setId(8L);
    m.setFarmId(2L);
    when(membershipRepository.findById(8L)).thenReturn(Optional.of(m));
    when(membershipRepository.save(any(PartnerFarmMembership.class)))
        .thenAnswer(inv -> inv.getArgument(0));

    PartnerFarmMembership out =
        service()
            .updateSharingScopesForFarm(2L, 8L, new SharingScopes(false, true, false, true, false));

    assertThat(out.isShareActivity()).isFalse();
    assertThat(out.isShareSalesVolume()).isTrue();
    assertThat(out.isShareFinances()).isFalse();
  }

  @Test
  void leaveForFarmRejectsMembershipOfAnotherFarm() {
    PartnerFarmMembership other = new PartnerFarmMembership();
    other.setId(8L);
    other.setFarmId(99L);
    when(membershipRepository.findById(8L)).thenReturn(Optional.of(other));

    assertThatThrownBy(() -> service().leaveForFarm(2L, 8L)).isInstanceOf(NotFoundException.class);
  }

  @Test
  void leaveForFarmSetsLeftWhenFarmMatches() {
    PartnerFarmMembership m = new PartnerFarmMembership();
    m.setId(8L);
    m.setFarmId(2L);
    when(membershipRepository.findById(8L)).thenReturn(Optional.of(m));
    when(membershipRepository.save(any(PartnerFarmMembership.class)))
        .thenAnswer(inv -> inv.getArgument(0));

    PartnerFarmMembership out = service().leaveForFarm(2L, 8L);

    assertThat(out.getStatus()).isEqualTo(MembershipStatus.LEFT);
    assertThat(out.getLeftAt()).isNotNull();
  }

  @Test
  void listForFarmDetailedJoinsPartner() {
    PartnerFarmMembership m = new PartnerFarmMembership();
    m.setId(8L);
    m.setPartnerId(3L);
    m.setFarmId(2L);
    m.setStatus(MembershipStatus.CONFIRMED);
    Partner p = new Partner();
    p.setName("Provendier X");
    p.setType(PartnerType.FEED_SUPPLIER);
    when(membershipRepository.findByFarmIdAndStatusNot(2L, MembershipStatus.LEFT))
        .thenReturn(List.of(m));
    when(partnerService.mapByIds(List.of(3L))).thenReturn(Map.of(3L, p));

    var views = service().listForFarmDetailed(2L);

    assertThat(views).hasSize(1);
    assertThat(views.get(0).membership().getId()).isEqualTo(8L);
    assertThat(views.get(0).partner().getName()).isEqualTo("Provendier X");
  }
}
