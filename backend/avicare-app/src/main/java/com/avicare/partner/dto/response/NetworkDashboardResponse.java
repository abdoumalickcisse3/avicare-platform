package com.avicare.partner.dto.response;

/**
 * Aggregated network snapshot (Couche « Voir »). Each aggregate only counts the farms that share
 * the relevant scope: {@code totalFeedKg} over farms sharing {@code feed_consumption}, {@code
 * avgMortalityRate} over farms sharing {@code flock_health} (null when none share it).
 */
public record NetworkDashboardResponse(
    int farmCount, int activeFarmCount, Long totalFeedKg, Double avgMortalityRate) {}
