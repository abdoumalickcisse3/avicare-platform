package com.avicare.common.api.exception;

import java.util.Map;
import org.springframework.http.HttpStatus;

/** Thrown when a feature is not included in the current subscription (HTTP 403). */
public class FeatureForbiddenException extends BusinessException {

  public FeatureForbiddenException(String featureKey) {
    super(
        "FEATURE_FORBIDDEN",
        "Feature " + featureKey + " is not enabled for your subscription",
        HttpStatus.FORBIDDEN,
        Map.of("featureKey", featureKey));
  }
}
