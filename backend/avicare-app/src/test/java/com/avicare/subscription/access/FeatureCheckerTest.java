package com.avicare.subscription.access;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.avicare.subscription.api.SubscriptionFacade;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.security.core.context.SecurityContextHolder;

/** Unit test for {@link FeatureChecker}: the dev bypass and the normal delegating path. */
class FeatureCheckerTest {

  private final SubscriptionFacade facade = Mockito.mock(SubscriptionFacade.class);

  @AfterEach
  void clearContext() {
    SecurityContextHolder.clearContext();
  }

  @Test
  void bypassesGatingAndSkipsFacade_whenGatingDisabled() {
    FeatureChecker checker = new FeatureChecker(facade, new FeaturesProperties(false));

    boolean enabled = checker.isEnabled(42L, "module.poultry.broiler");

    assertThat(enabled).isTrue();
    verifyNoInteractions(facade);
  }

  @Test
  void delegatesToFacade_whenGatingEnabled() {
    FeatureChecker checker = new FeatureChecker(facade, new FeaturesProperties(true));
    when(facade.isModuleEnabled(42L, "module.poultry.broiler")).thenReturn(true);

    assertThat(checker.isEnabled(42L, "module.poultry.broiler")).isTrue();
    when(facade.isModuleEnabled(42L, "module.poultry.broiler")).thenReturn(false);
    assertThat(checker.isEnabled(42L, "module.poultry.broiler")).isFalse();
  }
}
