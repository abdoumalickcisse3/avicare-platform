package com.avicare.admin.dto.response;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * The cockpit: how much platform there is, and how much of it is alive.
 *
 * <p>{@code monthlyActiveUsers} counts accounts that signed in over the last 30 days — the only
 * activity signal the platform records for every user, whatever they then did.
 */
public record PlatformOverview(
    long farms,
    long activeFarms,
    long deletedFarms,
    long users,
    long activeUsers,
    long monthlyActiveUsers,
    long staffAccounts,
    Map<String, Long> volumes,
    LocalDateTime generatedAt) {}
