package com.avicare.common.security.principal;

/**
 * The identity carried by a partner-portal JWT. Distinct from {@link AvicarePrincipal}: no farm
 * memberships — a partner acts only on its own network, resolved from {@code partnerId}.
 */
public record PartnerPrincipal(Long partnerUserId, String email, Long partnerId) {}
