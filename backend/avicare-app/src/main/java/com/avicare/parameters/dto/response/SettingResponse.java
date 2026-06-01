package com.avicare.parameters.dto.response;

import java.util.Map;

/** HTTP view of a stored setting. */
public record SettingResponse(String key, Map<String, Object> value) {}
