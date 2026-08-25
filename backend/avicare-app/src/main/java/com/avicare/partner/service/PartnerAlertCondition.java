package com.avicare.partner.service;

import com.avicare.partner.domain.AlertCategory;
import com.avicare.partner.domain.AlertSeverity;

/**
 * One alert condition currently true for a partner about one of its member farms, before it is
 * materialized. {@code dedupKey} identifies the episode: the same key seen again is the same alert,
 * a different key is a new one.
 *
 * <p>{@code title} and {@code body} are ready-to-display French text and must carry nothing beyond
 * what the farm's shared scopes allow — they are the part of an alert a partner actually reads.
 */
public record PartnerAlertCondition(
    AlertCategory category, AlertSeverity severity, String dedupKey, String title, String body) {}
