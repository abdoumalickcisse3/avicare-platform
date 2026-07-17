import { describe, expect, it } from "vitest";
import { getCategoryConfig, CATALOG_CATEGORIES } from "./catalogCategories";

describe("catalogCategories", () => {
  it("maps lots to the breeds backend category", () => {
    const cfg = getCategoryConfig("lots");
    expect(cfg?.backendCategory).toBe("breeds");
    expect(cfg?.fields.some((f) => f.name === "type" && f.type === "select")).toBe(true);
    expect(cfg?.fields.some((f) => f.name === "species" && f.const === "poultry")).toBe(true);
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
    expect(getCategoryConfig("ventes")).toBeUndefined();
  });
  it("every config has a labelField present in its fields", () => {
    for (const c of CATALOG_CATEGORIES) {
      expect(c.fields.some((f) => f.name === c.labelField)).toBe(true);
    }
  });
});
