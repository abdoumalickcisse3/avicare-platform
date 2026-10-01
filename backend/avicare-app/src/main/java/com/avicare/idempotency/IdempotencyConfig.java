package com.avicare.idempotency;

import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class IdempotencyConfig {

  /**
   * Spring Security's filter chain sits at order -100; this one must run after it so the
   * authenticated user is in the security context.
   */
  @Bean
  public FilterRegistrationBean<IdempotencyFilter> idempotencyFilterRegistration(
      IdempotencyStore store) {
    FilterRegistrationBean<IdempotencyFilter> registration =
        new FilterRegistrationBean<>(new IdempotencyFilter(store));
    registration.setOrder(0);
    return registration;
  }
}
