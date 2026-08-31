package com.avicare.admin.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Cutting a feature for every farm requires saying why.
 *
 * <p>Not politeness: the reason is what the on-call notification carries, what the console shows
 * while the countdown runs, and what the farmer's 503 explains. A cut with no reason is one nobody
 * can safely lift.
 */
public record KillswitchRequest(@NotBlank @Size(max = 500) String reason) {}
