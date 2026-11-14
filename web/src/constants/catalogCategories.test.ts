import { describe, expect, it } from "vitest";
import { getCategoryConfig, CATALOG_CATEGORIES } from "./catalogCategories";

describe("catalogCategories", () => {
  // Le gestionnaire générique écrivait dans `breeds` sans jamais demander le profil de
  // production : il créait des souches sans cible ni courbe, pendant que l'écran « Souches »
  // faisait le vrai travail juste à côté. Un seul des deux peut dire la vérité.
  it("aucune catégorie du gestionnaire générique n'écrit dans breeds", () => {
    expect(CATALOG_CATEGORIES.map((c) => c.backendCategory)).not.toContain("breeds");
  });
  it("le slug lots n'existe plus", () => {
    expect(getCategoryConfig("lots")).toBeUndefined();
  });
  it("maps comptabilite to expense_categories", () => {
    expect(getCategoryConfig("comptabilite")?.backendCategory).toBe("expense_categories");
  });
  it("maps stock to inventory_items with a number field for the indicative price", () => {
    const cfg = getCategoryConfig("stock");
    expect(cfg?.backendCategory).toBe("inventory_items");
    expect(cfg?.fields.some((f) => f.name === "subcategory" && f.type === "select")).toBe(true);
    expect(
      cfg?.fields.some((f) => f.name === "typical_unit_price_xof" && f.type === "number"),
    ).toBe(true);
  });
  it("returns undefined for an unconfigured slug", () => {
    expect(getCategoryConfig("inexistant")).toBeUndefined();
  });
  it("maps ventes to the sales_channels backend category", () => {
    const cfg = getCategoryConfig("ventes");
    expect(cfg?.backendCategory).toBe("sales_channels");
    expect(cfg?.fields.some((f) => f.name === "label" && f.required)).toBe(true);
  });
  it("every config has a labelField present in its fields", () => {
    for (const c of CATALOG_CATEGORIES) {
      expect(c.fields.some((f) => f.name === c.labelField)).toBe(true);
    }
  });
});
