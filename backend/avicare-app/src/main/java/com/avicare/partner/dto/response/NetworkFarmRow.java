package com.avicare.partner.dto.response;

/**
 * One farm as seen by a partner (Couche « Voir »). {@code farmName} is always present for a
 * confirmed member; each metric is {@code null} when the farm does not share the matching scope
 * ({@code activity}→active and riskLevel, {@code feed_consumption}→feedKg, {@code
 * flock_health}→mortalityRate).
 *
 * <p>{@code riskLevel} ({@code OK}/{@code WATCH}/{@code AT_RISK}, couche « Garder ») says how long
 * the farm has gone without entering anything. It rides on the {@code activity} scope: a farm that
 * keeps its activity private is unmeasured here too, not silently reported as {@code OK}.
 */
public record NetworkFarmRow(
    Long farmId,
    String farmName,
    Boolean active,
    Long feedKg,
    Double mortalityRate,
    String riskLevel) {}
