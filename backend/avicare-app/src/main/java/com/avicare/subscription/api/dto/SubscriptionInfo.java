package com.avicare.subscription.api.dto;

import com.avicare.subscription.domain.SubscriptionStatus;
import java.util.List;

/**
 * Public, cross-context view of a farm's subscription (doc 03 §4): its status and the keys of the
 * currently enabled modules.
 */
public record SubscriptionInfo(
    Long id, Long farmId, SubscriptionStatus status, String planKey, List<String> enabledModules) {}
