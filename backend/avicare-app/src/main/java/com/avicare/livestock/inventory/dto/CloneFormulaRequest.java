package com.avicare.livestock.inventory.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Clone a platform feed-formula template into a farm formula (Sprint B4-6). */
public record CloneFormulaRequest(
    @NotBlank @Size(max = 120) String sourceFormulaKey, @Size(max = 200) String newName) {}
