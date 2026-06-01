package com.avicare.parameters.dto.response;

import com.avicare.parameters.domain.AlertSeverity;
import java.math.BigDecimal;

/** HTTP view of an alert threshold. */
public record ThresholdResponse(
    String thresholdType, BigDecimal value, AlertSeverity severity, boolean active) {}
