package com.avicare.finance.controller;

/**
 * Shared {@code @PreAuthorize} SpEL expressions for the finance module endpoints (Sprint B6 P1,
 * task B5). Single feature tier: every route is farm-scoped and gated behind {@code
 * module.finance}; reads need {@code finance:read}, writes on the manual expense ledger need a
 * managerial role (auto-recorded expenses are read-only via this controller — see {@code
 * ExpenseService#loadEditable}).
 *
 * <p>Mirrors {@code livestock.controller.InventoryAccess}: package-private compile-time string
 * constants so they can be used as {@code @PreAuthorize} values, built on the real {@code
 * FarmAccessChecker} API ({@code hasPermission} / {@code hasRole(FarmRole...)}).
 */
final class FinanceAccess {

  private FinanceAccess() {}

  private static final String OWNER = "T(com.avicare.common.security.principal.FarmRole).OWNER";
  private static final String MANAGER = "T(com.avicare.common.security.principal.FarmRole).MANAGER";

  static final String FEATURE = "@features.isEnabled(#farmId, 'module.finance')";

  /** Members holding {@code finance:read} — browse expenses, summary, unit analytics. */
  static final String READ = "@farmAccess.hasPermission(#farmId, 'finance:read') and " + FEATURE;

  /** OWNER / MANAGER — manual expense CRUD. */
  static final String WRITE_MANAGER =
      "@farmAccess.hasRole(#farmId, " + OWNER + ", " + MANAGER + ") and " + FEATURE;
}
