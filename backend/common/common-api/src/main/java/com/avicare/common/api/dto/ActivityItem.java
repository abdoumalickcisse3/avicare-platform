package com.avicare.common.api.dto;

import java.time.LocalDateTime;

/**
 * One item in a farm's recent-activity feed. {@code kind} is a stable machine tag (e.g. {@code
 * MORTALITY}, {@code VET_VISIT_RECORDED}, {@code SALE}, {@code PAYMENT}, {@code STOCK_IN}); {@code
 * at} is the sort key (most recent first); {@code label} is a ready-to-display French line; {@code
 * detail} is an optional secondary line (nullable).
 */
public record ActivityItem(String kind, LocalDateTime at, String label, String detail) {}
