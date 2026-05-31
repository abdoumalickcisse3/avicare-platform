package com.avicare.tenancy.dto.request;

import com.avicare.common.security.principal.FarmRole;
import jakarta.validation.constraints.NotNull;
import java.util.List;

/**
 * Change a member's role and (optionally) override their permissions. When {@code permissions} is
 * {@code null} the new role's default permissions are applied.
 */
public record UpdateMemberRequest(@NotNull FarmRole role, List<String> permissions) {}
