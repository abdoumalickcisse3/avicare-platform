package com.avicare.livestock.layer;

import java.time.LocalDate;
import java.util.Map;

/**
 * Command to record (upsert) an egg collection on a production unit. {@code totalEggs} is the good
 * (gradable) egg count; {@code brokenEggs} is separate. {@code gradesCount} maps grade keys to
 * counts (validated against the farm's configured grades). {@code collectorUserId} is who
 * physically collected (optional); the acting user (author) is passed separately to the service.
 */
public record EggCollectionCommand(
    LocalDate collectionDate,
    String timeslotKey,
    int totalEggs,
    int brokenEggs,
    Map<String, Integer> gradesCount,
    Long collectorUserId,
    String notes) {}
