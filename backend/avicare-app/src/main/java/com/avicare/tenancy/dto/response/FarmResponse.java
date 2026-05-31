package com.avicare.tenancy.dto.response;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** HTTP view of a farm. */
public record FarmResponse(
    Long id,
    String name,
    String description,
    String location,
    BigDecimal gpsLatitude,
    BigDecimal gpsLongitude,
    Integer capacity,
    String timezone,
    String currency,
    Long createdBy,
    boolean active,
    LocalDateTime createdAt) {}
