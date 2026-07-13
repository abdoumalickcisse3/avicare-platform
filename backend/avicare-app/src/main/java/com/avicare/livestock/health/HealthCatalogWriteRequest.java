package com.avicare.livestock.health;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.Map;

/** Create/update a custom farm-level health-library entry (vaccine or treatment). */
public record HealthCatalogWriteRequest(
    @NotBlank @Size(max = 100) String key, @NotNull Map<String, Object> value) {}
