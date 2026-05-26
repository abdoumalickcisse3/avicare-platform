package com.avicare.common.api.exception;

import java.util.Map;
import org.springframework.http.HttpStatus;

/** Thrown when a quota limit is reached (HTTP 429 Too Many Requests). */
public class QuotaExceededException extends BusinessException {

  public QuotaExceededException(String quotaKey, long current, long limit) {
    super(
        "QUOTA_EXCEEDED",
        "Quota " + quotaKey + " exceeded (" + current + "/" + limit + ")",
        HttpStatus.TOO_MANY_REQUESTS,
        Map.of("quotaKey", quotaKey, "current", current, "limit", limit));
  }
}
