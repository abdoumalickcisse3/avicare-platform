package com.avicare.livestock.dto.response;

import com.avicare.livestock.domain.Species;
import com.avicare.livestock.domain.UnitKind;
import com.avicare.livestock.domain.UnitStatus;
import java.time.LocalDate;

/** HTTP view of a production unit. */
public record ProductionUnitResponse(
    Long id,
    Long farmId,
    Species species,
    UnitKind unitKind,
    Long breedId,
    String name,
    LocalDate startDate,
    LocalDate endDate,
    int currentCount,
    UnitStatus status) {}
