package com.avicare.subscription.dto.response;

import com.avicare.subscription.domain.RequestStatus;
import java.time.LocalDateTime;
import java.util.List;

/** HTTP view of a subscription change request. */
public record ChangeRequestResponse(
    Long id,
    Long subscriptionId,
    String requestedPlan,
    List<String> requestedModules,
    RequestStatus status,
    Long requestedBy,
    Long reviewerId,
    LocalDateTime reviewedAt,
    String reason) {}
