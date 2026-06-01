package com.avicare.subscription.service;

import com.avicare.common.api.exception.NotFoundException;
import com.avicare.subscription.domain.FeatureMode;
import com.avicare.subscription.domain.Subscription;
import com.avicare.subscription.domain.SubscriptionModule;
import com.avicare.subscription.domain.SubscriptionStatus;
import com.avicare.subscription.repository.SubscriptionModuleRepository;
import com.avicare.subscription.repository.SubscriptionRepository;
import java.time.LocalDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Manages a farm's subscription and its activated feature modules (no bundles table — Décision 15).
 *
 * <p>Feature gating semantics (Décision 14, V1): a module is <b>enabled</b> for a farm when a
 * non-expired {@link SubscriptionModule} row exists for it — presence is the gate. The {@link
 * FeatureMode} ({@code OFF}/{@code HARD}) qualifies how a <i>non-enabled</i> module is refused at
 * the UX level (silent 403 vs "upgrade your plan"); it is not the on/off switch itself.
 */
@Service
@RequiredArgsConstructor
public class SubscriptionService {

  private final SubscriptionRepository subscriptionRepository;
  private final SubscriptionModuleRepository subscriptionModuleRepository;

  /** Return the farm's subscription, creating a TRIAL one on first access. */
  @Transactional
  public Subscription getOrCreate(Long farmId) {
    return subscriptionRepository
        .findByFarmId(farmId)
        .orElseGet(
            () -> {
              Subscription sub = new Subscription();
              sub.setFarmId(farmId);
              sub.setStatus(SubscriptionStatus.TRIAL);
              return subscriptionRepository.save(sub);
            });
  }

  @Transactional(readOnly = true)
  public Subscription get(Long farmId) {
    return subscriptionRepository
        .findByFarmId(farmId)
        .orElseThrow(
            () ->
                new NotFoundException(
                    "SUBSCRIPTION_NOT_FOUND", "No subscription for farm " + farmId));
  }

  @Transactional(readOnly = true)
  public List<SubscriptionModule> listModules(Long farmId) {
    return subscriptionModuleRepository.findBySubscriptionId(get(farmId).getId());
  }

  /** Enable (or update) a module on the farm's subscription. Creates the subscription if needed. */
  @Transactional
  public SubscriptionModule enableModule(
      Long farmId, String moduleKey, FeatureMode mode, LocalDateTime expiresAt) {
    Subscription subscription = getOrCreate(farmId);
    SubscriptionModule module =
        subscriptionModuleRepository
            .findBySubscriptionIdAndModuleKey(subscription.getId(), moduleKey)
            .orElseGet(SubscriptionModule::new);
    module.setSubscriptionId(subscription.getId());
    module.setModuleKey(moduleKey);
    module.setMode(mode != null ? mode : FeatureMode.HARD);
    module.setExpiresAt(expiresAt);
    return subscriptionModuleRepository.save(module);
  }

  /** Remove a module from the farm's subscription (idempotent). */
  @Transactional
  public void disableModule(Long farmId, String moduleKey) {
    subscriptionRepository
        .findByFarmId(farmId)
        .flatMap(
            sub ->
                subscriptionModuleRepository.findBySubscriptionIdAndModuleKey(
                    sub.getId(), moduleKey))
        .ifPresent(subscriptionModuleRepository::delete);
  }

  /**
   * Whether {@code moduleKey} is enabled for the farm: a subscription module row exists and is not
   * expired.
   */
  @Transactional(readOnly = true)
  public boolean isModuleEnabled(Long farmId, String moduleKey) {
    return subscriptionRepository
        .findByFarmId(farmId)
        .flatMap(
            sub ->
                subscriptionModuleRepository.findBySubscriptionIdAndModuleKey(
                    sub.getId(), moduleKey))
        .filter(m -> m.getExpiresAt() == null || m.getExpiresAt().isAfter(LocalDateTime.now()))
        .isPresent();
  }
}
