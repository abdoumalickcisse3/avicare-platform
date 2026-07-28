# Copy des 5 sous-pages Fonctionnalités — rédigé depuis le produit réel

> Source : inventaire factuel du code (`web/src` + `backend`), 2026-07-16.
> Règle appliquée : **aucune promesse non adossée à une fonctionnalité vérifiée dans le code.**
> Les H1 et SEO titles viennent du spec §202-217 (verbatim). Le reste est rédigé ici.

---

## ⚠️ Écarts spec ↔ produit réel (à trancher)

| Spec §215-217 promet | Réalité vérifiée dans le code | Traitement ici |
|---|---|---|
| « **coût de revient au kg** » | **N'existe pas.** Aucun calcul de coût/kg nulle part. | **Retiré du copy.** |
| « **marge par bande** » | Partiel : « Revenu par lot » existe ; la **Marge** est calculée au niveau **ferme**, pas par lot. | Reformulé en « revenu par lot » + marge ferme. |
| « compte de résultat de la ferme » | Existe, mais **cumulé depuis toujours** (pas de filtre de période). | Formulé sans promettre un P&L mensuel. |
| « alertes crédit » (Ventes) | L'encours et le dépassement de limite s'affichent, mais **ne bloquent jamais** rien. | Formulé comme information, pas comme garde-fou. |
| « délais d'attente » (Sanitaire) | S'affichent (J-n, viande/œufs séparés) mais **ne bloquent aucune vente**. | Formulé comme rappel, pas comme blocage. |

Autres pièges évités : pas de vraie génération PDF (impression navigateur), pas d'intégration Mobile Money (référence saisie à la main), pas de programme vaccinal éditable, pas de réglages ponte éditables.

---

## 1. Élevage — `/fonctionnalites/elevage`

**H1** (spec) : Chaque bande sous contrôle, du jour 1 à la vente.

**Sous-titre :** Mortalité, aliment, eau, pesées : une saisie par jour, et la bande se raconte toute seule — GMQ, indice de consommation, date de maturité estimée.

**Bloc 1 — La saisie du jour, en une minute.**
Effectif, mortalité, aliment consommé, eau, observations. C'est tout ce qu'on vous demande. À partir de là, Jawdi calcule le reste : effectif actuel, mortalité cumulée, consommation cumulée, et où en est la bande face à l'objectif de sa souche — **en avance**, **dans l'objectif** ou **en retard**.

**Bloc 2 — La courbe de croissance ne ment pas.**
Chaque pesée (échantillon, poids moyen, uniformité) se place sur la courbe de votre souche. Vous voyez l'écart au moment où il se creuse, pas trois semaines plus tard à la vente. Avec le **GMQ** en g/j, l'**indice de consommation** et une **maturité estimée** qui se recalcule à chaque saisie.

**Bloc 3 — Chair et pondeuses, deux métiers, une app.**
Les pondeuses ont leur propre suivi : collecte par créneau, œufs cassés, **taux de ponte sur 7 jours**, entrée en ponte détectée automatiquement, attrition (mortalité + réforme). Clôturez la journée : les bons œufs partent en plateaux dans votre stock, prêts à vendre.

**Ce que ça vous évite**
- Le cahier qu'on remplit de mémoire le dimanche soir.
- Découvrir l'écart de poids le jour de la vente.
- Recompter l'effectif après chaque vente : il se réconcilie tout seul.

**SEO title** (spec) : Logiciel de suivi de bande — poulets de chair & pondeuses
**Meta :** Suivez mortalité, aliment, eau et pesées de chaque bande. GMQ, indice de consommation et courbe de croissance calculés automatiquement. Chair et pondeuses. Gratuit en phase pilote.

---

## 2. Sanitaire — `/fonctionnalites/sanitaire`

**H1** (spec) : Un élevage sain, un calendrier vaccinal tenu.

**Sous-titre :** Le calendrier vaccinal de votre souche, les doses en retard qui remontent d'elles-mêmes, et les délais d'attente affichés avant que vous ne vendiez.

**Bloc 1 — Le calendrier vous rappelle, vous ne cherchez plus.**
Assignez un programme vaccinal à la bande selon sa souche : chaque dose apparaît **faite**, **à venir** ou **en retard**. Le compteur « Vaccins en attente » vous dit en un coup d'œil ce qui traîne.

**Bloc 2 — Votre bibliothèque, vos produits.**
Vaccins et traitements de la plateforme, plus **les vôtres** : ajoutez vos propres produits, ils s'ajoutent à la liste et s'utilisent comme les autres. Quand vous enregistrez une vaccination, la dose se déduit toute seule de votre stock.

**Bloc 3 — Le vétérinaire, et ce qu'il coûte.**
Annuaire de vos vétérinaires, visites avec motif, diagnostic et recommandations. Renseignez le coût : la dépense part directement en comptabilité, sans double saisie. Les **délais d'attente** viande et œufs s'affichent en J-n, pour que vous sachiez où vous en êtes avant de vendre.

**Ce que ça vous évite**
- Le rappel vaccinal qui saute parce que personne ne l'avait noté.
- Chercher qui a soigné quoi, et avec quel produit.
- Retrouver la facture du véto trois mois plus tard.

