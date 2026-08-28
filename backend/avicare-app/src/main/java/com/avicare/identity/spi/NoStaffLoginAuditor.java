package com.avicare.identity.spi;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Fallback {@link StaffLoginAuditor} used when the admin context is absent. Records nothing, which
 * is correct: without the back-office there is no staff trail to keep.
 */
@Configuration
public class NoStaffLoginAuditor {

  @Bean
  @ConditionalOnMissingBean(StaffLoginAuditor.class)
  public StaffLoginAuditor noStaffLoginAuditor() {
    return (userId, email) -> {};
  }
}
