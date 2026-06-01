package com.avicare.subscription.repository;

import com.avicare.subscription.domain.Subscription;
import com.avicare.subscription.domain.SubscriptionStatus;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** Data access for {@link Subscription} (one per farm). */
public interface SubscriptionRepository extends JpaRepository<Subscription, Long> {

  Optional<Subscription> findByFarmId(Long farmId);

  Optional<Subscription> findByFarmIdAndStatus(Long farmId, SubscriptionStatus status);
}
