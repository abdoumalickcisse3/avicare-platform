package com.avicare.tenancy.api.dto;

import com.avicare.common.security.principal.FarmRole;
import java.util.List;

/**
 * Public, cross-context view of a user's membership on a farm, exposed via {@link
 * com.avicare.tenancy.api.TenancyFacade}.
 */
public record UserFarmInfo(
    Long userId, Long farmId, FarmRole role, List<String> permissions, boolean active) {}
