package com.avicare.partner.dto.response;

import com.avicare.partner.service.FarmPartnerView;

/** A farm's membership as shown to the farmer (partner identity + sharing sliders). */
public record FarmPartnerResponse(
    Long membershipId,
    Long partnerId,
    String partnerName,
    String partnerType,
    String status,
    String origin,
    boolean shareActivity,
    boolean shareFlockHealth,
    boolean shareFeedConsumption,
    boolean shareSalesVolume,
    boolean shareFinances) {

  public static FarmPartnerResponse of(FarmPartnerView v) {
    var m = v.membership();
    var p = v.partner();
    return new FarmPartnerResponse(
        m.getId(),
        m.getPartnerId(),
        p == null ? null : p.getName(),
        p == null ? null : p.getType().name(),
        m.getStatus().name(),
        m.getOrigin().name(),
        m.isShareActivity(),
        m.isShareFlockHealth(),
        m.isShareFeedConsumption(),
        m.isShareSalesVolume(),
        m.isShareFinances());
  }
}
