package com.avicare.subscription.access;

import com.avicare.common.api.exception.ServiceUnavailableException;
import com.avicare.common.security.principal.AvicarePrincipal;
import com.avicare.subscription.api.SubscriptionFacade;
import com.avicare.subscription.flags.FeatureFlagService;
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
 *
 * <p>When {@code avicare.features.gating-enabled} is {@code false} (dev-only bypass, see {@link
 * FeaturesProperties} and ADR-004) every module is treated as enabled — useful while building the
 * product. The default is {@code true} and a boot guard forbids the bypass under a prod profile.
 *
 * <p><b>The platform kill switch is tested before both bypasses</b> (chantier P3). Neither the dev
 * bypass nor the platform-admin one may reach a feature we have just declared unsafe: a cut exists
 * to stop data being written, and staff write the same data through the same endpoints. It raises
 * {@link ServiceUnavailableException} rather than returning {@code false}, because the two mean
 * different things to whoever is calling — "not yours" versus "not right now".
 */
@Component("features")
@RequiredArgsConstructor
@Slf4j
public class FeatureChecker {

  private final SubscriptionFacade subscriptionFacade;
  private final FeaturesProperties featuresProperties;
  private final FeatureFlagService featureFlags;

  /** Whether {@code moduleKey} is enabled for {@code farmId} (platform admins always pass). */
  public boolean isEnabled(Long farmId, String moduleKey) {
    if (featureFlags.isBlocked(moduleKey)) {
      throw new ServiceUnavailableException(moduleKey, featureFlags.reasonFor(moduleKey));
    }
    if (!featuresProperties.gatingEnabled()) {
      log.warn("Feature gating DISABLED (dev bypass) — granting {} for farm {}", moduleKey, farmId);
      return true;
    }
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
