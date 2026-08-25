import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("joins with a semicolon so Excel FR splits the columns", () => {
    expect(toCsv(["a", "b"], [[1, 2]])).toBe("a;b\r\n1;2");
  });

  it("quotes a cell containing the separator", () => {
    // A farm named "Ferme A; annexe" must not become two columns.
    expect(toCsv(["nom"], [["Ferme A; annexe"]])).toBe('nom\r\n"Ferme A; annexe"');
  });

  it("doubles embedded quotes", () => {
    expect(toCsv(["nom"], [['Ferme "A"']])).toBe('nom\r\n"Ferme ""A"""');
  });

  it("quotes a cell containing a newline", () => {
    expect(toCsv(["nom"], [["Ferme\nA"]])).toBe('nom\r\n"Ferme\nA"');
  });

  it("renders null and undefined as an empty cell", () => {
    // An unknown tonnage must stay empty, never read as a zero.
    expect(toCsv(["kg"], [[null], [undefined]])).toBe("kg\r\n\r\n");
  });
});
