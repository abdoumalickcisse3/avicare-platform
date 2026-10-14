import { describe, expect, it } from "vitest";
import { stockShortage, missingQuantity } from "./stockShortage";

/** La réponse réelle du backend quand une sortie dépasse le stock (ADR-018). */
const REFUSAL = {
  status: 422,
  data: {
    type: "https://avicare.com/errors/stock-insufficient",
    title: "Stock Insufficient",
    status: 422,
    detail: "Stock insuffisant : il reste 0 SAC de CHARBON, vous en sortez 1.",
    code: "STOCK_INSUFFICIENT",
    properties: {
      stockItemId: 6,
      articleKey: "charbon",
      articleLabel: "CHARBON",
      unit: "SAC",
      available: 0,
      requested: 1,
    },
  },
};

describe("stockShortage", () => {
  it("lit l'article et les deux quantités du refus", () => {
    expect(stockShortage(REFUSAL)).toEqual({
      stockItemId: 6,
      articleLabel: "CHARBON",
      unit: "SAC",
      available: 0,
      requested: 1,
    });
  });

  it("ignore une erreur qui n'est pas un manque de stock", () => {
    expect(stockShortage({ status: 422, data: { code: "STOCK_ADJUSTMENT_NOOP" } })).toBeNull();
    expect(stockShortage({ status: 500 })).toBeNull();
    expect(stockShortage(undefined)).toBeNull();
  });

  /**
   * Un refus sans propriétés ne doit pas ouvrir une fenêtre vide : mieux vaut laisser le message
   * passer en message. Le cas se produirait avec un backend plus ancien que cet écran.
   */
  it("ignore un refus qui ne porte pas de quoi le réparer", () => {
    expect(stockShortage({ status: 422, data: { code: "STOCK_INSUFFICIENT" } })).toBeNull();
  });

  it("chiffre ce qu'il manque, y compris sur une ligne déjà négative", () => {
    expect(missingQuantity({ available: 0, requested: 1 })).toBe(1);
    expect(missingQuantity({ available: 2, requested: 5 })).toBe(3);
    expect(missingQuantity({ available: -1, requested: 2 })).toBe(3);
  });
});
