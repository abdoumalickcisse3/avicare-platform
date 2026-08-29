package com.avicare.admin.dto.response;

/**
 * One catalog category with its counts, for the console's landing list.
 *
 * <p>{@code editable} is server-side truth, not a UI hint: a category that drives feature gating or
 * platform thresholds is served read-only and the write endpoints refuse it too.
 */
public record AdminCatalogCategory(String category, long total, long active, boolean editable) {}
