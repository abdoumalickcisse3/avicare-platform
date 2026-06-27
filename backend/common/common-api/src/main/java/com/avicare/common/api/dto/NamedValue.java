package com.avicare.common.api.dto;

/**
 * A named entity ranked by a monetary value in XOF, used for top-N dashboard rankings (e.g. top
 * clients by revenue, top debtors by outstanding balance). {@code clientId} is the entity's
 * surrogate id; {@code name} is a display label snapshot taken at query time.
 */
public record NamedValue(Long clientId, String name, long valueXof) {}
