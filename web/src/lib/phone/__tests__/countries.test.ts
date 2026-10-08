import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COUNTRIES, DEFAULT_COUNTRY, splitE164, toE164 } from "../countries";

/**
 * The country list lives twice, once per platform, because `shared/` is wired into neither Metro
 * nor Next and wiring it is an architecture decision nobody has taken. Duplication is only
 * acceptable while drift is impossible to miss — so this test fails the build the day the two
 * files stop agreeing.
 */
describe("la liste ne doit pas diverger du mobile", () => {
  it("web et mobile portent exactement les mêmes pays", () => {
    const root = join(__dirname, "..", "..", "..", "..", "..");
    const body = (p: string) =>
      readFileSync(join(root, p), "utf8")
        .split("export const COUNTRIES")[1]
        ?.split("] as const;")[0];

    const web = body("web/src/lib/phone/countries.ts");
    const mobile = body("mobile/src/phone/countries.ts");

    expect(web).toBeTruthy();
    expect(web).toEqual(mobile);
  });
});

describe("splitE164", () => {
  it("reconnaît le pays d'un numéro stocké", () => {
    expect(splitE164("+221771842787")).toEqual({
      country: expect.objectContaining({ iso: "SN" }),
      local: "771842787",
    });
    expect(splitE164("+2290156343408")).toEqual({
      country: expect.objectContaining({ iso: "BJ" }),
      local: "0156343408",
    });
  });

  it("préfère l'indicatif le plus long — 221 n'est pas 22", () => {
    expect(splitE164("+221771842787").country.iso).toBe("SN");
    expect(splitE164("+22222000000").country.iso).toBe("MR");
  });

  it("rend un indicatif inconnu modifiable, sans le réécrire", () => {
    expect(splitE164("+99912345678").local).toBe("99912345678");
  });

  it("part du Sénégal quand il n'y a rien", () => {
    expect(splitE164(null)).toEqual({ country: DEFAULT_COUNTRY, local: "" });
  });
});

describe("toE164", () => {
  it("assemble la forme stockée", () => {
    expect(toE164(COUNTRIES[0]!, "77 184 27 87")).toBe("+221771842787");
  });

  /** Le piège : le zéro initial dépend du pays. Le Bénin le garde, la France le retire. */
  it("garde le zéro béninois et retire le zéro français", () => {
    const benin = COUNTRIES.find((c) => c.iso === "BJ")!;
    const france = COUNTRIES.find((c) => c.iso === "FR")!;
    expect(toE164(benin, "01 56 34 34 08")).toBe("+2290156343408");
    expect(toE164(france, "06 81 01 37 59")).toBe("+33681013759");
  });

  it("rend une chaîne vide quand il n'y a pas de numéro — pas un indicatif orphelin", () => {
    expect(toE164(COUNTRIES[0]!, "")).toBe("");
  });
});
