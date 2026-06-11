package com.avicare.tenancy.dto.response;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * HTTP view of a farm. {@code productionFocus} is the métier focus (broiler/layer), Décision 17.
 */
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
    LocalDateTime createdAt,
    List<String> productionFocus) {}
