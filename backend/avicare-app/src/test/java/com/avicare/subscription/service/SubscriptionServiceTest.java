package com.avicare.subscription.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.avicare.subscription.domain.FeatureMode;
import com.avicare.subscription.domain.Subscription;
import com.avicare.subscription.domain.SubscriptionModule;
import com.avicare.subscription.repository.SubscriptionModuleRepository;
import com.avicare.subscription.repository.SubscriptionRepository;
import java.time.LocalDateTime;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

/** Unit test for {@link SubscriptionService} feature-gating semantics (repositories mocked). */
class SubscriptionServiceTest {

  private SubscriptionRepository subscriptionRepository;
  private SubscriptionModuleRepository subscriptionModuleRepository;
  private SubscriptionService service;

  @BeforeEach
  void setUp() {
    subscriptionRepository = Mockito.mock(SubscriptionRepository.class);
    subscriptionModuleRepository = Mockito.mock(SubscriptionModuleRepository.class);
    service = new SubscriptionService(subscriptionRepository, subscriptionModuleRepository);
  }

  private Subscription subscription() {
    Subscription sub = new Subscription();
    sub.setId(10L);
    sub.setFarmId(7L);
    return sub;
  }

  private SubscriptionModule module(String key, LocalDateTime expiresAt) {
    SubscriptionModule m = new SubscriptionModule();
    m.setSubscriptionId(10L);
    m.setModuleKey(key);
    m.setMode(FeatureMode.HARD);
    m.setExpiresAt(expiresAt);
    return m;
  }

  @Test
  void isModuleEnabled_trueWhenPresentAndNotExpired() {
    when(subscriptionRepository.findByFarmId(7L)).thenReturn(Optional.of(subscription()));
    when(subscriptionModuleRepository.findBySubscriptionIdAndModuleKey(
            10L, "module.poultry.broiler"))
        .thenReturn(Optional.of(module("module.poultry.broiler", null)));

    assertThat(service.isModuleEnabled(7L, "module.poultry.broiler")).isTrue();
  }

  @Test
  void isModuleEnabled_falseWhenAbsent() {
    when(subscriptionRepository.findByFarmId(7L)).thenReturn(Optional.of(subscription()));
    when(subscriptionModuleRepository.findBySubscriptionIdAndModuleKey(any(), any()))
        .thenReturn(Optional.empty());

    assertThat(service.isModuleEnabled(7L, "module.qr_codes")).isFalse();
  }

  @Test
  void isModuleEnabled_falseWhenExpired() {
    when(subscriptionRepository.findByFarmId(7L)).thenReturn(Optional.of(subscription()));
    when(subscriptionModuleRepository.findBySubscriptionIdAndModuleKey(10L, "module.inventory"))
        .thenReturn(Optional.of(module("module.inventory", LocalDateTime.now().minusDays(1))));

    assertThat(service.isModuleEnabled(7L, "module.inventory")).isFalse();
  }

  @Test
  void isModuleEnabled_falseWhenNoSubscription() {
    when(subscriptionRepository.findByFarmId(7L)).thenReturn(Optional.empty());

    assertThat(service.isModuleEnabled(7L, "module.poultry.broiler")).isFalse();
  }

  @Test
  void enableModule_upsertsAndCreatesSubscriptionIfNeeded() {
    when(subscriptionRepository.findByFarmId(7L)).thenReturn(Optional.empty());
    when(subscriptionRepository.save(any(Subscription.class)))
        .thenAnswer(
            i -> {
              Subscription s = i.getArgument(0);
              s.setId(10L);
              return s;
            });
    when(subscriptionModuleRepository.findBySubscriptionIdAndModuleKey(10L, "module.inventory"))
        .thenReturn(Optional.empty());
    when(subscriptionModuleRepository.save(any(SubscriptionModule.class)))
        .thenAnswer(i -> i.getArgument(0));

    SubscriptionModule saved = service.enableModule(7L, "module.inventory", FeatureMode.HARD, null);

    assertThat(saved.getSubscriptionId()).isEqualTo(10L);
    assertThat(saved.getModuleKey()).isEqualTo("module.inventory");
  }
}
