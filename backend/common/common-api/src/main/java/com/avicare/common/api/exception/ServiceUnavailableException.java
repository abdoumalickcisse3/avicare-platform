package com.avicare.common.api.exception;

import java.util.Map;
import org.springframework.http.HttpStatus;

/**
 * Thrown when a feature is deliberately switched off platform-wide (HTTP 503).
 *
 * <p>Distinct from {@link FeatureForbiddenException} on purpose. A 403 says "not yours"; the caller
 * has nothing to wait for. A 503 says "not right now" — the farmer did nothing wrong, their
 * subscription is intact, and the feature is coming back. The client can say so, and a retry later
 * is the right behaviour rather than a support call.
 */
public class ServiceUnavailableException extends BusinessException {

  public ServiceUnavailableException(String featureKey, String reason) {
    super(
        "FEATURE_TEMPORARILY_UNAVAILABLE",
        "Feature " + featureKey + " is temporarily unavailable",
        HttpStatus.SERVICE_UNAVAILABLE,
        reason == null || reason.isBlank()
            ? Map.of("featureKey", featureKey)
            : Map.of("featureKey", featureKey, "reason", reason));
  }
}
