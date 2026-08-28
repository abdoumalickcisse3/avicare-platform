package com.avicare.common.security.access;

import java.util.List;
import java.util.Map;

/** Catalog of assignable staff permissions (resources + verbs) with FR labels. */
public final class StaffPermissionCatalog {

  private StaffPermissionCatalog() {}

  public record ResourceDef(String resource, String label, List<String> verbs) {}

  private static final Map<String, String> LABELS =
      Map.of(
          "tenants", "Fermes",
          "users", "Utilisateurs",
          "impersonate", "Mode support",
          "catalog", "Catalogue plateforme",
          "broadcast", "Annonces",
          "compliance", "Conformité",
          "staff", "Personnel",
          "partners", "Partenaires");

  /** Resources in a stable display order. */
  public static final List<ResourceDef> RESOURCES =
      List.of(
              "tenants",
              "users",
              "impersonate",
              "catalog",
              "broadcast",
              "compliance",
              "staff",
              "partners")
          .stream()
          .map(
              r ->
                  new ResourceDef(r, LABELS.get(r), StaffPermissionConstants.RESOURCE_VERBS.get(r)))
          .toList();

  /**
   * True if {@code permission} is {@code "*"}, {@code "resource:*"} or a known {@code
   * "resource:verb"} of the STAFF taxonomy. A valid farm permission is rejected here on purpose.
   */
  public static boolean isValid(String permission) {
    if (permission == null || permission.isBlank()) return false;
    if (permission.equals("*")) return true;
    int c = permission.indexOf(':');
    if (c <= 0 || c == permission.length() - 1) return false;
    String resource = permission.substring(0, c);
    String verb = permission.substring(c + 1);
    List<String> verbs = StaffPermissionConstants.RESOURCE_VERBS.get(resource);
    if (verbs == null) return false;
    return verb.equals("*") || verbs.contains(verb);
  }
}
