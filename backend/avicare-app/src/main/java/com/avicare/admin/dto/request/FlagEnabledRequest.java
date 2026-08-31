package com.avicare.admin.dto.request;

import jakarta.validation.constraints.NotNull;

/** The standing switch, separate from the emergency one. */
public record FlagEnabledRequest(@NotNull Boolean enabled) {}
