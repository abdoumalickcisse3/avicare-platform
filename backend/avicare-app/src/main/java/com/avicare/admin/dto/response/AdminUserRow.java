package com.avicare.admin.dto.response;

import java.time.LocalDateTime;

/** One account in the cross-tenant support search. */
public record AdminUserRow(
    Long userId,
    String email,
    String fullName,
    String phone,
    String role,
    boolean active,
    LocalDateTime lastLoginAt) {}
