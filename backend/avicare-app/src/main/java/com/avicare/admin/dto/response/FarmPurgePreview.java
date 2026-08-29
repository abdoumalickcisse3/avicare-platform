package com.avicare.admin.dto.response;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * What a purge would destroy, and whether it is allowed yet.
 *
 * <p>The counts come from running the exporters, so what is shown here and what is erased cannot
 * drift apart — they are computed from the same source.
 */
public record FarmPurgePreview(
    Long farmId,
    String farmName,
    LocalDateTime deletedAt,
    Long daysSinceDeletion,
    LocalDateTime lastExportAt,
    boolean exportDone,
    boolean retentionElapsed,
    boolean purgeable,
    Map<String, Integer> counts) {}
