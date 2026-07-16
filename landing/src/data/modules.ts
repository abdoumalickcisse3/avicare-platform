// Source unique des 5 modules produit (chair & ponte, sanitaire, stocks,
// ventes, finance) : alimente à la fois la grille de la page hub
// `/fonctionnalites` (nom, tag, teaser) et les 5 sous-pages générées par
// `getStaticPaths()` (H1, lead, capacités, "Ce que ça vous évite", SEO).
//
// `name`/`tag`/`teaser` sont copiés verbatim des cartes `.mod` du prototype
// (docs/superpowers/specs/assets/landing-prototype.html, lignes 678-696).
// `h1` et les intitulés de `seo.title` sont copiés verbatim du spec
// (docs/superpowers/specs/2026-07-14-landing-astro-design.md § 3-7).
// `lead`, le détail de chaque `capabilities[].body`, `avoids` et
// `seo.description` sont une rédaction originale (non fournie verbatim par
// le spec) qui reprend les intitulés de capacité listés dans le spec.

export interface Module {
  slug: string;
  name: string;
  tag: string;
  teaser: string;
  h1: string;
  lead: string;
  capabilities: { title: string; body: string }[];
  avoids: string[];
  seo: { title: string; description: string };
}

export const MODULES: Module[] = [
  {
    slug: "elevage",
    name: "Élevage",
    tag: "Chair & ponte",
    teaser:
      "Bandes suivies au jour le jour : effectif, mortalité, aliment, eau, pesées et courbe de croissance. L'effectif se réconcilie tout seul.",
    h1: "Chaque bande sous contrôle, du jour 1 à la vente.",
    lead: "Chaque geste de la journée — comptage, aliment, pesée — devient une donnée qui construit la courbe de croissance et l'effectif exact de la bande.",
    capabilities: [
      {
        title: "Saisie journalière",
        body: "Mortalité, aliment et eau se notent en quelques secondes, directement au poulailler — plus de cahier à remplir le soir.",
      },
      {
        title: "Pesées & courbe de croissance",
        body: "Chaque pesée alimente automatiquement la courbe de croissance de la bande, pour comparer d'une bande à l'autre et repérer un retard à temps.",
      },
      {
        title: "Chair et pondeuses, effectif réconcilié",
        body: "Lots de chair comme bandes de pondeuses suivis avec les mêmes gestes. L'effectif se réconcilie tout seul à chaque mouvement — plus de comptage à la main en fin de bande.",
      },
    ],
    avoids: [
      "Un effectif approximatif qu'on découvre faux à la vente.",
      "Une mortalité qu'on ne remarque qu'après coup.",
      "Une croissance jugée à l'œil, sans courbe pour comparer.",
    ],
    seo: {
      title: "Logiciel de suivi de bande — poulets de chair & pondeuses | AviCare",
      description:
        "Suivi de bande jour par jour pour poulets de chair et pondeuses : mortalité, aliment, eau, pesées et courbe de croissance, effectif toujours juste.",
    },
  },
  {
    slug: "sanitaire",
    name: "Sanitaire",
    tag: "Vaccins & traitements",
    teaser:
      "Bibliothèque de vaccins et traitements (dont les vôtres), calendrier vaccinal par souche, délais d'attente viande & œufs, visites vétérinaires.",
    h1: "Un élevage sain, un calendrier vaccinal tenu.",
    lead: "La bonne dose, au bon jour, pour la bonne bande — avec les délais d'attente respectés avant chaque vente.",
    capabilities: [
      {
        title: "Bibliothèque vaccins & traitements",
        body: "Les vaccins et traitements courants sont déjà là, et vous pouvez ajouter les vôtres — ceux que vous utilisez vraiment sur votre ferme.",
      },
      {
        title: "Calendrier vaccinal par souche",
        body: "Chaque souche a son calendrier : AviCare vous rappelle la prochaine injection avant qu'il ne soit trop tard.",
      },
      {
        title: "Délais d'attente & visites vétérinaires",
        body: "Les délais d'attente viande et œufs sont calculés automatiquement après chaque traitement, et les visites vétérinaires restent tracées dans l'historique de la bande.",
      },
    ],
    avoids: [
      "Un rappel de vaccin oublié parce que personne n'a regardé le calendrier.",
      "Une vente trop tôt, avant la fin du délai d'attente.",
      "Un traitement reconduit sans savoir ce qui a déjà été donné.",
    ],
    seo: {
      title: "Calendrier vaccinal volaille & suivi sanitaire | AviCare",
      description:
        "Calendrier vaccinal par souche, bibliothèque de vaccins et traitements, délais d'attente viande et œufs respectés, visites vétérinaires suivies.",
    },
  },
  {
    slug: "stocks",
    name: "Stocks",
    tag: "Aliment & achats",
    teaser:
      "Inventaire, formules d'aliment décomposées à la saisie, bons d'achat et réceptions, alertes de rupture avant la panne.",
    h1: "Ne tombez plus jamais en rupture d'aliment.",
    lead: "L'aliment qui part en formule, les achats qui arrivent en stock : tout est compté, rien ne se perd de vue.",
    capabilities: [
      {
        title: "Inventaire multi-articles",
        body: "Aliment, vaccins, matériel : tout votre stock au même endroit, avec la quantité réelle disponible à l'instant T.",
      },
      {
        title: "Formules d'aliment décomposées",
        body: "Une formule saisie une fois se décompose automatiquement en sorties de stock ingrédient par ingrédient, à chaque distribution.",
      },
      {
        title: "Bons d'achat, réceptions & alertes seuil",
        body: "Commandez, réceptionnez, et laissez AviCare vous alerter avant la rupture — plus jamais de poulailler à court d'aliment.",
      },
    ],
    avoids: [
      "Une rupture d'aliment découverte le jour où il n'y en a plus.",
      "Une formule refaite de mémoire, jamais deux fois pareille.",
      "Un bon d'achat payé sans savoir ce qui a vraiment été livré.",
    ],
    seo: {
      title: "Gestion de stock d'aliment & formules pour élevage | AviCare",
      description:
        "Inventaire d'aliment, formules décomposées à la saisie, bons d'achat et réceptions, alertes de rupture avant la panne.",
    },
  },
  {
    slug: "ventes",
    name: "Ventes",
    tag: "Clients & factures",
    teaser:
      "Fichier clients en compte-courant, commandes, livraisons, factures et encours — avec alerte crédit avant l'impayé.",
    h1: "Votre commerce enfin en ordre.",
    lead: "Du client à la facture, en passant par la livraison : votre commerce tient dans une seule fiche, pas dans un cahier.",
    capabilities: [
      {
        title: "Fichier clients & compte-courant",
        body: "Chaque client a sa fiche et son compte-courant : qui doit quoi, depuis quand, sans avoir à recompter.",
      },
      {
        title: "Commandes → livraisons",
        body: "Une commande se transforme en livraison en un geste, avec le stock qui se met à jour au même moment.",
      },
      {
        title: "Factures, paiements & alertes crédit",
        body: "Les factures et les paiements tiennent l'encours à jour en temps réel, avec une alerte avant que le crédit client ne dérape.",
      },
    ],
    avoids: [
      "Une dette client oubliée, jamais réclamée.",
      "Une livraison faite à un client déjà à découvert.",
      "Une facture qui ne part jamais, une vente qui reste impayée.",
    ],
    seo: {
      title: "Facturation & gestion clients pour éleveurs | AviCare",
      description:
        "Fichier clients en compte-courant, commandes et livraisons, factures et encours avec alerte crédit avant l'impayé.",
    },
  },
  {
    slug: "finance",
    name: "Finance",
    tag: "Marge & coûts",
    teaser:
      "Dépenses (achats, aliment, salaires, véto), marge par bande, coût de revient au kilo et compte de résultat de la ferme.",
    h1: "Sachez, à tout moment, si vous gagnez de l'argent.",
    lead: "Chaque dépense et chaque vente nourrit la même marge — bande par bande, jusqu'au compte de résultat de la ferme.",
    capabilities: [
      {
        title: "Dépenses centralisées",
        body: "Achats, aliment, salaires, vétérinaire : chaque dépense de la ferme est enregistrée au même endroit, prête à être imputée à la bonne bande.",
      },
      {
        title: "Marge par bande",
        body: "Chaque bande affiche sa marge réelle, dès la vente — plus besoin d'attendre la fin de l'année pour savoir si elle a été rentable.",
      },
      {
        title: "Compte de résultat & coût de revient au kg",
        body: "Le compte de résultat de la ferme se construit tout seul, et le coût de revient au kilo se calcule à partir de vos vraies données — pas d'une estimation.",
      },
    ],
    avoids: [
      "Une bande vendue sans savoir si elle a été rentable.",
      "Un coût de revient estimé au pif, jamais calculé.",
      "Un compte de résultat qu'on ne regarde qu'une fois par an — trop tard.",
    ],
    seo: {
      title: "Calcul de marge & rentabilité en élevage avicole | AviCare",
      description:
        "Dépenses, marge par bande, coût de revient au kilo et compte de résultat de la ferme — sachez si vous gagnez de l'argent.",
    },
  },
];
