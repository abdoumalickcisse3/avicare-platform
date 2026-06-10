package com.avicare.livestock.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.Map;

/** Record (upsert) an egg collection on a layer unit for a (date, time-slot). */
public record EggCollectionCreateRequest(
    @NotNull Long unitId,
    @NotNull LocalDate collectionDate,
    @NotBlank String timeslotKey,
    @PositiveOrZero int totalEggs,
    @PositiveOrZero int brokenEggs,
    Map<String, Integer> gradesCount,
    Long collectorUserId,
    @Size(max = 2000) String notes) {}
