package com.avicare.subscription.access;

import com.avicare.common.security.principal.AvicarePrincipal;
import com.avicare.subscription.api.SubscriptionFacade;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/**
 * SpEL bean backing feature-gating {@code @PreAuthorize} checks:
 *
 * <pre>{@code
 * @PreAuthorize("@features.isEnabled(#farmId, 'module.poultry.broiler')")
 * }</pre>
 *
 * <p>A module is enabled when the farm's subscription includes a non-expired entry for it (Décision
 * 14/15 — presence is the gate; the {@code FeatureMode} qualifies the refusal UX, not the switch).
 * Platform admins ({@link AvicarePrincipal#isAdmin()}) bypass the check, like {@code
 * FarmAccessChecker}.
 */
@Component("features")
@RequiredArgsConstructor
@Slf4j
public class FeatureChecker {

  private final SubscriptionFacade subscriptionFacade;

  /** Whether {@code moduleKey} is enabled for {@code farmId} (platform admins always pass). */
  public boolean isEnabled(Long farmId, String moduleKey) {
    AvicarePrincipal principal = currentPrincipal();
    if (principal != null && principal.isAdmin()) {
      log.debug("Feature {} granted via platform ADMIN for user {}", moduleKey, principal.userId());
      return true;
    }
    return subscriptionFacade.isModuleEnabled(farmId, moduleKey);
  }

  private AvicarePrincipal currentPrincipal() {
    Authentication auth = SecurityContextHolder.getContext().getAuthentication();
    if (auth == null || !auth.isAuthenticated()) {
      return null;
    }
    return auth.getDetails() instanceof AvicarePrincipal principal ? principal : null;
  }
}
