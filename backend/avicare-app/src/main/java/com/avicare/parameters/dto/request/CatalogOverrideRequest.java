package com.avicare.parameters.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.Map;

/** Override or add a farm-level catalog entry. */
public record CatalogOverrideRequest(
    @NotBlank @Size(max = 100) String key, @NotNull Map<String, Object> value) {}
