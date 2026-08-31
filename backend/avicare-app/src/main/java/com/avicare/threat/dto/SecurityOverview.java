package com.avicare.threat.dto;

import java.util.List;
import java.util.Map;

/** The screen in one payload: what happened, what is refused, and the headline numbers. */
public record SecurityOverview(
    Map<String, Long> counters, List<SecurityEventRow> events, List<BlockedIpRow> blocked) {}