**SEO title** (spec) : Calendrier vaccinal volaille & suivi sanitaire
**Meta :** Programme vaccinal par souche, doses en retard signalées, bibliothèque de vaccins et traitements personnalisable, visites vétérinaires et délais d'attente. Gratuit en phase pilote.

---

## 3. Stocks — `/fonctionnalites/stocks`

**H1** (spec) : Ne tombez plus jamais en rupture d'aliment.

**Sous-titre :** Un seuil d'alerte par article, des bons d'achat qui remplissent le stock à la réception, et des formules qui se décomposent toutes seules à la saisie.

**Bloc 1 — Le stock se tient à jour parce que vous ne le saisissez pas.**
Chaque saisie journalière déduit l'aliment. Chaque vaccination déduit la dose. Chaque vente déduit la marchandise. Vous notez ce que vous faites sur le terrain ; le stock suit. Passez sous le seuil : **« Stock bas — action requise »**.

**Bloc 2 — Vos formules, ingrédient par ingrédient.**
Composez votre formule d'aliment en pourcentages (maïs, tourteau, prémix…), ou clonez un modèle. À la saisie journalière, indiquez 50 kg de cette formule : Jawdi sort **chaque ingrédient au prorata** de votre stock. Le coût estimé aux 100 kg se recalcule avec vos prix.

**Bloc 3 — Du bon d'achat au stock, sans ressaisie.**
Brouillon, envoyé, reçu. À la réception, les quantités entrent en stock **et** la dépense part en comptabilité. Votre annuaire fournisseurs garde le reste.

**Ce que ça vous évite**
- S'apercevoir un dimanche qu'il ne reste plus d'aliment.
- Recalculer une formule à la main à chaque changement de prix.
- Saisir le même achat deux fois : au stock, puis en comptabilité.

**SEO title** (spec) : Gestion de stock d'aliment & formules pour élevage
**Meta :** Inventaire, seuils d'alerte, bons d'achat et formules d'aliment décomposées automatiquement à chaque saisie. Le stock se met à jour tout seul. Gratuit en phase pilote.

---

## 4. Ventes — `/fonctionnalites/ventes`

**H1** (spec) : Votre commerce enfin en ordre.

**Sous-titre :** Qui vous doit combien, quelle commande part demain, quelle facture reste à encaisser : la réponse tient sur un écran.

**Bloc 1 — Chaque client est un compte-courant.**
Fiche client, historique complet — commandes, ventes, factures, paiements — et surtout l'**encours actuel** : ce qu'il vous doit, maintenant. Facturez, l'encours monte. Encaissez, il descend. Vous ne tenez plus d'ardoise en parallèle.

**Bloc 2 — De la commande à la livraison, le stock suit.**
Commande, confirmation, livraison. La marchandise ne quitte votre stock qu'à la livraison réelle — et si vous annulez, elle y revient. Vendez plus que vous n'avez : Jawdi refuse la vente au lieu de vous laisser un stock négatif.

**Bloc 3 — Factures et paiements, sans tableur.**
La facture naît de la vente ou de la livraison, jamais d'une ressaisie. Encaissez en espèces, Wave, Orange Money ou virement, avec la référence de la transaction. Imprimez la facture ou le bon de livraison en A4 propre depuis le navigateur.

**Ce que ça vous évite**
- « Il me doit combien déjà ? »
- Vendre une bande deux fois par erreur.
- Refaire la facture dans un tableur après l'avoir écrite sur un carnet.

**SEO title** (spec) : Facturation & gestion clients pour éleveurs
**Meta :** Fichier clients avec encours en temps réel, commandes, livraisons, factures et paiements. Le stock se décrémente à la livraison, jamais avant. Gratuit en phase pilote.

---

## 5. Finance — `/fonctionnalites/finance`

**H1** (spec) : Sachez, à tout moment, si vous gagnez de l'argent.

**Sous-titre :** Revenus, dépenses, marge. Et le détail : ce que rapporte chaque lot, où part chaque franc.

**Bloc 1 — Vos dépenses arrivent toutes seules.**
Recevez un bon d'achat : la dépense est là. Payez une visite vétérinaire : elle est là. Versez un salaire ou une avance : elle est là. Vous ajoutez à la main ce qui reste — et rien d'autre.

**Bloc 2 — Le compte de résultat de la ferme.**
Total revenus, total dépenses, **marge**. Le revenu se décompose entre ventes directes et commandes payées ; les dépenses, par catégorie. Le revenu n'est pas déclaré : il est calculé à partir de vos ventes réellement encaissées.

**Bloc 3 — Ce que rapporte chaque lot.**
Le tableau « revenu par lot » vous dit quelle bande a produit quoi. Comparez, et sachez laquelle refaire.

**Ce que ça vous évite**
- Croire que la saison était bonne, sans jamais l'avoir vérifié.
- Reconstituer les dépenses de la bande de mémoire.
- Découvrir l'ardoise du personnel en fin de mois.

**SEO title** (spec) : Calcul de marge & rentabilité en élevage avicole
**Meta :** Revenus, dépenses et marge de la ferme, alimentés automatiquement par vos achats, vos visites vétérinaires et vos salaires. Revenu par lot. Gratuit en phase pilote.
