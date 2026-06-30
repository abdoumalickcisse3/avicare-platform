package com.avicare.identity.api.dto;

import com.avicare.common.security.principal.UserRole;

/**
 * Public, cross-context view of a user, exposed via {@link
 * com.avicare.identity.api.IdentityFacade}. Other bounded contexts depend on this record, never on
 * the {@code User} entity.
 */
public record UserInfo(
    Long id, String email, String fullName, String phone, UserRole role, boolean active) {}
