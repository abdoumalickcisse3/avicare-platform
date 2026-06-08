package com.avicare.subscription.access;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.actuate.info.Info;
import org.springframework.boot.actuate.info.InfoContributor;
import org.springframework.stereotype.Component;

/**
 * Surfaces the feature-gating state under {@code /actuator/info} ({@code features.gatingEnabled})
 * so the dev bypass is observable per environment (doc 06 §4) and easy to assert in the Phase C
 * re-activation checklist (ADR-004).
 */
@Component
@RequiredArgsConstructor
public class FeaturesInfoContributor implements InfoContributor {

  private final FeaturesProperties featuresProperties;

  @Override
  public void contribute(Info.Builder builder) {
    builder.withDetail(
        "features", java.util.Map.of("gatingEnabled", featuresProperties.gatingEnabled()));
  }
}
