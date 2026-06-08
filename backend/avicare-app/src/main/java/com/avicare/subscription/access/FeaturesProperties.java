package com.avicare.subscription.access;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Feature-gating configuration bound from {@code avicare.features.*}.
 *
 * <p>{@code gatingEnabled} is the master switch for subscription feature gating. It defaults to
 * {@code true} (gating active) so any environment that does not explicitly opt out keeps the
 * production behaviour. Setting it to {@code false} makes {@link FeatureChecker} treat every module
 * as enabled — a <b>development-only</b> convenience to remove subscription friction while building
 * the product (Sprints B2→C5). A boot guard ({@code FeatureGatingGuard}) refuses to start the app
 * if the bypass is requested under a {@code prod} profile (see ADR-004).
 *
 * @param gatingEnabled whether subscription feature gating is enforced (default {@code true})
 */
@ConfigurationProperties(prefix = "avicare.features")
public record FeaturesProperties(@DefaultValue("true") boolean gatingEnabled) {}
