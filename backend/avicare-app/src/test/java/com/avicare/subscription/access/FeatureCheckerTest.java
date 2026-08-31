package com.avicare.subscription.access;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.avicare.common.api.exception.ServiceUnavailableException;
import com.avicare.subscription.api.SubscriptionFacade;
import com.avicare.subscription.flags.FeatureFlagService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * Unit test for {@link FeatureChecker}: the dev bypass, the normal delegating path, and the
 * platform kill switch that must win over both.
 */
class FeatureCheckerTest {

  private final SubscriptionFacade facade = Mockito.mock(SubscriptionFacade.class);
  private final FeatureFlagService flags = Mockito.mock(FeatureFlagService.class);

  @AfterEach
  void clearContext() {
    SecurityContextHolder.clearContext();
  }

  @Test
  void bypassesGatingAndSkipsFacade_whenGatingDisabled() {
    FeatureChecker checker = new FeatureChecker(facade, new FeaturesProperties(false), flags);

    boolean enabled = checker.isEnabled(42L, "module.poultry.broiler");

    assertThat(enabled).isTrue();
    verifyNoInteractions(facade);
  }

  @Test
  void delegatesToFacade_whenGatingEnabled() {
    FeatureChecker checker = new FeatureChecker(facade, new FeaturesProperties(true), flags);
    when(facade.isModuleEnabled(42L, "module.poultry.broiler")).thenReturn(true);

    assertThat(checker.isEnabled(42L, "module.poultry.broiler")).isTrue();
    when(facade.isModuleEnabled(42L, "module.poultry.broiler")).thenReturn(false);
    assertThat(checker.isEnabled(42L, "module.poultry.broiler")).isFalse();
  }

  @Test
  void killSwitchBeatsTheDevBypass() {
    // The bypass exists so nobody has to provision modules while building. It must not reach a
    // feature we have just declared unsafe.
    when(flags.isBlocked("module.inventory")).thenReturn(true);
    when(flags.reasonFor("module.inventory")).thenReturn("comptage de stock faux");
    FeatureChecker checker = new FeatureChecker(facade, new FeaturesProperties(false), flags);

    assertThatThrownBy(() -> checker.isEnabled(42L, "module.inventory"))
        .isInstanceOf(ServiceUnavailableException.class)
        .hasMessageContaining("module.inventory");
    verifyNoInteractions(facade);
  }

  @Test
  void killSwitchRefusalCarriesTheReasonAndA503() {
    when(flags.isBlocked("module.commercial.basic")).thenReturn(true);
    when(flags.reasonFor("module.commercial.basic")).thenReturn("factures en double");
    FeatureChecker checker = new FeatureChecker(facade, new FeaturesProperties(true), flags);

    assertThatThrownBy(() -> checker.isEnabled(7L, "module.commercial.basic"))
        .isInstanceOf(ServiceUnavailableException.class)
        .satisfies(
            e -> {
              ServiceUnavailableException ex = (ServiceUnavailableException) e;
              assertThat(ex.getStatus().value()).isEqualTo(503);
              assertThat(ex.getProperties()).containsEntry("reason", "factures en double");
            });
  }
}
