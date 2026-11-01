import { describe, expect, it } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Cobb 500")).toBe("cobb-500");
  });
  it("strips accents", () => {
    expect(slugify("Aliment Démarrage")).toBe("aliment-demarrage");
  });
  it("collapses non-alphanumerics and trims hyphens", () => {
    expect(slugify("  Poulet / Chair!! ")).toBe("poulet-chair");
  });
  it("returns empty string for empty input", () => {
    expect(slugify("")).toBe("");
  });
  /**
   * The same label typed on the phone must produce the same key (ADR-020) — mobile's slugify used
   * an underscore, so one medication became two catalog entries and two stock balances.
   */
  it("agrees with the mobile slug on a multi-word medication", () => {
    expect(slugify("AMINE TOTALE")).toBe("amine-totale");
  });
  it("caps the length the catalog column accepts", () => {
    expect(slugify("a".repeat(200))).toHaveLength(100);
  });
});
