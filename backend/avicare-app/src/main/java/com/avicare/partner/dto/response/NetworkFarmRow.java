package com.avicare.partner.dto.response;

/**
 * One farm as seen by a partner (Couche « Voir »). {@code farmName} is always present for a
 * confirmed member; each metric is {@code null} when the farm does not share the matching scope
 * ({@code activity}→active, {@code feed_consumption}→feedKg, {@code flock_health}→mortalityRate).
 */
public record NetworkFarmRow(
    Long farmId, String farmName, Boolean active, Long feedKg, Double mortalityRate) {}
