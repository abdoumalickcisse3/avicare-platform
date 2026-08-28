package com.avicare.admin.dto.response;

import java.util.List;

/**
 * The signed-in staff member's profile. The console builds its navigation from {@code permissions}:
 * an entry the caller cannot use is never rendered.
 */
public record AdminMeResponse(
    Long userId, String email, String fullName, List<String> permissions, boolean superAdmin) {}
