package com.avicare.admin.dto.response;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * One catalog entry as the console shows it.
 *
 * <p>{@code label} is lifted out of {@code value} because most categories carry one and the screen
 * puts it in its own field — but it stays inside {@code value} too, which remains the single stored
 * truth. Categories without a label (a bare threshold, say) simply have none.
 */
public record AdminCatalogItemRow(
    Long id,
    String category,
    String key,
    String locale,
    String label,
    Map<String, Object> value,
    boolean active,
    boolean editable,
    LocalDateTime updatedAt) {}
