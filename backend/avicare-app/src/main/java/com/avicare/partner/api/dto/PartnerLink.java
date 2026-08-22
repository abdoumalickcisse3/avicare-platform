package com.avicare.partner.api.dto;

/** A farm's link to a partner, for cross-context reads (e.g. the farmer app's "your partners"). */
public record PartnerLink(
    Long partnerId,
    String partnerName,
    String partnerType,
    Long membershipId,
    String membershipStatus) {}
