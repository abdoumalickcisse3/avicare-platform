package com.avicare.admin.dto.response;

import java.time.LocalDateTime;

/**
 * What is actually running.
 *
 * <p>Answers the question asked in every incident — "is the fix deployed?" — without an SSH
 * session. The Flyway version is the honest marker: it moves with the schema, and a mismatch
 * between what was merged and what answers here is the whole point of showing it.
 */
public record PlatformRuntime(
    String schemaVersion,
    long appliedMigrations,
    String applicationVersion,
    LocalDateTime serverTime,
    boolean whatsappEnabled) {}
