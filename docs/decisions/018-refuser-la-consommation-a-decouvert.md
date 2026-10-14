# ADR 018 — Refuser une consommation que le stock ne couvre pas

**Date** : 2026-10-14
**Statut** : Accepté — **révise la décision 19** de `docs/00-vision-strategique.md`
**Auteur** : Abdou Malick Cisse

## Contexte

La décision 19 disait l'inverse : « stock insuffisant → **warning non bloquant** : le backend
accepte un solde négatif, l'UI affiche un avertissement orange. L'éleveur reste maître de son
inventaire — pas de garde dure ». Le raisonnement tenait : ce qui compte, c'est que l'ouvrier
saisisse sa journée ; lui opposer un mur parce que le patron n'a pas saisi l'achat, c'est perdre
la consommation, la mortalité, tout le relevé.

Un éleveur pilote a demandé l'inverse en octobre 2026, en voyant son charbon à −1 sac :

> « Si le produit n'existe pas en stock, ils ne peuvent pas le consommer. »

L'enquête dans son journal a montré que **ses trois soldes négatifs ne venaient pas de ses
collaborateurs** : deux étaient des défauts de la plateforme (corrigés par la PR #454), le
troisième un doublon dans son catalogue. Un blocage sec n'en aurait réglé aucun — il aurait refusé
une correction légitime et une consommation réelle. C'est pourquoi la garde arrive **après** ces
correctifs et pas avant.

Ce qui fait pencher malgré tout :

1. **Un solde négatif n'est pas un avertissement, c'est un faux chiffre qui se propage.** Chez le
   pilote, −1 sac valorisé **−6 100 F CFA** entrait dans la valeur du stock, donc dans ses coûts,
   donc dans son résultat. Un bandeau orange ne contamine rien ; un nombre négatif contamine tout.
2. **La plateforme était déjà incohérente.** Elle refuse de vendre 100 poulets quand la bande en
   compte 60 (décision 27, `PRODUCTION_INSUFFICIENT`) mais acceptait de consommer un sac qui
   n'existe pas.
3. **Le signal était inexploitable.** « Négatif » veut dire « il manque une entrée », sans dire
   laquelle ni quand — personne n'a été interrogé au moment où l'information était disponible.

## Décision

Une sortie de stock qui ferait passer le solde **sous zéro** est refusée : **422
`STOCK_INSUFFICIENT`**. La garde est posée dans `StockMovementService.recordMovement`, seul point
par lequel passent toutes les sorties.

**Trois exclusions, chacune pour une raison :**

| Exclu | Pourquoi |
|---|---|
| `IN` | Sur une ligne déjà négative, c'est l'une des deux seules portes de sortie. La fermer enfermerait l'éleveur dans son erreur. |
| `ADJUSTMENT` | L'autre porte : compter ce qu'il y a dans le magasin doit toujours être possible. Sa cible est déjà contrainte à ≥ 0. |
| `reason = SALE` | **Une vente n'est pas une consommation.** Refuser une consommation force la saisie de l'entrée manquante : la donnée s'améliore. Refuser une vente déjà encaissée empêche d'enregistrer de l'argent reçu : la donnée se perd, parce que l'éleveur passera outre. Vendre plus que la bande ne porte est de toute façon déjà refusé par la décision 27. |

**Le refus porte de quoi le réparer.** Le corps RFC 7807 transporte `stockItemId`, `articleKey`,
`articleLabel`, `unit`, `available` et `requested`, pour que l'écran propose les deux gestes qui
débloquent — enregistrer l'entrée manquante, ou compter le stock — au lieu de laisser l'ouvrier
devant un message.

**Un réglage de ferme peut la lever** : `inventory.block_negative_stock`, **à `true` par défaut**,
modifiable par l'API générique des réglages (OWNER/MANAGER). Il existe pour qu'une ferme qui
travaille autrement n'ait pas à attendre une livraison, pas pour que la garde démarre éteinte.
Une valeur stockée illisible vaut `true` : une garde qui s'ouvrirait sur une donnée abîmée serait
pire qu'inutile.

## Conséquences

- **Les fermes existantes passent en mode bloquant du jour au lendemain.** C'est assumé et c'est
  le but. Elles le sentiront : chez le pilote, une vingtaine d'articles sont à zéro faute d'achat
  saisi. Le mur est précisément ce qui force l'entrée — à condition que la porte de sortie soit
  dans le même écran, sinon la garde est punitive.
- Les soldes négatifs **hérités** ne sont pas réparés par cette garde : ils se régularisent à
  l'inventaire compté. L'alerte « stock négatif » reste donc utile, et pour les mêmes lignes.
- Les migrations V15 et V16 portent des commentaires qui citent la décision 19 : **elles ne sont
  pas modifiées** (une migration fusionnée est immuable). Le code et le présent ADR font foi.
- Réversible : le réglage par ferme, et une seule condition à retirer si la décision devait être
  reprise.

## Alternatives écartées

- **Garder le warning et mieux l'afficher.** C'était déjà le cas, en orange, et un éleveur
  attentif a quand même découvert ses négatifs des semaines plus tard, dans un total faussé.
- **Bloquer partout, ventes comprises.** Cohérent sur le papier, destructeur en pratique : voir le
  tableau ci-dessus.
- **Un réglage par défaut à `false`, à activer ferme par ferme.** Revient à ne rien changer pour
  presque tout le monde, et à faire porter à l'éleveur une décision technique qu'il n'a pas les
  éléments de trancher.
