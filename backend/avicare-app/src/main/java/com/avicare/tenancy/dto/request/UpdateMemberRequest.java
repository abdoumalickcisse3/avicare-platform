package com.avicare.tenancy.dto.request;

import com.avicare.common.security.principal.FarmRole;
import jakarta.validation.constraints.NotNull;
import java.util.List;

/**
 * Change a member's role, optionally override permissions (null = role defaults), and optionally
 * toggle the membership active flag (null = unchanged).
 */
public record UpdateMemberRequest(
    @NotNull FarmRole role, List<String> permissions, Boolean active) {}
