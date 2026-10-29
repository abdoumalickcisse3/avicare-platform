/**
 * Les comptes sociaux de Jawdi — une seule liste, deux usages.
 *
 * Elle alimente les icônes du pied de page **et** le `sameAs` des données
 * structurées. Les deux doivent dire la même chose : un moteur de recherche qui
 * lit un `sameAs` vers un compte inexistant perd confiance dans le reste de la
 * fiche, et un visiteur qui clique sur une icône morte aussi.
 *
 * **La règle, identique à celle des pastilles de boutiques : sans URL, aucun
 * lien n'est émis.** Un compte qui n'existe pas encore reste ici avec une URL
 * vide — il ne s'affiche nulle part, et le jour où il ouvre, une seule ligne
 * suffit à le publier partout.
 *
 * Les visuels de chaque réseau (photo de profil au bon format, bannière à la
 * bonne zone sûre) sont déjà générés dans `docs/brand/social/`.
 */
export interface Reseau {
  /** Clé technique, sert aussi à choisir l'icône. */
  readonly cle:
    | "linkedin"
    | "facebook"
    | "instagram"
    | "x"
    | "tiktok"
    | "youtube"
    | "whatsapp";
  /** Nom affiché aux lecteurs d'écran. */
  readonly nom: string;
  /** URL publique du compte. Vide = le compte n'existe pas encore. */
  readonly url: string;
}

export const RESEAUX: readonly Reseau[] = [
  {
    cle: "linkedin",
    nom: "LinkedIn",
    url: "https://www.linkedin.com/company/jawdi",
  },
  { cle: "facebook", nom: "Facebook", url: "" },
  { cle: "instagram", nom: "Instagram", url: "" },
  { cle: "whatsapp", nom: "WhatsApp", url: "" },
  { cle: "youtube", nom: "YouTube", url: "" },
  { cle: "tiktok", nom: "TikTok", url: "" },
  { cle: "x", nom: "X", url: "" },
] as const;

/** Ceux qui existent réellement, dans l'ordre déclaré. */
export const RESEAUX_ACTIFS: readonly Reseau[] = RESEAUX.filter(
  (r) => r.url !== "",
);

/** Le `sameAs` de schema.org : les mêmes comptes, rien d'inventé. */
export const SAME_AS: readonly string[] = RESEAUX_ACTIFS.map((r) => r.url);
