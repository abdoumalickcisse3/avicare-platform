package com.avicare.identity.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Provides the platform's password hashing strategy.
 *
 * <p>BCrypt with strength 12 (per CLAUDE.md Sprint A3+ rules): strong enough for V1 while keeping
 * the per-hash cost acceptable on the target hardware.
 */
@Configuration
public class PasswordConfig {

  @Bean
  public PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder(12);
  }
}
