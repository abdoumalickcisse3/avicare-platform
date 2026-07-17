package com.avicare.parameters.access;

import org.springframework.stereotype.Component;

/**
 * Maps a catalog {@code category} to the feature module that gates it, for the generic {@code
 * /catalog/{category}} endpoints ({@link com.avicare.parameters.controller.FarmCatalogController}).
 *
 * <p>Module-gated categories are reachable through this generic route AND through a module's own
 * feature-gated area (health library, stock catalog). The generic route hits the very same {@code
 * catalog_items} rows, so without this it could be used to read/write them while bypassing the
 * module gate. This bean lets the generic endpoints enforce the SAME requirement: {@code
 * vaccines}/{@code vaccination_programs} → {@code module.health.basic}, {@code treatments} → {@code
 * module.health.advanced}, {@code inventory_items} → {@code module.inventory}.
 *
 * <p>Returns {@code null} for categories that carry no module requirement (breeds,
 * expense_categories, …). Kept dependency-free so it stays in the {@code parameters} context; the
 * actual enforcement reuses the shared {@code @features} bean in SpEL, so there is no cross-context
 * Java import into {@code subscription}.
 */
@Component("catalogGate")
public class CatalogGate {

  /**
   * The module key gating {@code category}, or {@code null} if the category is not module-gated.
   */
  public String moduleFor(String category) {
    if (category == null) {
      return null;
    }
    return switch (category) {
      case "vaccines", "vaccination_programs" -> "module.health.basic";
      case "treatments" -> "module.health.advanced";
      case "inventory_items" -> "module.inventory";
      default -> null;
    };
  }
}
