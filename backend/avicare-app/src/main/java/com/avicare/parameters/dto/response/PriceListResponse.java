package com.avicare.parameters.dto.response;

import java.time.LocalDate;

/** HTTP view of a price list. */
public record PriceListResponse(
    Long id, String name, boolean isDefault, LocalDate validFrom, LocalDate validTo) {}
