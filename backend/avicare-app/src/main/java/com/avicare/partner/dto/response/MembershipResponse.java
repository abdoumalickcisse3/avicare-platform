package com.avicare.partner.dto.response;

import com.avicare.partner.domain.PartnerFarmMembership;

/** Membership as returned by the API. */
public record MembershipResponse(
    Long id,
    Long partnerId,
    Long farmId,
    String status,
    String origin,
    boolean shareActivity,
    boolean shareFlockHealth,
    boolean shareFeedConsumption,
    boolean shareSalesVolume,
    boolean shareFinances) {

  public static MembershipResponse of(PartnerFarmMembership m) {
    return new MembershipResponse(
        m.getId(),
        m.getPartnerId(),
        m.getFarmId(),
        m.getStatus().name(),
        m.getOrigin().name(),
        m.isShareActivity(),
        m.isShareFlockHealth(),
        m.isShareFeedConsumption(),
        m.isShareSalesVolume(),
        m.isShareFinances());
  }
}
