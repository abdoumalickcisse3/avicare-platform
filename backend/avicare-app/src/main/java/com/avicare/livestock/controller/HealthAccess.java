package com.avicare.livestock.controller;

/**
 * Shared {@code @PreAuthorize} SpEL expressions for the health module endpoints (Sprint B3-4). Two
 * feature tiers: {@code module.health.basic} (vaccinations + observations + their library) and
 * {@code module.health.advanced} (treatments + withdrawal + vets + visits). Reads need the {@code
 * health:read} permission; writes need an operational role; sensitive writes need a supervisory
 * role.
 */
final class HealthAccess {

  private HealthAccess() {}

  private static final String BASIC = "@features.isEnabled(#farmId, 'module.health.basic')";
  private static final String ADVANCED = "@features.isEnabled(#farmId, 'module.health.advanced')";

  private static final String OWNER = "T(com.avicare.common.security.principal.FarmRole).OWNER";
  private static final String MANAGER = "T(com.avicare.common.security.principal.FarmRole).MANAGER";

  // --- basic tier -----------------------------------------------------
  static final String READ_BASIC = "@farmAccess.hasPermission(#farmId, 'health:read') and " + BASIC;

  /**
   * Field entry (record vaccination, observation) — gated by the grantable {@code health:write}
   * permission rather than a fixed role list, so per-member sub-access works: a VETERINARIAN holds
   * it by default, a FARMER can have it revoked, and any member can be granted it individually. The
   * default roles (OWNER {@code *}, MANAGER {@code health:*}, FARMER/VET {@code health:write}) all
   * carry it, so existing provisioning is unaffected.
   */
  static final String WRITE_BASIC_FARMER =
      "@farmAccess.hasPermission(#farmId, 'health:write') and " + BASIC;

  /** OWNER / MANAGER — supervisory (delete, program assign/remove). */
  static final String WRITE_BASIC_MANAGER =
      "@farmAccess.hasRole(#farmId, " + OWNER + ", " + MANAGER + ") and " + BASIC;

  // --- advanced tier --------------------------------------------------
  static final String READ_ADVANCED =
      "@farmAccess.hasPermission(#farmId, 'health:read') and " + ADVANCED;

  /** OWNER / MANAGER — treatments, vet directory, vet visits. */
  static final String WRITE_ADVANCED_MANAGER =
      "@farmAccess.hasRole(#farmId, " + OWNER + ", " + MANAGER + ") and " + ADVANCED;

  /** OWNER — deleting a treatment record (traceability-sensitive). */
  static final String ADMIN_ADVANCED_OWNER =
      "@farmAccess.hasRole(#farmId, " + OWNER + ") and " + ADVANCED;
}
