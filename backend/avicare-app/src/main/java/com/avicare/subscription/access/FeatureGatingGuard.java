package com.avicare.subscription.access;

import java.util.Arrays;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/**
 * Boot-time safety net for the dev-only feature-gating bypass (see {@link FeaturesProperties} and
 * ADR-004).
 *
 * <ul>
 *   <li>If gating is disabled under a {@code prod} profile → the application <b>refuses to
 *       start</b> (throws), so the bypass can never reach production by accident.
 *   <li>If gating is disabled under any other profile → an alarming WARN banner is logged so it is
 *       obvious in the startup logs that the environment is running without feature gating.
 * </ul>
 */
@Component
@Slf4j
public class FeatureGatingGuard implements ApplicationRunner {

  private static final String PROD_PROFILE = "prod";

  private final FeaturesProperties featuresProperties;
  private final Environment environment;

  public FeatureGatingGuard(FeaturesProperties featuresProperties, Environment environment) {
    this.featuresProperties = featuresProperties;
    this.environment = environment;
  }

  @Override
  public void run(ApplicationArguments args) {
    if (featuresProperties.gatingEnabled()) {
      return;
    }
    boolean prod =
        Arrays.stream(environment.getActiveProfiles()).anyMatch(PROD_PROFILE::equalsIgnoreCase);
    if (prod) {
      throw new IllegalStateException(
          "avicare.features.gating-enabled=false is forbidden under the 'prod' profile. "
              + "The dev-only feature-gating bypass must never run in production (ADR-004).");
    }
    log.warn(
        """

        ============================================================
        ⚠  FEATURE GATING DISABLED — DEV BYPASS ACTIVE
        All subscription modules are treated as enabled.
        avicare.features.gating-enabled=false (active profiles: {})
        NEVER deploy this configuration to production (ADR-004).
        ============================================================""",
        Arrays.toString(environment.getActiveProfiles()));
  }
}
