package com.avicare.admin.dto.response;

import java.time.LocalDateTime;

/** One past flag change, read back from the append-only trail. */
public record FlagHistoryEntry(
    String action, String flagKey, String reason, Long actorUserId, LocalDateTime at) {}
