package com.avicare.livestock.dto.response;

import com.avicare.livestock.domain.Species;

/**
 * HTTP view of a breed reference entry. {@code type} is broiler|layer for poultry (may be null).
 */
public record BreedResponse(
    Long id, Species species, String code, String name, String type, Long farmId, boolean active) {}
