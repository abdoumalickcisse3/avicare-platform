package com.avicare.tenancy.dto.response;

import com.avicare.common.security.principal.FarmRole;
import java.util.List;

/** HTTP view of a farm membership (with the member's identity). */
public record MemberResponse(
    Long id,
    Long userId,
    Long farmId,
    String fullName,
    String email,
    String phone,
    FarmRole role,
    List<String> permissions,
    boolean active) {}
