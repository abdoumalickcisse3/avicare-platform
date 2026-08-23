package com.avicare.partner.service;

import com.avicare.partner.domain.Partner;
import com.avicare.partner.domain.PartnerFarmMembership;

/** A farm membership joined with its partner, for the farmer-facing list. */
public record FarmPartnerView(PartnerFarmMembership membership, Partner partner) {}
