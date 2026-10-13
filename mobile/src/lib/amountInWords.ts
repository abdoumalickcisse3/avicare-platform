/**
 * Un montant en francs CFA, écrit en toutes lettres.
 *
 * Sur une facture, le montant en lettres fait foi contre le montant en chiffres
 * si les deux divergent : c'est une protection contre la retouche d'un document
 * remis en main propre. Il est donc écrit avec soin, pas approximé.
 *
 * Les règles d'accord suivies sont celles de l'Académie : « vingt » et « cent »
 * prennent un s lorsqu'ils sont multipliés ET qu'ils terminent le nombre —
 * « quatre-vingts », « deux cents », mais « quatre-vingt-cinq », « deux cent un »
 * et « deux cent mille ». « mille » est invariable.
 *
 * Dupliqué à l'identique depuis `web/src/lib/amountInWords.ts`.
 */

// Indexés par des valeurs que les branches ci-dessous bornent déjà. Le mobile
// compile avec `noUncheckedIndexedAccess`, d'où les assertions : elles disent
// « cet index est prouvé en portée », pas « on verra bien ».
const UNITS: string[] = [
  "zéro",
  "un",
  "deux",
  "trois",
  "quatre",
  "cinq",
  "six",
  "sept",
  "huit",
  "neuf",
  "dix",
  "onze",
  "douze",
  "treize",
  "quatorze",
  "quinze",
  "seize",
];

const TENS: Record<number, string> = {
  2: "vingt",
  3: "trente",
  4: "quarante",
  5: "cinquante",
  6: "soixante",
};

/** 0 → 99. `last` dit si le nombre se termine ici (pour l'accord de « vingt »). */
function underHundred(n: number, last: boolean): string {
  if (n < 17) return UNITS[n]!;
  if (n < 20) return `dix-${UNITS[n - 10]!}`;

  const ten = Math.floor(n / 10);
  const unit = n % 10;

  // 70-79 et 90-99 se construisent sur 60 et 80, avec les « onze, douze… ».
  if (ten === 7 || ten === 9) {
    const base = ten === 7 ? "soixante" : "quatre-vingt";
    const rest = underHundred(10 + unit, true);
    // Seul « soixante et onze » garde la conjonction ; « quatre-vingt-onze » non.
    return ten === 7 && unit === 1 ? "soixante et onze" : `${base}-${rest}`;
  }
  if (ten === 8) {
    if (unit === 0) return last ? "quatre-vingts" : "quatre-vingt";
    return `quatre-vingt-${UNITS[unit]!}`;
  }

  const base = TENS[ten]!;
  if (unit === 0) return base;
  // « vingt et un », « trente et un »… mais jamais « quatre-vingt et un ».
  if (unit === 1) return `${base} et un`;
  return `${base}-${UNITS[unit]!}`;
}

/** 0 → 999. */
function underThousand(n: number, last: boolean): string {
  if (n < 100) return underHundred(n, last);

  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const head = hundreds === 1 ? "cent" : `${UNITS[hundreds]!} cent`;

  if (rest === 0) {
    // Pluriel seulement si « cent » est multiplié ET termine le nombre.
    return hundreds === 1 ? "cent" : last ? `${head}s` : head;
  }
  return `${head} ${underHundred(rest, last)}`;
}

/** Le nombre seul, sans unité monétaire. Entier positif. */
export function numberInWords(value: number): string {
  const n = Math.floor(Math.abs(value));
  if (n === 0) return "zéro";

  const parts: string[] = [];
  // `noun` : « million » et « milliard » sont des noms, « mille » un adjectif
  // numéral invariable. D'où « trois cents millions » mais « trois cent mille » —
  // devant un nom, « cent » termine bien le groupe numéral et s'accorde.
  const scales: { size: number; one: string; many: string; noun: boolean }[] = [
    { size: 1_000_000_000, one: "un milliard", many: "milliards", noun: true },
    { size: 1_000_000, one: "un million", many: "millions", noun: true },
    { size: 1_000, one: "mille", many: "mille", noun: false },
  ];

  let rest = n;
  for (const scale of scales) {
    const count = Math.floor(rest / scale.size);
    if (count === 0) continue;
    rest %= scale.size;

    if (count === 1) {
      parts.push(scale.one);
    } else {
      parts.push(`${underThousand(count, scale.noun)} ${scale.many}`);
    }
  }
  if (rest > 0) parts.push(underThousand(rest, true));

  return parts.join(" ");
}

/**
 * Le montant en toutes lettres, prêt à poser sous les totaux d'une facture.
 *
 * Les centimes sont ignorés : le franc CFA n'en a pas, et tous les montants du
 * produit sont des entiers.
 */
export function amountInWordsXof(value: number): string {
  const words = numberInWords(value);
  return `${words.charAt(0).toUpperCase()}${words.slice(1)} francs CFA`;
}
