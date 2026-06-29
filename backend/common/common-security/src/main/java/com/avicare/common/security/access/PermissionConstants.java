package com.avicare.common.security.access;

/**
 * Canonical {@code resource:verb} permission strings used across {@code @PreAuthorize} expressions
 * and {@link com.avicare.common.security.principal.FarmRole#defaultPermissions()}.
 *
 * <p>Referencing these constants instead of inline literals keeps the permission taxonomy in one
 * place and lets the compiler catch typos. The taxonomy is deliberately small for V1 and will grow
 * in Sprint B+ as each business module formalises its resources.
 */
public final class PermissionConstants {

  private PermissionConstants() {}

  // Poultry
  public static final String POULTRY_READ = "poultry:read";
  public static final String POULTRY_WRITE = "poultry:write";
  public static final String POULTRY_DELETE = "poultry:delete";

  // Health
  public static final String HEALTH_READ = "health:read";
  public static final String HEALTH_WRITE = "health:write";

  // Commercial
  public static final String COMMERCIAL_READ = "commercial:read";
  public static final String COMMERCIAL_WRITE = "commercial:write";

  // Inventory
  public static final String INVENTORY_READ = "inventory:read";
  public static final String INVENTORY_WRITE = "inventory:write";

  // Finance
  public static final String FINANCE_READ = "finance:read";
  public static final String FINANCE_WRITE = "finance:write";

  // Settings
  public static final String SETTINGS_READ = "settings:read";
  public static final String SETTINGS_WRITE = "settings:write";

  /** Wildcard granting every permission (typically OWNER only). */
  public static final String ALL = "*";

  /** All known resources and their verbs (single source for the catalog/validator). */
  public static final java.util.Map<String, java.util.List<String>> RESOURCE_VERBS =
      java.util.Map.of(
          "poultry", java.util.List.of("read", "write", "delete"),
          "health", java.util.List.of("read", "write"),
          "commercial", java.util.List.of("read", "write"),
          "inventory", java.util.List.of("read", "write"),
          "finance", java.util.List.of("read", "write"),
          "settings", java.util.List.of("read", "write"));
}
