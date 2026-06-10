package com.avicare.livestock.dto.response;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;

/** An egg collection as returned by the API. */
public record EggCollectionResponse(
    Long id,
    Long unitId,
    LocalDate collectionDate,
    String timeslotKey,
    int totalEggs,
    int brokenEggs,
    Map<String, Integer> gradesCount,
    Long collectorUserId,
    String notes,
    Long createdBy,
    LocalDateTime createdAt,
    LocalDateTime updatedAt) {}
