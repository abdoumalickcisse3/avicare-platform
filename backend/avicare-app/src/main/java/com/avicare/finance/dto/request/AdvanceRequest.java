package com.avicare.finance.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

/** Self-request of a salary advance by a farm member (Sprint B6 P2). */
public record AdvanceRequest(
    @NotNull Long farmId, @NotNull @Positive Long amountXof, @Size(max = 200) String reason) {}
