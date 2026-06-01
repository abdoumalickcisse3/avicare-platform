package com.avicare.subscription.dto.request;

import com.avicare.subscription.domain.FeatureMode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;

/** Enable (or update) a module on a farm's subscription. */
public record EnableModuleRequest(
    @NotBlank @Size(max = 100) String moduleKey, FeatureMode mode, LocalDateTime expiresAt) {}
