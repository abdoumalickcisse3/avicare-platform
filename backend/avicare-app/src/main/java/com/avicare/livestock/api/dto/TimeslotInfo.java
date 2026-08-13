package com.avicare.livestock.api.dto;

/**
 * Public, cross-context view of an egg-collection time-slot (the {@code egg_timeslots} catalog):
 * the stored {@code key} the domain persists and the human {@code label} shown/spoken. Exposed
 * through {@link com.avicare.livestock.api.LivestockFacade} so the assistant can resolve a spoken
 * slot ("matin") to its key without touching the parameters repositories.
 */
public record TimeslotInfo(String key, String label) {}
