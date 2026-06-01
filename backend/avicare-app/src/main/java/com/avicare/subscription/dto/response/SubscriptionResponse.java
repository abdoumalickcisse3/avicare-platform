package com.avicare.subscription.dto.response;

import com.avicare.subscription.domain.SubscriptionStatus;
import java.time.LocalDateTime;
import java.util.List;

/** HTTP view of a farm's subscription with its modules. */
public record SubscriptionResponse(
    Long id,
    Long farmId,
    SubscriptionStatus status,
    String planKey,
    LocalDateTime expiresAt,
    List<ModuleResponse> modules) {}
