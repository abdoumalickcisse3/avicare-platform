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
});
