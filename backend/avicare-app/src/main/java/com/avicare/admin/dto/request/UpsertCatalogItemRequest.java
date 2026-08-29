package com.avicare.admin.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.Map;

/**
 * Create or replace a catalog entry.
 *
 * <p>{@code value} is the whole JSON object as stored, label included: the console splits the label
 * into its own field for editing and folds it back in before sending, so there is never a second
 * copy to keep in sync.
 *
 * <p>{@code category} and {@code key} are constrained to lowercase identifiers because they are
 * looked up from code across the platform — {@code catalog("breeds", "cobb_500")} — and a key with
 * a space or an accent is a lookup that silently returns nothing.
 */
public record UpsertCatalogItemRequest(
    @NotBlank @Pattern(regexp = "^[a-z][a-z0-9_]{1,49}$") String category,
    @NotBlank @Pattern(regexp = "^[a-z0-9][a-z0-9_.-]{0,99}$") String key,
    @Size(max = 10) String locale,
    @NotNull Map<String, Object> value,
    boolean active) {}
