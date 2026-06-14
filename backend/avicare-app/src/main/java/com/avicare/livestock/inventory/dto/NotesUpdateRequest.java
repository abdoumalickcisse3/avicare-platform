package com.avicare.livestock.inventory.dto;

import jakarta.validation.constraints.Size;

/** Set a stock item's free-form notes (Sprint B4-6). */
public record NotesUpdateRequest(@Size(max = 2000) String notes) {}
