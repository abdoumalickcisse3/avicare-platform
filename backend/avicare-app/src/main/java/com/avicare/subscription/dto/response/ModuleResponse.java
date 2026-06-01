package com.avicare.subscription.dto.response;

import com.avicare.subscription.domain.FeatureMode;
import java.time.LocalDateTime;

/** HTTP view of a subscription module (entitlement). */
public record ModuleResponse(String moduleKey, FeatureMode mode, LocalDateTime expiresAt) {}
