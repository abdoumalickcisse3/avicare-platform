package com.avicare.finance.dto.response;

import java.time.LocalDateTime;

/** Salary advance request for a farm member (Sprint B6 P2). */
public record AdvanceResponse(
    Long id,
    Long userId,
    Long amountXof,
    String reason,
    String status,
    LocalDateTime requestedAt,
    Long remainingXof) {}
