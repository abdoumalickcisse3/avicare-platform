package com.avicare.common.tenancy.context;

import java.util.List;
import java.util.Objects;

/**
 * Immutable per-request tenancy data, stored in {@link TenancyContext}.
 *
 * <p>Built by the authentication layer ({@code JwtFilter} in {@code common-security}, Sprint A2
 * Session 4+) after JWT decoding, and consumed by services that need to scope queries by farm.
 *
 * <p>{@code accessibleFarmIds} is defensively copied to guarantee immutability — never returns the
 * caller's mutable list.
 *
 * @param userId identifier of the authenticated user
 * @param accessibleFarmIds farms the user has access to (empty list = none)
 * @param isSuperAdmin {@code true} when the user bypasses farm-scoping
 */
public record TenantData(Long userId, List<Long> accessibleFarmIds, boolean isSuperAdmin) {

  public TenantData {
    Objects.requireNonNull(userId, "userId must not be null");
    Objects.requireNonNull(accessibleFarmIds, "accessibleFarmIds must not be null");
    accessibleFarmIds = List.copyOf(accessibleFarmIds);
  }
}
