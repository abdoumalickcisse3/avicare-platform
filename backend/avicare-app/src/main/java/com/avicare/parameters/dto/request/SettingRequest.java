package com.avicare.parameters.dto.request;

import jakarta.validation.constraints.NotNull;
import java.util.Map;

/** Upsert payload for a farm or user setting: the JSONB value object. */
public record SettingRequest(@NotNull Map<String, Object> value) {}
