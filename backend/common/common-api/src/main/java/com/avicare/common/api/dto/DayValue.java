package com.avicare.common.api.dto;

import java.time.LocalDate;

/**
 * A single time-series data point for dashboard charts: a calendar day and a monetary value in XOF.
 * Shared across facades (commercial, livestock, inventory) so the reporting context can consume
 * them without importing sub-domain types.
 */
public record DayValue(LocalDate date, long valueXof) {}
