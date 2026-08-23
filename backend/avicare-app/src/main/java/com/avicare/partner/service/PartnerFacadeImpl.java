package com.avicare.partner.service;

import com.avicare.partner.api.PartnerFacade;
import com.avicare.partner.api.dto.PartnerLink;
import com.avicare.partner.domain.MembershipStatus;
import com.avicare.partner.domain.Partner;
import com.avicare.partner.domain.PartnerFarmMembership;
import com.avicare.partner.repository.PartnerFarmMembershipRepository;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Default {@link PartnerFacade} implementation. Scope filtering is the trust boundary. */
@Service
@RequiredArgsConstructor
public class PartnerFacadeImpl implements PartnerFacade {

  private final PartnerFarmMembershipRepository membershipRepository;
  private final PartnerService partnerService;

  @Override
  @Transactional(readOnly = true)
  public List<Long> farmIdsInNetwork(Long partnerId) {
    return membershipRepository
        .findByPartnerIdAndStatusNot(partnerId, MembershipStatus.LEFT)
        .stream()
        .filter(m -> m.getStatus() == MembershipStatus.CONFIRMED)
        .map(PartnerFarmMembership::getFarmId)
        .toList();
  }

  @Override
  @Transactional(readOnly = true)
  public Set<String> sharedScopes(Long partnerId, Long farmId) {
    return membershipRepository
        .findByPartnerIdAndFarmIdAndStatusNot(partnerId, farmId, MembershipStatus.LEFT)
        .map(PartnerFacadeImpl::scopesOf)
        .orElseGet(Set::of);
  }

  @Override
  @Transactional(readOnly = true)
  public List<PartnerLink> partnersForFarm(Long farmId) {
    List<PartnerFarmMembership> memberships =
        membershipRepository.findByFarmIdAndStatusNot(farmId, MembershipStatus.LEFT);
    Map<Long, Partner> byId =
        partnerService.mapByIds(
            memberships.stream().map(PartnerFarmMembership::getPartnerId).distinct().toList());
    return memberships.stream()
        .map(
            m -> {
              Partner p = byId.get(m.getPartnerId());
              return new PartnerLink(
                  m.getPartnerId(),
                  p == null ? null : p.getName(),
                  p == null ? null : p.getType().name(),
                  m.getId(),
                  m.getStatus().name());
            })
        .toList();
  }

  private static Set<String> scopesOf(PartnerFarmMembership m) {
    Set<String> scopes = new LinkedHashSet<>();
    if (m.isShareActivity()) scopes.add("activity");
    if (m.isShareFlockHealth()) scopes.add("flock_health");
    if (m.isShareFeedConsumption()) scopes.add("feed_consumption");
    if (m.isShareSalesVolume()) scopes.add("sales_volume");
    if (m.isShareFinances()) scopes.add("finances");
    return scopes;
  }
}
