package com.avicare.finance.dto.request;

import jakarta.validation.constraints.NotBlank;

/** Trigger monthly salary generation for a farm (Sprint B6 P2). {@code period} is "YYYY-MM". */
public record GenerateSalariesRequest(@NotBlank String period) {}
