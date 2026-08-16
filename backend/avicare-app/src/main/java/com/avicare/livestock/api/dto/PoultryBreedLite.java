package com.avicare.livestock.api.dto;

/**
 * Minimal poultry breed reference exposed by {@link com.avicare.livestock.api.LivestockFacade} so a
 * transverse caller (the assistant) can resolve a breed spoken by name to its id when creating a
 * lot.
 */
public record PoultryBreedLite(Long id, String code, String name) {}
