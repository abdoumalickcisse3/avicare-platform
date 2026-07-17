package com.avicare.parameters.access;

import org.springframework.stereotype.Component;

/**
 * Maps a catalog {@code category} to the feature module that gates it, for the generic {@code
 * /catalog/{category}} endpoints ({@link com.avicare.parameters.controller.FarmCatalogController}).
 *
 * <p>Health categories ({@code vaccines}, {@code treatments}, {@code vaccination_programs}) are
 * owned by the health module's own gated controller ({@code HealthCatalogController}). The generic
 * route reaches the very same {@code catalog_items} rows, so without this it could be used to
 * read/write them while bypassing the {@code module.health.*} gate. This bean lets the generic
 * endpoints enforce the SAME module requirement.
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
      default -> null;
    };
  }
}
