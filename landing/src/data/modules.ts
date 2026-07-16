// Source unique des 5 modules produit (chair & ponte, sanitaire, stocks,
// ventes, finance) : alimente à la fois la grille de la page hub
// `/fonctionnalites` (nom, tag, teaser) et les 5 sous-pages générées par
// `getStaticPaths()` (H1, lead, capacités, "Ce que ça vous évite", SEO).
//
// Copy VERBATIM validée par le product owner (2026-07-16) :
// docs/superpowers/specs/assets/landing-copy-modules.md
// H1, sous-titre (`lead`), les 3 blocs de capacité (`capabilities`), les 3
// puces "Ce que ça vous évite" (`avoids`), et le SEO (title/description)
// sont copiés mot pour mot depuis ce document. Ne pas paraphraser.
//
// `teaser` (carte du hub) réutilise `lead` verbatim plutôt que d'inventer
// un résumé séparé — même contenu validé, pas de nouvelle affirmation.
// `name`/`tag` sont des étiquettes neutres (pas des promesses produit).
//
// Affirmations volontairement absentes (cf. le doc ci-dessus, §"Écarts
// spec ↔ produit réel") : pas de "coût de revient au kg", pas de "marge
// par bande" (la marge est calculée au niveau ferme, pas par lot) ; les
// alertes crédit et délais d'attente sont informatifs, ils ne bloquent
// jamais une vente.
//
// `**mots**` dans les corps de capacité = emphase du copy source ; rendue
// en <strong> par [module].astro (voir mdBold()), mots inchangés.

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
      "Mortalité, aliment, eau, pesées : une saisie par jour, et la bande se raconte toute seule — GMQ, indice de consommation, date de maturité estimée.",
    h1: "Chaque bande sous contrôle, du jour 1 à la vente.",
    lead: "Mortalité, aliment, eau, pesées : une saisie par jour, et la bande se raconte toute seule — GMQ, indice de consommation, date de maturité estimée.",
    capabilities: [
      {
        title: "La saisie du jour, en une minute.",
        body: "Effectif, mortalité, aliment consommé, eau, observations. C'est tout ce qu'on vous demande. À partir de là, AviCare calcule le reste : effectif actuel, mortalité cumulée, consommation cumulée, et où en est la bande face à l'objectif de sa souche — **en avance**, **dans l'objectif** ou **en retard**.",
      },
      {
        title: "La courbe de croissance ne ment pas.",
        body: "Chaque pesée (échantillon, poids moyen, uniformité) se place sur la courbe de votre souche. Vous voyez l'écart au moment où il se creuse, pas trois semaines plus tard à la vente. Avec le **GMQ** en g/j, l'**indice de consommation** et une **maturité estimée** qui se recalcule à chaque saisie.",
      },
      {
        title: "Chair et pondeuses, deux métiers, une app.",
        body: "Les pondeuses ont leur propre suivi : collecte par créneau, œufs cassés, **taux de ponte sur 7 jours**, entrée en ponte détectée automatiquement, attrition (mortalité + réforme). Clôturez la journée : les bons œufs partent en plateaux dans votre stock, prêts à vendre.",
      },
    ],
    avoids: [
      "Le cahier qu'on remplit de mémoire le dimanche soir.",
      "Découvrir l'écart de poids le jour de la vente.",
      "Recompter l'effectif après chaque vente : il se réconcilie tout seul.",
    ],
    seo: {
      title: "Logiciel de suivi de bande — poulets de chair & pondeuses | AviCare",
      description:
        "Suivez mortalité, aliment, eau et pesées de chaque bande. GMQ, indice de consommation et courbe de croissance calculés automatiquement. Chair et pondeuses. Gratuit en phase pilote.",
    },
  },
  {
    slug: "sanitaire",
    name: "Sanitaire",
    tag: "Vaccins & traitements",
    teaser:
      "Le calendrier vaccinal de votre souche, les doses en retard qui remontent d'elles-mêmes, et les délais d'attente affichés avant que vous ne vendiez.",
    h1: "Un élevage sain, un calendrier vaccinal tenu.",
    lead: "Le calendrier vaccinal de votre souche, les doses en retard qui remontent d'elles-mêmes, et les délais d'attente affichés avant que vous ne vendiez.",
    capabilities: [
      {
        title: "Le calendrier vous rappelle, vous ne cherchez plus.",
        body: "Assignez un programme vaccinal à la bande selon sa souche : chaque dose apparaît **faite**, **à venir** ou **en retard**. Le compteur « Vaccins en attente » vous dit en un coup d'œil ce qui traîne.",
      },
      {
        title: "Votre bibliothèque, vos produits.",
        body: "Vaccins et traitements de la plateforme, plus **les vôtres** : ajoutez vos propres produits, ils s'ajoutent à la liste et s'utilisent comme les autres. Quand vous enregistrez une vaccination, la dose se déduit toute seule de votre stock.",
      },
      {
        title: "Le vétérinaire, et ce qu'il coûte.",
        body: "Annuaire de vos vétérinaires, visites avec motif, diagnostic et recommandations. Renseignez le coût : la dépense part directement en comptabilité, sans double saisie. Les **délais d'attente** viande et œufs s'affichent en J-n, pour que vous sachiez où vous en êtes avant de vendre.",
      },
    ],
    avoids: [
      "Le rappel vaccinal qui saute parce que personne ne l'avait noté.",
      "Chercher qui a soigné quoi, et avec quel produit.",
      "Retrouver la facture du véto trois mois plus tard.",
    ],
    seo: {
      title: "Calendrier vaccinal volaille & suivi sanitaire | AviCare",
      description:
        "Programme vaccinal par souche, doses en retard signalées, bibliothèque de vaccins et traitements personnalisable, visites vétérinaires et délais d'attente. Gratuit en phase pilote.",
    },
  },
  {
    slug: "stocks",
    name: "Stocks",
    tag: "Aliment & achats",
    teaser:
      "Un seuil d'alerte par article, des bons d'achat qui remplissent le stock à la réception, et des formules qui se décomposent toutes seules à la saisie.",
    h1: "Ne tombez plus jamais en rupture d'aliment.",
    lead: "Un seuil d'alerte par article, des bons d'achat qui remplissent le stock à la réception, et des formules qui se décomposent toutes seules à la saisie.",
    capabilities: [
      {
        title: "Le stock se tient à jour parce que vous ne le saisissez pas.",
        body: "Chaque saisie journalière déduit l'aliment. Chaque vaccination déduit la dose. Chaque vente déduit la marchandise. Vous notez ce que vous faites sur le terrain ; le stock suit. Passez sous le seuil : **« Stock bas — action requise »**.",
      },
      {
        title: "Vos formules, ingrédient par ingrédient.",
        body: "Composez votre formule d'aliment en pourcentages (maïs, tourteau, prémix…), ou clonez un modèle. À la saisie journalière, indiquez 50 kg de cette formule : AviCare sort **chaque ingrédient au prorata** de votre stock. Le coût estimé aux 100 kg se recalcule avec vos prix.",
      },
      {
        title: "Du bon d'achat au stock, sans ressaisie.",
        body: "Brouillon, envoyé, reçu. À la réception, les quantités entrent en stock **et** la dépense part en comptabilité. Votre annuaire fournisseurs garde le reste.",
      },
    ],
    avoids: [
      "S'apercevoir un dimanche qu'il ne reste plus d'aliment.",
      "Recalculer une formule à la main à chaque changement de prix.",
      "Saisir le même achat deux fois : au stock, puis en comptabilité.",
    ],
    seo: {
      title: "Gestion de stock d'aliment & formules pour élevage | AviCare",
      description:
        "Inventaire, seuils d'alerte, bons d'achat et formules d'aliment décomposées automatiquement à chaque saisie. Le stock se met à jour tout seul. Gratuit en phase pilote.",
    },
  },
  {
    slug: "ventes",
    name: "Ventes",
    tag: "Clients & factures",
    teaser:
      "Qui vous doit combien, quelle commande part demain, quelle facture reste à encaisser : la réponse tient sur un écran.",
    h1: "Votre commerce enfin en ordre.",
    lead: "Qui vous doit combien, quelle commande part demain, quelle facture reste à encaisser : la réponse tient sur un écran.",
    capabilities: [
      {
        title: "Chaque client est un compte-courant.",
        body: "Fiche client, historique complet — commandes, ventes, factures, paiements — et surtout l'**encours actuel** : ce qu'il vous doit, maintenant. Facturez, l'encours monte. Encaissez, il descend. Vous ne tenez plus d'ardoise en parallèle.",
      },
      {
        title: "De la commande à la livraison, le stock suit.",
        body: "Commande, confirmation, livraison. La marchandise ne quitte votre stock qu'à la livraison réelle — et si vous annulez, elle y revient. Vendez plus que vous n'avez : AviCare refuse la vente au lieu de vous laisser un stock négatif.",
      },
      {
        title: "Factures et paiements, sans tableur.",
        body: "La facture naît de la vente ou de la livraison, jamais d'une ressaisie. Encaissez en espèces, Wave, Orange Money ou virement, avec la référence de la transaction. Imprimez la facture ou le bon de livraison en A4 propre depuis le navigateur.",
      },
    ],
    avoids: [
      "« Il me doit combien déjà ? »",
      "Vendre une bande deux fois par erreur.",
      "Refaire la facture dans un tableur après l'avoir écrite sur un carnet.",
    ],
    seo: {
      title: "Facturation & gestion clients pour éleveurs | AviCare",
      description:
        "Fichier clients avec encours en temps réel, commandes, livraisons, factures et paiements. Le stock se décrémente à la livraison, jamais avant. Gratuit en phase pilote.",
    },
  },
  {
    slug: "finance",
    name: "Finance",
    tag: "Revenus & dépenses",
    teaser: "Revenus, dépenses, marge. Et le détail : ce que rapporte chaque lot, où part chaque franc.",
    h1: "Sachez, à tout moment, si vous gagnez de l'argent.",
    lead: "Revenus, dépenses, marge. Et le détail : ce que rapporte chaque lot, où part chaque franc.",
    capabilities: [
      {
        title: "Vos dépenses arrivent toutes seules.",
        body: "Recevez un bon d'achat : la dépense est là. Payez une visite vétérinaire : elle est là. Versez un salaire ou une avance : elle est là. Vous ajoutez à la main ce qui reste — et rien d'autre.",
      },
      {
        title: "Le compte de résultat de la ferme.",
        body: "Total revenus, total dépenses, **marge**. Le revenu se décompose entre ventes directes et commandes payées ; les dépenses, par catégorie. Le revenu n'est pas déclaré : il est calculé à partir de vos ventes réellement encaissées.",
      },
      {
        title: "Ce que rapporte chaque lot.",
        body: "Le tableau « revenu par lot » vous dit quelle bande a produit quoi. Comparez, et sachez laquelle refaire.",
      },
    ],
    avoids: [
      "Croire que la saison était bonne, sans jamais l'avoir vérifié.",
      "Reconstituer les dépenses de la bande de mémoire.",
      "Découvrir l'ardoise du personnel en fin de mois.",
    ],
    seo: {
      title: "Calcul de marge & rentabilité en élevage avicole | AviCare",
      description:
        "Revenus, dépenses et marge de la ferme, alimentés automatiquement par vos achats, vos visites vétérinaires et vos salaires. Revenu par lot. Gratuit en phase pilote.",
    },
  },
];
