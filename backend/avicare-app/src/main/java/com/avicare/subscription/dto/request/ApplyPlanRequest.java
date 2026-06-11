package com.avicare.subscription.dto.request;

import jakarta.validation.constraints.NotBlank;

/** Apply a subscription plan (pré-bundle) to a farm, resolving its modules server-side. */
public record ApplyPlanRequest(@NotBlank String planKey) {}
