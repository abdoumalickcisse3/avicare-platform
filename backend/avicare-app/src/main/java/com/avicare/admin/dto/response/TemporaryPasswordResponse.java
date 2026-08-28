package com.avicare.admin.dto.response;

/**
 * A freshly issued temporary password. Returned once and never stored in clear — the console shows
 * it in a copyable dialog rather than a toast that vanishes.
 */
public record TemporaryPasswordResponse(Long userId, String temporaryPassword) {}
