package com.avicare.admin.dto.response;

import java.time.LocalDateTime;

/**
 * What is actually running.
 *
 * <p>Answers the question asked in every incident — "is the fix deployed?" — without an SSH
 * session. The Flyway version is the honest marker: it moves with the schema, and a mismatch
 * between what was merged and what answers here is the whole point of showing it.
 *
 * <p>{@code onCallConfigured} is here for a related reason: the kill switch and the integrity
 * checks both raise alerts to an on-call number, and with none configured those alerts are written
 * to the audit trail and reach nobody. That gap is invisible until the night it matters, so it is
 * stated here, next to everything else one checks during an incident.
 */
public record PlatformRuntime(
    String schemaVersion,
    long appliedMigrations,
    String applicationVersion,
    LocalDateTime serverTime,
    boolean whatsappEnabled,
    boolean onCallConfigured) {}
