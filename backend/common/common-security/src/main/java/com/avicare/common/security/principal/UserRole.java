package com.avicare.common.security.principal;

/**
 * Platform-level role carried in the JWT.
 *
 * <p>Two-level system (YAGNI for V1): every actual user is a {@link #USER}; only AviCare platform
 * staff is {@link #ADMIN}. Tenant-level authority is handled separately by {@link FarmRole} via
 * the per-farm {@link Membership}s.
 *
 * <p>Adding a third platform-wide role later is a non-breaking change for existing tokens (the
 * existing two values keep their semantics); collapsing two values into one would break clients.
 */
public enum UserRole {

  /** AviCare platform staff. Bypasses every tenant-level access check. */
  ADMIN,

  /** Standard user. Access is scoped to their farm memberships. */
  USER
}
