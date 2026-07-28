// Témoignages — illustratifs pour le pilote (voir la note affichée sous
// la grille sur la page). Copy verbatim du prototype (§ quotes).
export interface Testimonial {
  big: string;
  quote: string;
  initials: string;
  name: string;
  role: string;
}

export const testimonials: Testimonial[] = [
  {
    big: "+18%",
    quote: "Avant, je découvrais mes pertes à la vente. Maintenant je les vois venir.",
    initials: "MD",
    name: "Moussa D.",
    role: "Éleveur de chair · Thiès",
  },
  {
    big: "228 k F",
    quote: "Je sais enfin si ma ferme gagne de l'argent, sans attendre la fin de la saison.",
    initials: "AF",
    name: "Awa F.",
    role: "Éleveuse · Niayes",
  },
  {
    big: "30",
    quote: "On a mis 30 fermes de notre coopérative sur Jawdi.",
    initials: "SC",
    name: "S. Camara",
    role: "Responsable coopérative",
  },
];
