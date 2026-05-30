package com.avicare.common.security.principal;

import java.util.List;

/**
 * Tenant-level role inside a single farm.
 *
 * <p>Five-persona system for V1:
 *
 * <ul>
 *   <li>{@link #OWNER} — farm owner, SaaS payer, full access
 *   <li>{@link #MANAGER} — delegated manager with operational rights across modules
 *   <li>{@link #FARMER} — field operator, daily poultry and health data entry
 *   <li>{@link #VETERINARIAN} — external vet, scoped to health and poultry read
 *   <li>{@link #BUYER} — customer / wholesaler, scoped to commercial reads
 * </ul>
 *
 * <p>{@link #defaultPermissions()} returns the baseline {@code resource:verb} permissions granted
 * when the role is assigned. The permissions are then stored on each {@code Membership} row and can
 * be overridden individually (via the JSONB column on {@code user_farm.permissions}) without
 * changing the role itself.
 *
 * <p>The defaults are deliberately conservative for V1 and will be enriched in Sprint B+ as each
 * business module formalises its resource taxonomy.
 */
public enum FarmRole {
  OWNER,
  MANAGER,
  FARMER,
  VETERINARIAN,
  BUYER;

  /**
   * Baseline {@code resource:verb} permissions for this role. Returns an immutable list (every call
   * yields the same canonical list — safe to share).
   *
   * <p>Convention:
   *
   * <ul>
   *   <li>{@code "*"} — full access (OWNER only)
   *   <li>{@code "resource:*"} — every verb on the resource
   *   <li>{@code "resource:verb"} — specific verb
   * </ul>
   *
   * <p>The BUYER scoping ("sees only their own orders") is enforced at the service layer, not at
   * the RBAC level — RBAC just grants the read.
   */
  public List<String> defaultPermissions() {
    return switch (this) {
      case OWNER -> List.of("*");
      case MANAGER ->
          List.of(
              "poultry:*",
              "health:*",
              "commercial:*",
              "inventory:*",
              "finance:read",
              "settings:read");
      case FARMER -> List.of("poultry:read", "poultry:write", "health:read", "health:write");
      case VETERINARIAN -> List.of("health:read", "health:write", "poultry:read");
      case BUYER -> List.of("commercial:read", "finance:read");
    };
  }
}
