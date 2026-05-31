package com.avicare.identity.spi;

import com.avicare.common.security.principal.Membership;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Fallback {@link MembershipProvider} used only when no real implementation (tenancy's {@code
 * MembershipProviderImpl}) is on the context. Returns no memberships, keeping the identity context
 * bootable on its own.
 */
@Configuration
public class NoMembershipProvider {

  @Bean
  @ConditionalOnMissingBean(MembershipProvider.class)
  public MembershipProvider noMembershipProvider() {
    return userId -> List.<Membership>of();
  }
}
