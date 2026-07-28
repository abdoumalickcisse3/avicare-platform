package com.avicare.livestock.controller;

/**
 * Shared {@code @PreAuthorize} SpEL expressions for the inventory module endpoints (Sprint B4-6).
 * Single feature tier: every route is farm-scoped and gated behind {@code module.inventory}; reads
 * need farm access, field writes (manual stock movements) need an operational role, and supervisory
 * writes (suppliers, purchase orders, formulas, thresholds, soft-deletes) need a managerial role.
 *
 * <p>Mirrors {@link HealthAccess} / {@link LayerAccess}: package-private compile-time string
 * constants so they can be used as {@code @PreAuthorize} values, built on the real {@code
 * FarmAccessChecker} API ({@code hasAccess} / {@code hasRole(FarmRole...)} — there is no {@code
 * hasRoleAtLeast}).
 */
final class InventoryAccess {

  private InventoryAccess() {}

  private static final String OWNER = "T(com.avicare.common.security.principal.FarmRole).OWNER";
  private static final String MANAGER = "T(com.avicare.common.security.principal.FarmRole).MANAGER";
  private static final String FARMER = "T(com.avicare.common.security.principal.FarmRole).FARMER";

  static final String FEATURE = "@features.isEnabled(#farmId, 'module.inventory')";

  /**
   * Members holding {@code inventory:read} — browse catalog, stock, movements, suppliers, orders,
   * formulas, alerts.
   */
  static final String READ = "@farmAccess.hasPermission(#farmId, 'inventory:read') and " + FEATURE;

  /**
   * Read gate for the catalogs a data-entry flow needs to draw stock (articles, stock items, feed
   * formulas): {@code inventory:read} OR the narrow entry-scoped {@code inventory:consume}. A field
   * role (FARMER/VETERINARIAN) holds only {@code inventory:consume} — enough to populate the
   * feed/medicine pickers, never enough to browse the full Stocks area (still {@link #READ}).
   */
  static final String READ_OR_CONSUME =
      "(@farmAccess.hasPermission(#farmId, 'inventory:read') or "
          + "@farmAccess.hasPermission(#farmId, 'inventory:consume')) and "
          + FEATURE;

  /** OWNER / MANAGER / FARMER — field entry (manual stock movement). */
  static final String WRITE_FARMER =
      "@farmAccess.hasRole(#farmId, " + OWNER + ", " + MANAGER + ", " + FARMER + ") and " + FEATURE;

  /** OWNER / MANAGER — supervisory writes (suppliers, POs, formulas, thresholds, soft-delete). */
  static final String WRITE_MANAGER =
      "@farmAccess.hasRole(#farmId, " + OWNER + ", " + MANAGER + ") and " + FEATURE;

  /** OWNER only — reserved for the most sensitive operations (none required in V1). */
  static final String WRITE_OWNER = "@farmAccess.hasRole(#farmId, " + OWNER + ") and " + FEATURE;
}
