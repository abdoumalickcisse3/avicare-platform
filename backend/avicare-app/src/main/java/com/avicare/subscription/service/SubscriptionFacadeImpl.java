package com.avicare.subscription.service;

import com.avicare.subscription.api.SubscriptionFacade;
import com.avicare.subscription.api.dto.SubscriptionInfo;
import com.avicare.subscription.domain.SubscriptionModule;
import com.avicare.subscription.flags.FeatureFlagService;
import com.avicare.subscription.repository.SubscriptionModuleRepository;
import com.avicare.subscription.repository.SubscriptionRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Default {@link SubscriptionFacade} implementation. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SubscriptionFacadeImpl implements SubscriptionFacade {

  private final SubscriptionService subscriptionService;
  private final FeatureFlagService featureFlags;
  private final SubscriptionRepository subscriptionRepository;
  private final SubscriptionModuleRepository subscriptionModuleRepository;

  /**
   * {@inheritDoc}
   *
   * <p>A platform kill switch wins over the farm's own subscription: the callers that read this
   * directly — reporting, health alerts, the D18 stock cascade — never go through {@code
   * FeatureChecker}, and a cut that only covered the annotated endpoints would leave exactly the
   * cross-context writes we most want stopped still running.
   */
  @Override
  public boolean isModuleEnabled(Long farmId, String moduleKey) {
    if (featureFlags.isBlocked(moduleKey)) {
      return false;
    }
    return subscriptionService.isModuleEnabled(farmId, moduleKey);
  }

  @Override
  public List<String> listEnabledModules(Long farmId) {
    return subscriptionRepository
        .findByFarmId(farmId)
        .map(sub -> subscriptionModuleRepository.findBySubscriptionId(sub.getId()))
        .orElseGet(List::of)
        .stream()
        .filter(m -> m.getExpiresAt() == null || m.getExpiresAt().isAfter(LocalDateTime.now()))
        .map(SubscriptionModule::getModuleKey)
        .toList();
  }

  @Override
  public Optional<SubscriptionInfo> findByFarm(Long farmId) {
    return subscriptionRepository
        .findByFarmId(farmId)
        .map(
            sub ->
                new SubscriptionInfo(
                    sub.getId(),
                    sub.getFarmId(),
                    sub.getStatus(),
                    sub.getPlanKey(),
                    listEnabledModules(farmId)));
  }

  @Override
  public void provisionModules(Long farmId) {
    subscriptionService.getOrCreate(farmId);
  }
}
