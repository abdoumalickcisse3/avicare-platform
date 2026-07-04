package com.avicare.finance.dto.response;

import java.time.LocalDateTime;

/** Salary record for a farm member in a given period (Sprint B6 P2). */
public record SalaryResponse(
    Long id,
    Long userId,
    String period,
    Long grossXof,
    Long advanceDeductedXof,
    Long netXof,
    String status,
    LocalDateTime paidAt) {}
