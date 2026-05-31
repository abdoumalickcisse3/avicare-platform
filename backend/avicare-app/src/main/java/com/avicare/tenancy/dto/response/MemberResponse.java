package com.avicare.tenancy.dto.response;

import com.avicare.common.security.principal.FarmRole;
import java.util.List;

/** HTTP view of a farm membership. */
public record MemberResponse(
    Long id, Long userId, Long farmId, FarmRole role, List<String> permissions, boolean active) {}
