package com.avicare.threat.filter;

import com.avicare.threat.service.ThreatDetectionService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.scheduling.annotation.Scheduled;

/**
 * Puts the two security filters in front of everything, in the order that costs the least.
 *
 * <p>Correlation id (HIGHEST) → request trace (+10) → <b>IP block (+20)</b> → <b>rate limit
 * (+30)</b> → Spring Security. A refused request is therefore still traced and still carries a
 * correlation id — a farmer who cannot log in will call, and the answer has to be findable — but it
 * never reaches password hashing or a database query.
 *
 * <p>Registered explicitly rather than component-scanned, for the reason the tracing filter is: a
 * {@code @Component} filter is pulled into every {@code @WebMvcTest} slice, which then has to mock
 * services it has no interest in.
 */
@Configuration
public class ThreatFilterConfig {

  @Value("${avicare.security.rate-limit.enabled:true}")
  private boolean rateLimitEnabled;

  @Value("${avicare.security.ip-blocking.enabled:true}")
  private boolean ipBlockingEnabled;

  @Bean
  public FilterRegistrationBean<IpBlockingFilter> ipBlockingFilterRegistration(
      ThreatDetectionService threatDetection, ObjectMapper objectMapper) {
    FilterRegistrationBean<IpBlockingFilter> registration =
        new FilterRegistrationBean<>(new IpBlockingFilter(threatDetection, objectMapper));
    registration.setOrder(Ordered.HIGHEST_PRECEDENCE + 20);
    registration.setEnabled(ipBlockingEnabled);
    return registration;
  }

  @Bean
  public RateLimitFilter rateLimitFilter(
      ThreatDetectionService threatDetection, ObjectMapper objectMapper) {
    return new RateLimitFilter(threatDetection, objectMapper, rateLimitEnabled);
  }

  @Bean
  public FilterRegistrationBean<RateLimitFilter> rateLimitFilterRegistration(
      RateLimitFilter filter) {
    FilterRegistrationBean<RateLimitFilter> registration = new FilterRegistrationBean<>(filter);
    registration.setOrder(Ordered.HIGHEST_PRECEDENCE + 30);
    return registration;
  }

  /** Keeps the in-memory bucket map from growing without bound. See {@link RateLimitFilter}. */
  @Bean
  public BucketEviction bucketEviction(RateLimitFilter filter) {
    return new BucketEviction(filter);
  }

  /** Tiny holder so the schedule has somewhere to live without the filter becoming a bean twice. */
  public static class BucketEviction {

    private final RateLimitFilter filter;

    BucketEviction(RateLimitFilter filter) {
      this.filter = filter;
    }

    @Scheduled(cron = "${avicare.security.rate-limit.evict-cron:0 0 * * * *}")
    public void evict() {
      filter.evictBuckets();
    }
  }
}
