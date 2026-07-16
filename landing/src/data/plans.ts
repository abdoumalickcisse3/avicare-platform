// Plans tarifaires — copy verbatim du prototype (§ pricing). Réutilisé
// par l'accueil (bandeau pilote) et par la future page /tarifs, qui
// pourra surcharger le libellé du badge (ex. "Recommandé" au lieu de
// "Le plus complet volaille") via la prop `badge` de PricingCard.
export interface Plan {
  name: string;
  price: string;
  priceSuffix?: string;
  description: string;
  features: string[];
  ctaVariant: "ghost" | "cta";
  popular?: boolean;
  badge?: string;
}

export const plans: Plan[] = [
  {
    name: "Découverte",
    price: "Gratuit",
    description: "Toutes les fonctionnalités V1, 1 ferme.",
    features: ["Élevage, sanitaire, stocks", "Ventes & finances", "Support en français"],
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
];
