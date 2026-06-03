package com.avicare.livestock.dto.response;

import com.avicare.livestock.domain.Species;

/** HTTP view of a breed reference entry. */
public record BreedResponse(
    Long id, Species species, String code, String name, Long farmId, boolean active) {}
