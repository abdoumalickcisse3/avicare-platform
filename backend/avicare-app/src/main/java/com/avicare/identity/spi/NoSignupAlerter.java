package com.avicare.identity.spi;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Repli de {@link SignupAlerter} quand le contexte admin est absent. N'alerte personne, ce qui est
 * correct : sans back-office, il n'y a ni main courante ni numéro d'astreinte.
 *
 * <p>Ce repli n'est pas une précaution théorique — c'est lui qui garde {@code identity} démarrable
 * seul, et avec lui les contextes de test qui tournent sans base.
 */
@Configuration
public class NoSignupAlerter {

  @Bean
  @ConditionalOnMissingBean(SignupAlerter.class)
  public SignupAlerter noSignupAlerter() {
    return (userId, fullName, email, phone) -> {};
  }
}
