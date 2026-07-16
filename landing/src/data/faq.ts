// FAQ de l'accueil — copy verbatim du prototype (§ faq). `answer` peut
// porter du markup inline simple (ex. <b>) et est rendu via set:html
// par Faq.astro ; le JSON-LD FAQPage de l'accueil doit donc en retirer
// les balises avant de le sérialiser (voir index.astro).
export interface FaqItem {
  question: string;
  answer: string;
  open?: boolean;
}

export const faq: FaqItem[] = [
  {
    question: "C'est vraiment gratuit ?",
    answer:
      "Oui. Pendant la phase pilote, toutes les fonctionnalités sont gratuites, sans carte bancaire. Les tarifs affichés sont indicatifs et n'entreront en vigueur que plus tard — vous serez prévenu bien avant.",
    open: true,
  },
  {
    question: "Est-ce que ça marche sur téléphone ?",
    answer:
      "AviCare est pensé mobile-first : la saisie quotidienne se fait depuis votre téléphone, en quelques secondes, et reste légère sur un petit forfait data.",
  },
  {
    question: "Ça gère les pondeuses aussi ?",
    answer:
      "Oui. Poulets de chair <b>et</b> pondeuses : collecte d'œufs, stock de plateaux, suivi journalier aliment/eau et attrition du lot.",
  },
  {
    question: "Comment AviCare calcule ma marge ?",
    answer:
      "En reliant vos ventes (factures encaissées), vos dépenses (achats, aliment sorti du stock, salaires, vétérinaire) et vos bandes. Résultat : marge de la ferme et revenu par lot, en temps réel.",
  },
  {
    question: "Mes données m'appartiennent-elles ?",
    answer:
      "Oui. Vos données sont les vôtres : chaque ferme est isolée, et vous restez propriétaire de tout ce que vous saisissez.",
  },
  {
    question: "Je suis une coopérative — comment équiper mes éleveurs ?",
    answer:
      "Nous proposons un accompagnement et un tarif réseau pour équiper vos éleveurs. Écrivez-nous : on met votre réseau en route ensemble.",
  },
];
