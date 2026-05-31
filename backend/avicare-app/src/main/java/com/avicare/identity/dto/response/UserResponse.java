package com.avicare.identity.dto.response;

import com.avicare.common.security.principal.UserRole;

/** Public profile view of a {@code User}. Never exposes the password hash. */
public record UserResponse(
    Long id, String email, String fullName, String phone, String locale, UserRole role) {}
