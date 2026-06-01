package com.avicare.subscription.dto.request;

import java.util.List;

/**
 * Create a subscription change request. {@code requestedModules} are module keys to enable on
 * approval; {@code requestedPlan} is optional.
 */
public record CreateChangeRequestRequest(String requestedPlan, List<String> requestedModules) {}
