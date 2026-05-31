package com.avicare.tenancy.dto.request;

import com.avicare.common.security.principal.FarmRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotNull;

/** Invite an existing user (by email) onto a farm with a given role. */
public record AddMemberRequest(@NotNull @Email String email, @NotNull FarmRole role) {}
