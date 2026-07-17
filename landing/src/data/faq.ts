// FAQ de l'accueil — copy verbatim du prototype (§ faq). `answer` peut
// porter du markup inline simple (ex. <b>) et est rendu via set:html
// par Faq.astro ; le JSON-LD FAQPage de l'accueil doit donc en retirer
// les balises avant de le sérialiser (voir index.astro).
export interface FaqItem {
  question: string;
  answer: string;
  open?: boolean;
}

// `faqFull` — les 9 questions du doc de design (§12), avec réponses
// complètes, source unique pour /faq (accordéon complet + JSON-LD
// FAQPage). Copy rédigée pour cette Task 5 (pas de texte verbatim dans
// le spec pour les réponses, seulement la liste des questions) :
// "claim-clean" au sens du brief — jamais de calcul au kilo, jamais de
// marge par lot (seul le revenu existe par lot), jamais de paiement/
// changement de plan en ligne, l'Analytique reste cumulée depuis le
// début (pas un P&L mensuel), et le produit ne couvre que la volaille.
// Distincte de `faq` (sous-ensemble accueil ci-dessus) et de la FAQ
// propre à /tarifs (tarifs.astro, questions tarifaires spécifiques) :
// les trois vivent volontairement séparées plutôt que dérivées d'un
// même tableau, chacune ayant une portée et un angle différents.
export const faqFull: FaqItem[] = [
  {
    question: "C'est vraiment gratuit ?",
    answer:
      "Oui. Pendant la phase pilote, toutes les fonctionnalités d'AviCare sont gratuites, sans carte bancaire ni engagement. Les tarifs affichés sur la page Tarifs sont indicatifs&nbsp;: ils n'entreront en vigueur qu'après le pilote, et vous serez prévenu bien à l'avance.",
    open: true,
  },
  {
    question: "Ai-je besoin d'Internet en permanence ?",
    answer:
      "AviCare est une application en ligne&nbsp;: une connexion est nécessaire pour saisir et synchroniser vos données. Elle est conçue pour rester légère sur un petit forfait data (2G/3G), ce qui compte quand la couverture réseau est limitée.",
  },
  {
    question: "Ça marche pour les pondeuses ?",
    answer:
      "Oui. AviCare couvre le poulet de chair <b>et</b> la pondeuse&nbsp;: suivi journalier aliment/eau, attrition du lot, collecte des œufs et stock de plateaux pour les pondeuses. Le logiciel reste, à ce stade, dédié à la volaille.",
  },
  {
    question: "Mes données sont-elles à moi ?",
    answer:
      "Oui. Chaque ferme est isolée dans AviCare&nbsp;: vos données vous appartiennent, nous ne les revendons pas et ne les partageons pas avec d'autres fermes ou éleveurs.",
  },
  {
    question: "Faut-il un ordinateur ou ça marche sur téléphone ?",
    answer:
      "AviCare est pensé mobile-first&nbsp;: toute la saisie quotidienne (aliment, mortalité, ventes...) se fait depuis un téléphone, en quelques secondes. Un ordinateur n'est pas nécessaire, même si l'interface reste accessible depuis un navigateur classique.",
  },
  {
    question: "Comment calcule-t-il ma marge ?",
    answer:
      "En reliant vos ventes (factures et paiements enregistrés), vos dépenses (achats, aliment sorti du stock, salaires, vétérinaire) et vos lots. Vous obtenez le revenu de chaque lot et la marge de votre ferme dans son ensemble&nbsp;: un compte de résultat cumulé depuis le début de votre activité sur AviCare, pas un calcul de coût au kilo ni une marge calculée lot par lot.",
  },
  {
    question: "Que se passe-t-il après le pilote ?",
    answer:
      "Vous serez prévenu bien à l'avance, avec les tarifs définitifs à ce moment-là. Il n'y a aujourd'hui aucun prélèvement automatique ni carte bancaire enregistrée&nbsp;: passer à un plan payant restera une démarche que vous validez avec nous, pas un paiement en ligne automatique.",
  },
  {
    question: "Puis-je gérer plusieurs fermes ?",
    answer:
      "Oui. Vous pouvez ajouter plusieurs fermes à votre compte et basculer de l'une à l'autre&nbsp;: chacune garde ses propres lots, son stock et ses chiffres, séparément.",
  },
  {
    question: "Comment démarrer ?",
    answer:
      "Créez votre compte en quelques minutes depuis «&nbsp;Commencer gratuitement&nbsp;», ajoutez votre première ferme et votre premier lot, puis lancez la saisie quotidienne. Besoin d'aide pour démarrer&nbsp;? Écrivez-nous depuis la page Contact.",
  },
];

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
