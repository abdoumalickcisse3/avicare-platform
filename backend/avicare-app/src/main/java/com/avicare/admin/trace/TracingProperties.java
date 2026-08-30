package com.avicare.admin.trace;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Request tracing configuration, bound from {@code avicare.tracing.*}.
 *
 * @param enabled master switch; off means nothing is written (the correlation id still flows)
 * @param capture which requests are worth a row — see {@link Capture}
 * @param slowMs a successful read slower than this is recorded even under {@link
 *     Capture#ERRORS_AND_MUTATIONS}, because "the app was slow this morning" is a support call too
 * @param maxRequestBodyChars request payload truncation limit
 * @param maxResponseBodyChars response payload truncation limit (errors only)
 * @param retentionDays how long a trace is kept before the purge job deletes it
 * @param purgeCron when that purge runs
 */
@ConfigurationProperties(prefix = "avicare.tracing")
public record TracingProperties(
    boolean enabled,
    Capture capture,
    int slowMs,
    int maxRequestBodyChars,
    int maxResponseBodyChars,
    int retentionDays,
    String purgeCron) {

  /** What gets a row in {@code request_traces}. */
  public enum Capture {
    /**
     * Everything that failed, everything that wrote, and the slow reads. Successful reads are the
     * bulk of the traffic (the mobile app polls) and the least interesting once they returned 200,
     * so they are dropped. This is the default.
     */
    ERRORS_AND_MUTATIONS,
    /** Every request. For a debugging window, not for steady state. */
    ALL
  }
}
