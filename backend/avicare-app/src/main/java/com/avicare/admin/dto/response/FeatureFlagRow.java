package com.avicare.admin.dto.response;

import java.time.LocalDateTime;

/**
 * One switch as the console shows it.
 *
 * @param secondsRemaining time left before the cut lifts itself, so the screen can count down
 *     instead of making someone subtract two timestamps in their head
 */
public record FeatureFlagRow(
    String flagKey,
    boolean enabledGlobally,
    boolean killswitchActive,
    String killswitchReason,
    Long killswitchBy,
    LocalDateTime killswitchAt,
    LocalDateTime killswitchExpiresAt,
    Long secondsRemaining) {}
