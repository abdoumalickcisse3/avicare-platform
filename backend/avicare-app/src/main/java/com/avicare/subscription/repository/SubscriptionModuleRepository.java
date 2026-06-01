package com.avicare.subscription.repository;

import com.avicare.subscription.domain.SubscriptionModule;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** Data access for {@link SubscriptionModule} entitlements. */
public interface SubscriptionModuleRepository extends JpaRepository<SubscriptionModule, Long> {

  List<SubscriptionModule> findBySubscriptionId(Long subscriptionId);

  Optional<SubscriptionModule> findBySubscriptionIdAndModuleKey(
      Long subscriptionId, String moduleKey);
}
