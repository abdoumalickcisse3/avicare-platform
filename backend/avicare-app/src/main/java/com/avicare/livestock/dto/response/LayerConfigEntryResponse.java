package com.avicare.livestock.dto.response;

import java.util.Map;

/** A configured layer catalog entry (a time-slot or a grade) for a farm. */
public record LayerConfigEntryResponse(String key, Map<String, Object> value) {}
