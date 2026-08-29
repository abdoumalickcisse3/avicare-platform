package com.avicare.admin.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/**
 * Publish the anonymous comparison, or stop publishing it.
 *
 * <p>{@code minCohort} is the privacy floor, not a display preference: below it nothing is served
 * at all. The service clamps it upward as well, so a value that slipped past validation still
 * cannot narrow the cohort to the point where a farm reads its neighbours' figures.
 */
public record BenchmarkSettingsRequest(boolean enabled, @Min(1) @Max(1000) int minCohort) {}
