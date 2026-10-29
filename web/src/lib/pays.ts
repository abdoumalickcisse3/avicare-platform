/**
 * Les huit pays de la zone XOF, pour le sélecteur de pays d'une ferme.
 *
 * La **source de vérité est le backend** : le catalogue `countries` (migration V67) porte le
 * fuseau et le libellé du champ fiscal, et `FarmResponse.taxIdLabel` les résout à la lecture.
 * Cette liste-ci ne sert qu'à peupler un menu et à montrer le libellé changer sous les yeux de
 * l'utilisateur avant qu'il n'enregistre — jamais à décider quoi que ce soit.
 *
 * Le périmètre s'arrête à la zone XOF : un pays hors zone pose d'abord une question de devise.
 *
 * Ce fichier est dupliqué dans `mobile/src/pays.ts`, pour la même raison que `countries.ts` :
 * le dossier `shared/` n'est câblé ni dans Metro ni dans Next. Une ligne ajoutée ici s'ajoute
 * là-bas, et dans la migration du catalogue.
 */
export interface PaysXof {
  /** ISO 3166-1 alpha-2. */
  readonly iso: string;
  readonly nom: string;
  /** Nom du champ fiscal imprimé sur la facture. */
  readonly libelleFiscal: string;
}

export const PAYS_XOF: readonly PaysXof[] = [
  { iso: "SN", nom: "Sénégal", libelleFiscal: "NINEA" },
  { iso: "CI", nom: "Côte d'Ivoire", libelleFiscal: "N° contribuable" },
  { iso: "BJ", nom: "Bénin", libelleFiscal: "N° contribuable" },
  { iso: "BF", nom: "Burkina Faso", libelleFiscal: "N° contribuable" },
  { iso: "ML", nom: "Mali", libelleFiscal: "N° contribuable" },
  { iso: "TG", nom: "Togo", libelleFiscal: "N° contribuable" },
  { iso: "NE", nom: "Niger", libelleFiscal: "N° contribuable" },
  { iso: "GW", nom: "Guinée-Bissau", libelleFiscal: "N° contribuable" },
] as const;

/** Le pays par défaut : celui où sont les fermes aujourd'hui. */
export const PAYS_DEFAUT = "SN";
