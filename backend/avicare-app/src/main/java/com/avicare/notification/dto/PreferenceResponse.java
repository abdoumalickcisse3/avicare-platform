package com.avicare.notification.dto;

/** Resolved delivery preference for one (category, channel) cell of the preferences grid. */
public record PreferenceResponse(
    String category, String channel, boolean enabled, String minSeverity) {}
