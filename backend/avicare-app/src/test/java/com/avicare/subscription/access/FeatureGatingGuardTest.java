package com.avicare.subscription.access;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

/** Unit test for {@link FeatureGatingGuard}: prod refuses the bypass, dev only warns. */
class FeatureGatingGuardTest {

  private FeatureGatingGuard guard(boolean gatingEnabled, String... activeProfiles) {
    MockEnvironment env = new MockEnvironment();
    env.setActiveProfiles(activeProfiles);
    return new FeatureGatingGuard(new FeaturesProperties(gatingEnabled), env);
  }

  @Test
  void refusesToStart_whenBypassUnderProdProfile() {
    assertThatThrownBy(() -> guard(false, "prod").run(null))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("prod");
  }

  @Test
  void allowsBypass_underDevProfile() {
    assertThatCode(() -> guard(false, "dev").run(null)).doesNotThrowAnyException();
  }

  @Test
  void noop_whenGatingEnabled_evenUnderProd() {
    assertThatCode(() -> guard(true, "prod").run(null)).doesNotThrowAnyException();
  }
}
