# Phase 0 — le rituel

> Cinq fermes, deux cycles. La contrainte réelle n'est pas le produit : c'est **cinq à huit heures
> par semaine**, en side-project. Ce document découpe la Phase 0 du GTM (`docs/11 §4`) en une
> cadence qui tient dans ce budget, et pas une minute de plus.
>
> **Le principe qui gouverne tout le reste** : la saisie EST le produit. Sans saisie journalière,
> rien en aval n'existe — ni stock, ni marge, ni preuve, ni argument commercial.

---

## Semaine 1 — les appels

**Une seule tâche, aucune autre.** Dérouler `phase-0-liste-appel.md` de haut en bas.

| Quand | Quoi | Durée |
|---|---|---|
| Lundi soir | Appeler les candidats 1 à 3 | 45 min |
| Mercredi soir | Appeler les candidats 4 à 6 | 45 min |
| Samedi matin | Rattraper les non-décrochés, caler les rendez-vous | 1 h |

**Critère de fin de semaine** : cinq rendez-vous d'installation posés, dans **deux localités au
maximum**. Si l'on n'a que trois oui, on descend dans la liste — on n'élargit pas la zone.

> **La tentation à laquelle il ne faut pas céder** : ouvrir l'éditeur. Rien de ce qui se code cette
> semaine n'augmente le nombre de fermes.

---

## Semaines 2–3 — les installations

Une installation par soirée, jamais deux. **45 minutes, en personne ou en appel long.**

**Le déroulé, dans cet ordre :**

1. On crée la ferme **avec lui**, sur *son* téléphone. Jamais « voici l'app, débrouille-toi ».
2. On saisit sa bande en cours : effectif de départ, date, race si connue.
3. On fait **la première saisie ensemble** — mortalité du jour, aliment distribué.
4. On lui montre où ça atterrit : le lot, le compteur, le stock qui baisse.
5. On l'ajoute au groupe WhatsApp des pilotes.

**Ce qu'on note pendant** — chaque hésitation, chaque « et comment je fais pour… ». Ce sont les
seuls retours produit qui comptent à ce stade, et ils ne remontent jamais autrement.

**Critère de sortie** : cinq fermes avec une bande active et au moins une saisie faite par
l'éleveur lui-même, sans aide.

---

## Semaines 4 à 10 — la cadence de croisière

Trois rendez-vous fixes par semaine. **Rien d'autre n'est planifié.**

| Jour | Durée | Quoi | Le signal qu'on cherche |
|---|---|---|---|
| **Lundi** | 30 min | Le chiffre de la semaine dans le groupe. Relancer en privé ceux qui n'ont pas saisi depuis 3 jours. | Qui décroche, et à quel moment du cycle |
| **Mercredi** | 30 min | Revue des données des cinq fermes. Corriger ce qui bloque une saisie, rien d'autre. | Un chiffre aberrant = une incompréhension, pas un bug |
| **Samedi** | 1 h | Une visite ou un appel long, en tournant. | Ce qu'il ne dira jamais par écrit |

**Le budget est de 2 heures par semaine.** Ce qui reste des 5–8 heures va au produit — mais
seulement à ce que les cinq fermes ont réclamé.

### La règle du mercredi

On ne corrige **que** ce qui empêche une saisie. Une couleur mal choisie, une page lente, une idée
de fonctionnalité : notées, pas faites. Toute heure passée ailleurs est une heure volée aux cinq
fermes.

---

## Le moment à fabriquer — la fin de bande

Vers la semaine 7 pour une bande de chair démarrée en semaine 2. **C'est l'événement de toute la
Phase 0** ; tout le reste ne fait que l'amener.

L'éleveur voit la marge réelle de sa bande, calculée sur ce qu'il a saisi lui-même. Le message est
dans `phase-0-messages.md §5`.

**Trois choses à faire ce jour-là, et pas un autre :**
1. Lui montrer le compte de résultat **avant** de lui en parler. Le laisser lire.
2. Demander la permission de partager la capture, anonymisée.
3. Demander le parrainage. C'est le seul moment de tout le cycle où il est légitime.

---

## Les quatre chiffres qui disent si ça marche

Tous calculables depuis la base, sans outil supplémentaire.

| Métrique | Définition | Seuil |
|---|---|---|
| **Activation** | ferme avec 1 bande + 7 saisies dans les 14 premiers jours | ≥ 4 fermes sur 5 |
| **Rétention hebdo** | ≥ 3 saisies par semaine | ≥ 70 % des fermes actives |
| **Time-to-aha** | jours jusqu'au premier compte de résultat de bande | ≤ 50 jours |
| **Parrainage** | intros d'éleveurs par pilote | ≥ 1 |

**Critère de sortie de la Phase 0** : au moins 4 fermes sur 5 saisissent encore chaque semaine
après un cycle complet, et au moins 2 comptes de résultat de bande sont bouclés.

---

## Ce que la Phase 0 déclenche — et ce qu'elle n'autorise pas encore

| Atteint | Alors |
|---|---|
| 2 comptes de résultat bouclés | **Phase 1** — le Pack Preuve. On peut enfin écrire du contenu avec de vrais chiffres. |
| 4/5 fermes actives après un cycle | On peut approcher **un** provendier. Pas avant : il ne vous reçoit qu'une fois. |
| Rétention prouvée **et** 1 partenaire signé **et** support tenable | **Alors seulement** on ouvre le chantier abonnement. Le modèle est conçu (`docs/gtm/`, note de stratégie) ; il attend ces trois conditions. |

> **Le déclencheur de la monétisation, écrit noir sur blanc pour ne pas être avancé sous
> l'impatience** : rien ne se facture tant que ces trois conditions ne sont pas réunies
> simultanément. L'ADR-009 l'a décidé en juillet ; rien dans les données actuelles ne le contredit.

---

## Les cinq règles, à relire quand on doute

1. **Densité > couverture.** Croissance par contiguïté uniquement.
2. **La saisie est le produit.** Toute l'attention support va là.
3. **Un cycle complet avant de juger.** Le « wow » est en fin de bande.
4. **Pas de partenaire sans preuve.** Un provendier ne vous reçoit qu'une fois.
5. **Le produit n'est plus le goulot.** Il est complet, déployé, vérifié. Le goulot est le
   téléphone.
