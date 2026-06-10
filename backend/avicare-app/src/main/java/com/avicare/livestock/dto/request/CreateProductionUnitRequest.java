package com.avicare.livestock.dto.request;

import com.avicare.livestock.domain.UnitKind;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

/**
 * Create a generic production unit on a farm (e.g. a layer/ponte lot). Species is POULTRY in V1 and
 * derived from the breed; {@code unitKind} defaults to BATCH when omitted.
 */
public record CreateProductionUnitRequest(
    @Size(max = 200) String name,
    @NotNull Long breedId,
    UnitKind unitKind,
    @Positive int initialCount,
    @NotNull LocalDate startDate,
    @Size(max = 2000) String notes) {}
