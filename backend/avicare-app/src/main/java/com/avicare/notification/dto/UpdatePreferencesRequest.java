package com.avicare.notification.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import java.util.List;

/** Bulk upsert of a user's notification preference overrides for a farm (Sprint C1). */
public record UpdatePreferencesRequest(@NotNull List<Item> preferences) {

  @Schema(name = "NotificationPreferenceItem")
  public record Item(
      @NotNull String category,
      @NotNull String channel,
      boolean enabled,
      @NotNull String minSeverity) {}
}
