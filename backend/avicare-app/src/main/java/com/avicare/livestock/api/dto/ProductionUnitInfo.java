package com.avicare.livestock.api.dto;

import com.avicare.livestock.domain.Species;
import com.avicare.livestock.domain.UnitKind;
import com.avicare.livestock.domain.UnitStatus;

/**
 * Public, cross-context view of a production unit (doc 03 §4). Transverse contexts (health,
 * commercial...) reference units through this record, never the entity hierarchy.
 */
public record ProductionUnitInfo(
    Long id,
    Long farmId,
    Species species,
    UnitKind unitKind,
    Long breedId,
    String name,
    int currentCount,
    UnitStatus status) {}
