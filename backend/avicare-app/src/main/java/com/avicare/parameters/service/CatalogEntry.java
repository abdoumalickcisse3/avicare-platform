package com.avicare.parameters.service;

import java.util.Map;

/**
 * A resolved catalog entry as seen by a farm: a platform item (possibly overridden) or a pure
 * farm-custom item. {@code custom} is {@code true} when the entry has no platform parent.
 */
public record CatalogEntry(
    String category, String key, Map<String, Object> value, boolean custom) {}
