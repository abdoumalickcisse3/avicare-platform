package com.avicare.partner.service;

import com.avicare.common.api.exception.NotFoundException;
import com.avicare.partner.domain.MembershipOrigin;
import com.avicare.partner.domain.MembershipStatus;
import com.avicare.partner.domain.Partner;
import com.avicare.partner.domain.PartnerFarmMembership;
import com.avicare.partner.domain.PartnerInviteCode;
import com.avicare.partner.exception.DuplicateMembershipException;
import com.avicare.partner.exception.InviteCodeInvalidException;
import com.avicare.partner.repository.PartnerFarmMembershipRepository;
import com.avicare.partner.repository.PartnerInviteCodeRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Farm↔partner membership lifecycle and join flows (manual, invite code, farmer-declared). */
@Service
@RequiredArgsConstructor
public class PartnerNetworkService {

  private final PartnerFarmMembershipRepository membershipRepository;
  private final PartnerInviteCodeRepository inviteCodeRepository;
  private final PartnerService partnerService;

  @Transactional
  public PartnerFarmMembership attachFarmManually(Long partnerId, Long farmId, Long actorUserId) {
    partnerService.get(partnerId); // 404 if absent
    requireNoActiveMembership(partnerId, farmId);
    PartnerFarmMembership m =
        newMembership(partnerId, farmId, MembershipOrigin.MANUAL_ADMIN, actorUserId);
    m.setStatus(MembershipStatus.CONFIRMED);
    m.setConfirmedAt(LocalDateTime.now());
    return membershipRepository.save(m);
  }

  @Transactional
  public PartnerFarmMembership declareSupplier(Long partnerId, Long farmId, Long farmerUserId) {
    partnerService.get(partnerId);
    requireNoActiveMembership(partnerId, farmId);
    return membershipRepository.save(
        newMembership(partnerId, farmId, MembershipOrigin.FARMER_DECLARED, farmerUserId));
  }

  @Transactional
  public PartnerFarmMembership joinViaCode(String code, Long farmId, Long farmerUserId) {
    PartnerInviteCode invite =
        inviteCodeRepository
            .findByCode(code)
            .orElseThrow(() -> new InviteCodeInvalidException("Unknown invite code"));
    if (!invite.isActive()) {
      throw new InviteCodeInvalidException("Invite code is inactive");
    }
    if (invite.getExpiresAt() != null && invite.getExpiresAt().isBefore(LocalDateTime.now())) {
      throw new InviteCodeInvalidException("Invite code has expired");
    }
    if (invite.getMaxUses() != null && invite.getUsesCount() >= invite.getMaxUses()) {
      throw new InviteCodeInvalidException("Invite code has reached its usage limit");
    }
    requireNoActiveMembership(invite.getPartnerId(), farmId);

    PartnerFarmMembership m =
        newMembership(invite.getPartnerId(), farmId, MembershipOrigin.INVITE_CODE, farmerUserId);
    m.setInviteCodeId(invite.getId());
    invite.setUsesCount(invite.getUsesCount() + 1);
    inviteCodeRepository.save(invite);
    return membershipRepository.save(m);
  }

  @Transactional
  public PartnerFarmMembership confirm(Long membershipId) {
    PartnerFarmMembership m = load(membershipId);
    m.setStatus(MembershipStatus.CONFIRMED);
    m.setConfirmedAt(LocalDateTime.now());
    return membershipRepository.save(m);
  }

  @Transactional
  public PartnerFarmMembership updateSharingScopes(Long membershipId, SharingScopes scopes) {
    PartnerFarmMembership m = load(membershipId);
    m.setShareActivity(scopes.activity());
    m.setShareFlockHealth(scopes.flockHealth());
    m.setShareFeedConsumption(scopes.feedConsumption());
    m.setShareSalesVolume(scopes.salesVolume());
    m.setShareFinances(scopes.finances());
    return membershipRepository.save(m);
  }

  @Transactional
  public PartnerFarmMembership leave(Long membershipId) {
    PartnerFarmMembership m = load(membershipId);
    m.setStatus(MembershipStatus.LEFT);
    m.setLeftAt(LocalDateTime.now());
    return membershipRepository.save(m);
  }

  @Transactional(readOnly = true)
  public List<PartnerFarmMembership> listForPartner(Long partnerId) {
    return membershipRepository.findByPartnerIdAndStatusNot(partnerId, MembershipStatus.LEFT);
  }

  @Transactional(readOnly = true)
  public List<PartnerFarmMembership> listForFarm(Long farmId) {
    return membershipRepository.findByFarmIdAndStatusNot(farmId, MembershipStatus.LEFT);
  }

  @Transactional
  public PartnerFarmMembership updateSharingScopesForFarm(
      Long farmId, Long membershipId, SharingScopes scopes) {
    PartnerFarmMembership m = loadForFarm(farmId, membershipId);
    m.setShareActivity(scopes.activity());
    m.setShareFlockHealth(scopes.flockHealth());
    m.setShareFeedConsumption(scopes.feedConsumption());
    m.setShareSalesVolume(scopes.salesVolume());
    m.setShareFinances(scopes.finances());
    return membershipRepository.save(m);
  }

  @Transactional
  public PartnerFarmMembership leaveForFarm(Long farmId, Long membershipId) {
    PartnerFarmMembership m = loadForFarm(farmId, membershipId);
    m.setStatus(MembershipStatus.LEFT);
    m.setLeftAt(LocalDateTime.now());
    return membershipRepository.save(m);
  }

  @Transactional(readOnly = true)
  public List<FarmPartnerView> listForFarmDetailed(Long farmId) {
    List<PartnerFarmMembership> memberships =
        membershipRepository.findByFarmIdAndStatusNot(farmId, MembershipStatus.LEFT);
    List<Long> partnerIds =
        memberships.stream().map(PartnerFarmMembership::getPartnerId).distinct().toList();
    Map<Long, Partner> byId = partnerService.mapByIds(partnerIds);
    return memberships.stream()
        .map(m -> new FarmPartnerView(m, byId.get(m.getPartnerId())))
        .toList();
  }

  /**
   * Loads a membership and enforces it belongs to {@code farmId} (else 404 — no cross-farm leak).
   */
  private PartnerFarmMembership loadForFarm(Long farmId, Long membershipId) {
    PartnerFarmMembership m = load(membershipId);
    if (!m.getFarmId().equals(farmId)) {
      throw NotFoundException.of("PartnerFarmMembership", membershipId);
    }
    return m;
  }

  private PartnerFarmMembership load(Long membershipId) {
    return membershipRepository
        .findById(membershipId)
        .orElseThrow(() -> NotFoundException.of("PartnerFarmMembership", membershipId));
  }

  private void requireNoActiveMembership(Long partnerId, Long farmId) {
    membershipRepository
        .findByPartnerIdAndFarmIdAndStatusNot(partnerId, farmId, MembershipStatus.LEFT)
        .ifPresent(
            existing -> {
              throw new DuplicateMembershipException(partnerId, farmId);
            });
  }

  private PartnerFarmMembership newMembership(
      Long partnerId, Long farmId, MembershipOrigin origin, Long actorUserId) {
    PartnerFarmMembership m = new PartnerFarmMembership();
    m.setPartnerId(partnerId);
    m.setFarmId(farmId);
    m.setOrigin(origin);
    m.setStatus(MembershipStatus.DECLARED);
    m.setCreatedBy(actorUserId);
    return m; // sharing defaults come from the entity field initializers
  }
}
