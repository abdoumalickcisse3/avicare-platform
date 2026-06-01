package com.avicare.subscription.api;

import com.avicare.subscription.api.dto.SubscriptionInfo;
import java.util.List;
import java.util.Optional;

/**
 * Public contract of the subscription bounded context (doc 03 §4). The {@code @features} SpEL bean
 * and other contexts query entitlements through this facade, never the repositories directly.
 */
public interface SubscriptionFacade {

  /** Whether a module is enabled (included and not expired) for the farm. */
  boolean isModuleEnabled(Long farmId, String moduleKey);

  /** The keys of the farm's currently enabled modules. */
  List<String> listEnabledModules(Long farmId);

  /** The farm's subscription, if any. */
  Optional<SubscriptionInfo> findByFarm(Long farmId);
}
