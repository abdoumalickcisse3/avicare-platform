package com.avicare.common.security.access;

import java.util.List;
import java.util.Map;

/** Catalog of assignable permissions (resources + verbs) with FR labels. */
public final class PermissionCatalog {

  private PermissionCatalog() {}

  public record ResourceDef(String resource, String label, List<String> verbs) {}

  private static final Map<String, String> LABELS =
      Map.of(
          "poultry", "Élevage volaille",
          "health", "Sanitaire",
          "commercial", "Commercial",
          "inventory", "Stock",
          "finance", "Finance",
          "settings", "Réglages");

  /** Resources in a stable display order. */
  public static final List<ResourceDef> RESOURCES =
      List.of("poultry", "health", "commercial", "inventory", "finance", "settings").stream()
          .map(r -> new ResourceDef(r, LABELS.get(r), PermissionConstants.RESOURCE_VERBS.get(r)))
          .toList();

  /** True if {@code permission} is "*", "resource:*" or a known "resource:verb". */
  public static boolean isValid(String permission) {
    if (permission == null || permission.isBlank()) return false;
    if (permission.equals("*")) return true;
    int c = permission.indexOf(':');
    if (c <= 0 || c == permission.length() - 1) return false;
    String resource = permission.substring(0, c);
    String verb = permission.substring(c + 1);
    List<String> verbs = PermissionConstants.RESOURCE_VERBS.get(resource);
    if (verbs == null) return false;
    return verb.equals("*") || verbs.contains(verb);
  }
}
