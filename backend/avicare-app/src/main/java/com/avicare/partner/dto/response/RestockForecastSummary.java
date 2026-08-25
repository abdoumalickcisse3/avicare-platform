package com.avicare.partner.dto.response;

/** Head figures of the restock view, over the requested horizon only. */
public record RestockForecastSummary(int horizonDays, int batchCount, long estimatedFeedKg) {}
