// Plans tarifaires — copy verbatim du prototype (§ pricing). Réutilisé
// par l'accueil (bandeau pilote) et par la page /tarifs, qui peut
// surcharger le libellé du badge (ex. "Recommandé" au lieu de
// "Le plus complet volaille") via la prop `badge` de PricingCard.
//
// La 4e carte "Sur mesure" (doc de design §8) n'a pas de prix chiffré ni
// de CTA de signup — `priceLabel` remplace le prix mono par un texte
// (rendu en Outfit, pas en JetBrains Mono, puisque ce n'est pas un
// nombre) et `contactCta` route son CTA vers le canal partenaire
// (mailto) au lieu du flux d'inscription. L'accueil filtre cette carte
// (voir index.astro) pour garder son bandeau pilote à 3 colonnes.
export interface Plan {
  name: string;
  price: string;
  priceSuffix?: string;
  description: string;
  features: string[];
  ctaVariant: "ghost" | "cta";
  popular?: boolean;
  badge?: string;
  /** Remplace `price`/`priceSuffix` par un libellé texte (plans sans prix chiffré). */
  priceLabel?: string;
  /** Surcharge le texte du CTA (par défaut "Commencer gratuitement"). */
  ctaLabel?: string;
  /** CTA vers le canal de contact partenaire (mailto) plutôt que le signup. */
  contactCta?: boolean;
}

export const plans: Plan[] = [
  {
    name: "Découverte",
    price: "Gratuit",
    description: "Élevage, sanitaire de base, stocks & ventes, 1 ferme.",
    features: ["Élevage, sanitaire de base, stocks", "Ventes, factures & encours", "Support en français"],
    ctaVariant: "ghost",
  },
  {
    name: "Pro Volaille",
    price: "25 000",
    priceSuffix: "F/mois · indicatif",
    description: "Chair + ponte, sanitaire avancé, 3 fermes.",
    features: ["Tout Découverte", "Sanitaire avancé & délais", "Jusqu'à 3 fermes"],
    ctaVariant: "cta",
    popular: true,
    badge: "Le plus complet volaille",
  },
  {
    name: "Ferme Complète",
    price: "45 000",
    priceSuffix: "F/mois · indicatif",
    description: "Tous les modules, 10 fermes, finance complète.",
    features: ["Tout Pro Volaille", "Finance & analytique", "Jusqu'à 10 fermes"],
    ctaVariant: "ghost",
  },
  {
    name: "Sur mesure",
    price: "",
    priceLabel: "Coopératives & gros réseaux",
    description: "Tarif réseau, accompagnement.",
    features: ["Tout Ferme Complète", "Accompagnement pour votre réseau", "Tarif calculé selon vos fermes"],
    ctaVariant: "ghost",
    ctaLabel: "Nous contacter",
    contactCta: true,
    badge: "Indicatif · à venir",
  },
];
