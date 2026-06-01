package com.avicare.parameters.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

/** Create a price list for a farm. */
public record CreatePriceListRequest(
    @NotBlank @Size(max = 200) String name,
    boolean isDefault,
    @NotNull LocalDate validFrom,
    LocalDate validTo) {}
