import { amountInWordsXof, numberInWords } from "../amountInWords";

describe("numberInWords", () => {
  it("écrit les petits nombres", () => {
    expect(numberInWords(0)).toBe("zéro");
    expect(numberInWords(1)).toBe("un");
    expect(numberInWords(16)).toBe("seize");
    expect(numberInWords(17)).toBe("dix-sept");
    expect(numberInWords(19)).toBe("dix-neuf");
  });

  it("met la conjonction sur les et-un, sauf sur quatre-vingts", () => {
    expect(numberInWords(21)).toBe("vingt et un");
    expect(numberInWords(31)).toBe("trente et un");
    expect(numberInWords(71)).toBe("soixante et onze");
    // La seule exception de la série : jamais « quatre-vingt et un ».
    expect(numberInWords(81)).toBe("quatre-vingt-un");
    expect(numberInWords(91)).toBe("quatre-vingt-onze");
  });

  it("construit les septante et nonante à la française", () => {
    expect(numberInWords(70)).toBe("soixante-dix");
    expect(numberInWords(77)).toBe("soixante-dix-sept");
    expect(numberInWords(80)).toBe("quatre-vingts");
    expect(numberInWords(85)).toBe("quatre-vingt-cinq");
    expect(numberInWords(90)).toBe("quatre-vingt-dix");
    expect(numberInWords(99)).toBe("quatre-vingt-dix-neuf");
  });

  it("accorde « cent » seulement quand il est multiplié ET final", () => {
    expect(numberInWords(100)).toBe("cent");
    expect(numberInWords(101)).toBe("cent un");
    expect(numberInWords(200)).toBe("deux cents");
    expect(numberInWords(201)).toBe("deux cent un");
    expect(numberInWords(280)).toBe("deux cent quatre-vingts");
    // Suivi de « mille », « cent » ne termine plus le nombre : pas de s.
    expect(numberInWords(200_000)).toBe("deux cent mille");
    expect(numberInWords(380_000)).toBe("trois cent quatre-vingt mille");
  });

  it("laisse « mille » invariable", () => {
    expect(numberInWords(1_000)).toBe("mille");
    expect(numberInWords(1_001)).toBe("mille un");
    expect(numberInWords(2_000)).toBe("deux mille");
    expect(numberInWords(21_000)).toBe("vingt et un mille");
  });

  it("écrit les montants d'une vraie facture", () => {
    expect(numberInWords(650_000)).toBe("six cent cinquante mille");
    expect(numberInWords(1_450_000)).toBe("un million quatre cent cinquante mille");
    expect(numberInWords(42_500)).toBe("quarante-deux mille cinq cents");
    expect(numberInWords(1_120_000)).toBe("un million cent vingt mille");
  });

  it("monte jusqu'au milliard", () => {
    expect(numberInWords(1_000_000_000)).toBe("un milliard");
    expect(numberInWords(2_300_000_000)).toBe("deux milliards trois cents millions");
  });
});

describe("amountInWordsXof", () => {
  it("met la majuscule et l'unité monétaire", () => {
    expect(amountInWordsXof(650_000)).toBe("Six cent cinquante mille francs CFA");
    expect(amountInWordsXof(0)).toBe("Zéro francs CFA");
  });

  it("ignore les centimes : le franc CFA n'en a pas", () => {
    expect(amountInWordsXof(1_500.7)).toBe("Mille cinq cents francs CFA");
  });
});
