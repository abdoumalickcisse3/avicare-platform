package com.avicare.finance.dto.response;

/** Monthly salary setting for a farm member (Sprint B6 P2). */
public record SalarySettingResponse(Long id, Long userId, Long monthlySalaryXof, boolean active) {}
