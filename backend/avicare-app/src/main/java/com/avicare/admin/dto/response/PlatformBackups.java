package com.avicare.admin.dto.response;

import java.time.LocalDateTime;

/**
 * How fresh the database dumps are.
 *
 * <p>Reports only what the mounted directory can prove. {@code offsiteConfigured} says an rclone
 * remote is set, <b>not</b> that the last upload succeeded — the container cannot see the remote,
 * and a green light that means nothing is worse than no light at all.
 *
 * @param mounted false when the backup directory is not visible to the application, which is the
 *     honest answer for a local run and for a deployment that has not been updated
 */
public record PlatformBackups(
    boolean mounted,
    LocalDateTime lastDumpAt,
    Long ageHours,
    int dumpCount,
    long totalBytes,
    boolean stale,
    boolean offsiteConfigured) {}
