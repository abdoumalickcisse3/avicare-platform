package com.avicare.subscription.service;

import com.avicare.subscription.api.SubscriptionFacade;
import com.avicare.subscription.api.dto.SubscriptionInfo;
import com.avicare.subscription.domain.SubscriptionModule;
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
  private final SubscriptionRepository subscriptionRepository;
  private final SubscriptionModuleRepository subscriptionModuleRepository;

  @Override
  public boolean isModuleEnabled(Long farmId, String moduleKey) {
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
}
