package com.avicare.livestock.controller;

/**
 * Shared {@code @PreAuthorize} SpEL expressions for the poultry layer (egg-production) endpoints
 * (Sprint B2-3). Every route is farm-scoped and gated behind the {@code module.poultry.layer}
 * feature; reads need farm access, writes need an operational role and sensitive writes
 * (delete/overwrite/close) need a supervisory role.
 *
 * <p>The constants are compile-time string constants so they can be used as {@code @PreAuthorize}
 * values.
 */
final class LayerAccess {

  private LayerAccess() {}

  static final String FEATURE = "@features.isEnabled(#farmId, 'module.poultry.layer')";

  static final String READ = "@farmAccess.hasAccess(#farmId) and " + FEATURE;

  /** OWNER / MANAGER / FARMER — daily field operations (record, adjust). */
  static final String WRITE_FARMER =
      "@farmAccess.hasRole(#farmId, "
          + "T(com.avicare.common.security.principal.FarmRole).OWNER, "
          + "T(com.avicare.common.security.principal.FarmRole).MANAGER, "
          + "T(com.avicare.common.security.principal.FarmRole).FARMER) and "
          + FEATURE;

  /** OWNER / MANAGER — supervisory operations (delete, arbitrary set, day close). */
  static final String WRITE_MANAGER =
      "@farmAccess.hasRole(#farmId, "
          + "T(com.avicare.common.security.principal.FarmRole).OWNER, "
          + "T(com.avicare.common.security.principal.FarmRole).MANAGER) and "
          + FEATURE;
}
