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

  it("defuses a cell a spreadsheet would execute", () => {
    // The field survey is the one write path open to the public internet, and a staff member is
    // the one who opens the file: a respondent's "feed supplier" must never become a formula.
    expect(toCsv(["provendier"], [["=HYPERLINK(\"http://evil\",\"cliquez\")"]])).toBe(
      'provendier\r\n"\'=HYPERLINK(""http://evil"",""cliquez"")"',
    );
    expect(toCsv(["x"], [["+1+1"]])).toBe("x\r\n'+1+1");
    expect(toCsv(["x"], [["@SUM(A1:A9)"]])).toBe("x\r\n'@SUM(A1:A9)");
    expect(toCsv(["x"], [["\tcmd"]])).toBe("x\r\n'\tcmd");
  });

  it("leaves a negative figure alone, by type and by shape", () => {
    // Prefixing -1500 would turn every negative amount in the finance exports into text.
    expect(toCsv(["solde"], [[-1500]])).toBe("solde\r\n-1500");
    expect(toCsv(["solde"], [["-1500"]])).toBe("solde\r\n-1500");
    expect(toCsv(["solde"], [["-1500,50"]])).toBe("solde\r\n-1500,50");
    // But a minus followed by anything else is a formula trigger, not a number.
    expect(toCsv(["x"], [["-2+3*cmd"]])).toBe("x\r\n'-2+3*cmd");
  });

  it("renders null and undefined as an empty cell", () => {
    // An unknown tonnage must stay empty, never read as a zero.
    expect(toCsv(["kg"], [[null], [undefined]])).toBe("kg\r\n\r\n");
  });
});
