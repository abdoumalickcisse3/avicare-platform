package com.avicare.livestock.controller;

/**
 * Shared {@code @PreAuthorize} SpEL expressions for the commercial module endpoints (Sprint B5-5).
 * Every route is farm-scoped and gated behind {@code module.commercial.basic}. Reads need farm
 * access; field operations on the order/delivery pipeline need an operational role
 * (OWNER/MANAGER/FARMER); supervisory writes (clients, sales, invoices, payments and ALL
 * cancellations) need a managerial role (OWNER/MANAGER).
 *
 * <p>Mirrors {@link InventoryAccess}: package-private compile-time string constants built on the
 * real {@code FarmAccessChecker} API ({@code hasAccess} / {@code hasRole(FarmRole...)}).
 */
final class CommercialAccess {

  private CommercialAccess() {}

  private static final String OWNER = "T(com.avicare.common.security.principal.FarmRole).OWNER";
  private static final String MANAGER = "T(com.avicare.common.security.principal.FarmRole).MANAGER";
  private static final String FARMER = "T(com.avicare.common.security.principal.FarmRole).FARMER";

  static final String FEATURE = "@features.isEnabled(#farmId, 'module.commercial.basic')";

  /** Any farm member — browse clients, orders, sales, deliveries, invoices, payments. */
  static final String READ = "@farmAccess.hasAccess(#farmId) and " + FEATURE;

  /** OWNER / MANAGER / FARMER — field pipeline ops (create/confirm/prepare an order, deliver). */
  static final String WRITE_FARMER =
      "@farmAccess.hasRole(#farmId, " + OWNER + ", " + MANAGER + ", " + FARMER + ") and " + FEATURE;

  /** OWNER / MANAGER — supervisory writes (clients, sales, invoices, payments, cancellations). */
  static final String WRITE_MANAGER =
      "@farmAccess.hasRole(#farmId, " + OWNER + ", " + MANAGER + ") and " + FEATURE;
}
