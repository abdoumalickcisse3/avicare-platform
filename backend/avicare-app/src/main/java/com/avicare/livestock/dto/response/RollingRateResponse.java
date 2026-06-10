package com.avicare.livestock.dto.response;

import java.math.BigDecimal;

/** Rolling average laying rate over the last {@code days} days ({@code null} if no snapshot). */
public record RollingRateResponse(Long unitId, int days, BigDecimal avgLayingRatePct) {}
