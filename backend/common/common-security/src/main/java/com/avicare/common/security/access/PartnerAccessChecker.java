package com.avicare.common.security.access;

import com.avicare.common.tenancy.context.PartnerContext;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/**
 * SpEL helper for partner-portal endpoints: {@code @PreAuthorize("@partnerAccess.isPartner()")}.
 */
@Component("partnerAccess")
public class PartnerAccessChecker {

  /** True when the current request is authenticated as a partner (ROLE_PARTNER). */
  public boolean isPartner() {
    Authentication a = SecurityContextHolder.getContext().getAuthentication();
    return a != null
        && a.getAuthorities().stream().anyMatch(g -> "ROLE_PARTNER".equals(g.getAuthority()));
  }

  /** The authenticated partner's id (from the token). */
  public Long currentPartnerId() {
    return PartnerContext.currentPartnerId();
  }
}
