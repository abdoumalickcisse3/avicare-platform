/**
 * Trois pistes de symbole pour Jawdi, telles que l'étape 1 du cahier des charges les demande :
 * distinctes, en noir et blanc, jugées à 16 px avant toute couleur.
 *
 * Contraintes dures respectées par les trois : aucune espèce animale, aucune allusion à une
 * mâchoire, épaisseur de trait jamais sous 1/16 de la largeur (64 sur une grille de 1024), forme
 * tenant dans un carré et supportant un recadrage circulaire.
 */
const W = 128; // épaisseur commune : 1/8 de la grille, le double du minimum exigé.

const PISTES = [
  {
    id: 'fer',
    nom: 'La marque au fer',
    intention:
      "Une marque qui aurait pu être frappée plutôt que dessinée. Marquer une bête, c'est le " +
      "geste pastoral universel — sans représenter aucun animal. Le logiciel fait la même chose : " +
      "il enregistre officiellement ce qui appartient à l'éleveur.",
    // Barre franche, hampe, crochet resserré. Le vocabulaire exact des fers à marquer.
    // Le crochet est étroit : large, il se lisait « U » et la lettre se perdait.
    path: `M 272 288 H 752 M 632 288 V 560 C 632 724 376 724 376 556`,
  },
  {
    id: 'compte',
    nom: 'La marque de compte',
    intention:
      "Le geste universel du comptage : des bâtons, puis la barre qui ferme le groupe. Jawdi veut " +
      "dire richesse, et compter son troupeau c'est compter sa fortune — c'est exactement ce que " +
      "fait le logiciel. Aucune lettre, aucune bête : le symbole dit l'acte, pas l'objet.",
    tally: true,
  },
  {
    id: 'enclos',
    nom: "L'enclos vu d'en haut",
    intention:
      "Un enclos et sa porte, vus du dessus. Ce qui est contenu peut être compté, et Jawdi veut " +
      "dire richesse : compter son troupeau, c'est compter sa fortune. La forme dit l'idée sans " +
      "passer par la lettre ni par la bête, et l'ouverture empêche l'anneau d'être un anneau de plus.",
    // Un carré aux angles francs avec une ouverture : à 16 px il reste un contenant, pas une tache.
    openPen: true,
  },
];

module.exports = { W, PISTES };
