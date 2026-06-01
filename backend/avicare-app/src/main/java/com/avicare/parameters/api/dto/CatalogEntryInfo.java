package com.avicare.parameters.api.dto;

import java.util.Map;

/** Public, cross-context view of a resolved catalog entry (doc 03 §4). */
public record CatalogEntryInfo(
    String category, String key, Map<String, Object> value, boolean custom) {}
