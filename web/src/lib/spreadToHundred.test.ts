import { describe, expect, it } from "vitest";
import { spreadToHundred } from "@/lib/inventory";

/**
 * Même arithmétique que le `normaliseTo100` mobile : deux définitions qui divergent donneraient
 * deux formules différentes pour le même geste.
 */
describe("spreadToHundred", () => {
  it("complète une formule arrêtée à 96 %", () => {
    const out = spreadToHundred([60, 36]);
    expect(out.reduce((s, p) => s + p, 0)).toBe(100);
  });

  it("réduit proportionnellement un total au-dessus de 100", () => {
    const out = spreadToHundred([70, 50]);
    expect(out.reduce((s, p) => s + p, 0)).toBe(100);
    expect(out[0]).toBeGreaterThan(out[1]!);
  });

  it("ne touche à rien quand le total est déjà juste", () => {
    expect(spreadToHundred([60, 40])).toEqual([60, 40]);
  });

  it("ne tente rien quand tout est à zéro", () => {
    expect(spreadToHundred([0, 0])).toEqual([0, 0]);
  });

  it("donne le centime d'arrondi à la plus grosse ligne", () => {
    // Trois tiers : 33,33 × 3 = 99,99. Le centime manquant doit atterrir quelque part.
    const out = spreadToHundred([1, 1, 1]);
    expect(out.reduce((s, p) => s + p, 0)).toBe(100);
  });
});
