package com.avicare.partner.dto.response;

import com.avicare.partner.domain.PartnerFarmMembership;

/**
 * Membership as returned by the API, with the six sharing sliders the farmer consented to.
 *
 * <p>The sixth was missing since V39: the admin view would have shown five out of six, i.e. an
 * incomplete picture of what a farm actually agreed to share.
 */
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
    boolean shareFinances,
    boolean shareRestockForecast) {

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
        m.isShareFinances(),
        m.isShareRestockForecast());
  }
}
