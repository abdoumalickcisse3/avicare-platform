/**
 * Enquête terrain — chiffres RÉELS.
 *
 * Source : `docs/🐔 Enquête sur la gestion d'élevage avicole(Sheet1).csv`
 * (17 réponses, du 5 au 8 février 2026, Sénégal — fichier encodé en latin-1).
 *
 * Règle de cette page : aucun chiffre n'est arrondi, embelli ni inventé. Chaque
 * entrée porte la question dont elle sort et la façon dont elle a été comptée,
 * pour que n'importe qui puisse la recompter dans le CSV. Si un chiffre devient
 * faux (nouvelles réponses), on le recompte — on ne le garde pas « parce qu'il
 * sonnait bien ».
 *
 * Ce qui a remplacé quoi : jusqu'en octobre 2026 cette section affichait trois
 * témoignages INVENTÉS (Moussa D., Awa F., S. Camara) sous une note admettant
 * qu'ils étaient illustratifs. Une preuve fausse annotée reste une preuve
 * fausse ; ces chiffres-là sont vérifiables.
 *
 * Les répondants ne sont PAS nommés : le formulaire demandait l'accord d'être
 * recontacté (16 sur 17 l'ont donné), jamais celui d'être cité publiquement.
 * Pour publier une citation signée, il faut l'accord explicite de la personne.
 */

export interface FaitEnquete {
  /** Numérateur, tel que compté. */
  n: number;
  /** Ce que le chiffre dit, en une ligne. */
  libelle: string;
  /** D'où il sort : question + méthode de comptage. */
  source: string;
}

/** Dénominateur commun : le nombre de répondants. */
export const REPONDANTS = 17;

export const PERIODE_ENQUETE = "du 5 au 8 février 2026";

export const faitsEnquete: FaitEnquete[] = [
  {
    n: 13,
    libelle: "citent l'aliment parmi leurs trois plus grands défis",
    source:
      "Q. « Quels sont vos 3 plus grands défis ? » — réponses mentionnant aliment ou provende. " +
      "Premier thème cité, devant la commercialisation (9 sur 17).",
  },
  {
    n: 12,
    libelle: "ont déjà perdu de l'argent faute de suivi",
    source:
      "Q. « Avez-vous déjà perdu de l'argent à cause d'un manque de suivi ? » — " +
      "6 « oui, souvent » + 6 « oui, parfois ».",
  },
  {
    n: 11,
    libelle: "tiennent leurs chiffres sur un cahier — ou de tête",
    source:
      "Q. « Comment gérez-vous vos données ? » — 8 « papier / cahier » + 3 « rien du tout / de tête ».",
  },
  {
    n: 7,
    libelle: "n'ont pas de connexion internet fiable à la ferme",
    source:
      "Q. « Avez-vous accès à internet régulièrement ? » — 3 « non, très rarement » + " +
      "2 « oui, mais instable » + 2 « parfois seulement ».",
  },
];
