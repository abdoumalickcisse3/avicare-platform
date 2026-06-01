package com.avicare.subscription.repository;

import com.avicare.subscription.domain.RequestStatus;
import com.avicare.subscription.domain.SubscriptionChangeRequest;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

/** Data access for {@link SubscriptionChangeRequest} workflow rows. */
public interface SubscriptionChangeRequestRepository
    extends JpaRepository<SubscriptionChangeRequest, Long> {

  List<SubscriptionChangeRequest> findBySubscriptionId(Long subscriptionId);

  List<SubscriptionChangeRequest> findBySubscriptionIdAndStatus(
      Long subscriptionId, RequestStatus status);
}
