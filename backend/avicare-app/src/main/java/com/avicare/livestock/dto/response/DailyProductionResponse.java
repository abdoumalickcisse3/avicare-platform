package com.avicare.livestock.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;

/** A daily egg-production snapshot as returned by the API. */
public record DailyProductionResponse(
    Long unitId,
    LocalDate productionDate,
    int totalEggsCollected,
    int totalBrokenEggs,
    Map<String, Integer> gradesAggregate,
    BigDecimal layingRatePct,
    BigDecimal breakRatePct,
    Integer activeLayersCount,
    LocalDateTime closedAt,
    Long closedById) {}
