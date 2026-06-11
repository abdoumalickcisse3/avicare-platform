package com.avicare.tenancy.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;

/** Editable farm fields. */
public record UpdateFarmRequest(
    @NotBlank @Size(max = 200) String name,
    @Size(max = 2000) String description,
    @Size(max = 500) String location,
    BigDecimal gpsLatitude,
    BigDecimal gpsLongitude,
    Integer capacity,
    @Size(max = 50) String timezone,
    @Size(max = 3) String currency,
    /** Métier focus tokens (broiler/layer), Décision 17. Null = leave unchanged. */
    List<String> productionFocus) {}
