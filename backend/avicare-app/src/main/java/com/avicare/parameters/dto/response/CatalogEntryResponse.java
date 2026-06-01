package com.avicare.parameters.dto.response;

import java.util.Map;

/** HTTP view of an effective catalog entry for a farm. */
public record CatalogEntryResponse(
    String category, String key, Map<String, Object> value, boolean custom) {}
