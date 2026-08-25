package com.avicare.partner.dto.response;

import java.util.List;

/** The restock view: head figures over the horizon, and every upcoming batch, soonest first. */
public record RestockForecastResponse(
    RestockForecastSummary summary, List<RestockForecastRow> rows) {}
