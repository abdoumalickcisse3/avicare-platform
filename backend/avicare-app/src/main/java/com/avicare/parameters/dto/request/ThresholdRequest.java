package com.avicare.parameters.dto.request;

import com.avicare.parameters.domain.AlertSeverity;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

/** Upsert an alert threshold for a farm (keyed by threshold type in the path). */
public record ThresholdRequest(@NotNull BigDecimal value, @NotNull AlertSeverity severity) {}
