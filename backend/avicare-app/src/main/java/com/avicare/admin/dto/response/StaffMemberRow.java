package com.avicare.admin.dto.response;

import java.time.LocalDateTime;
import java.util.List;

/**
 * One member of the platform staff, with the permissions they actually hold.
 *
 * <p>{@code superAdmin} is derived from the {@code "*"} permission, not from the role: every row
 * here has {@code UserRole.ADMIN}, so the role says nothing that distinguishes them.
 */
public record StaffMemberRow(
    Long userId,
    String email,
    String fullName,
    List<String> permissions,
    boolean superAdmin,
    boolean active,
    LocalDateTime lastLoginAt) {}
