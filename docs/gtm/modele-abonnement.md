# Le modèle d'abonnement — conçu, non activé

> **Statut : proposition. Aucune ligne de code.** Conçue le 2026-09-08, elle attend les trois
> conditions du §5. L'ADR-009 reste en vigueur jusque-là.

## Le constat qui commande tout

La marge nette mensuelle d'un aviculteur sénégalais se situe entre **50 521 et 72 417 FCFA**
(ISRA/BAME, filière poulet du pays). La grille de `docs/00 §7` propose « Starter Volaille » à
15 000 F/mois.

**C'est 21 à 30 % de tout son revenu net.** « Ferme Complète » à 45 000 F en prend 62 à 89 %.
Aucun logiciel ne se vend à ce niveau ; la norme est 1 à 5 % de la valeur qu'il touche.

Ce n'est pas un problème de prix, c'est un problème d'**unité** : la grille facture un *mois* à
quelqu'un dont l'argent arrive le jour où la bande part.

## Ce que l'enquête ajoute

| Donnée | Mesure | Conséquence |
|---|---|---|
| Taille d'élevage | 11/17 sous 500 sujets | La cible dominante est très petite |
| Paie déjà un logiciel | 2/17 | Le prix de référence est **zéro** |
| Ce qui les ferait payer | 14/17 : « augmentation de mes revenus » | Se libelle en francs, pas en fonctionnalités |
| Internet à la ferme | 7/17 instable ou nul | Aucun paiement ne peut dépendre d'une connexion |

## 1. Le principe

**En élevage, l'unité de valeur n'est pas le mois : c'est la bande.** Facturer au cycle aligne
d'un coup la trésorerie de l'éleveur, la preuve de valeur (le compte de résultat de fin de bande)
et le moment où il a de quoi payer.

## 2. Le barème — dégressif, indexé sur les sujets démarrés

| Tranche | Prix | 400 sujets | 1 500 sujets | 6 000 sujets |
|---|---|---|---|---|
| Socle gratuit, à vie | 0 F | — | — | — |
| 1 – 500 sujets | 10 F/sujet | 4 000 F | 5 000 F | 5 000 F |
| 501 – 2 000 | 7 F/sujet | — | 7 000 F | 10 500 F |
| 2 001 et + | 4 F/sujet | — | — | 16 000 F |
| **Total par bande** | | **4 000 F** | **12 000 F** | **31 500 F** |
| Part de la marge du cycle | | 2–3 % | 2–3 % | 2–3 % |

Trois propriétés obtenues sans écrire d'exception : le prix reste à 2–3 % de la marge quelle que
soit la taille ; il est **dégressif**, donc il récompense la croissance ; et 4 000 F par bande,
c'est le prix d'un sac d'aliment sur les quarante qu'un éleveur achète.

**Le socle gratuit n'est pas un teaser.** Il contient un lot actif, la saisie journalière, la
mortalité et le compte de résultat de bande — c'est-à-dire précisément le moment « aha ». On ne
monnaie pas la preuve ; on monnaie ce qui vient après.

## 3. Les trois rails de paiement

1. **Le canal — primaire.** Un provendier, une coopérative ou un couvoir paie pour son réseau. Il
   porte déjà la relation, la confiance et le rail d'argent (thèse ADR-009).
2. **Wave / Orange Money — secondaire.** Pour la ferme indépendante, **enregistré à la main
   d'abord**, comme le module Paiements le fait déjà. Jamais de carte bancaire.
3. **Cohorte pilote.** Gratuite à vie, ou −50 %. Récompensée, jamais punie.

## 4. Ce qu'il faut construire — et ne pas construire

Le socle dormant est plus complet qu'il n'y paraît : `Subscription`, `SubscriptionModule`,
`FeatureChecker`, le gating par module, et surtout un **workflow demande → validation admin**
(`SubscriptionChangeRequest`, `ChangeRequestService`), intacts.

> **La trouvaille.** Ce workflow est exactement la forme dont on a besoin sans carte bancaire :
> l'éleveur demande, il paie par Wave, un humain confirme, l'abonnement s'active. Ce qui
> ressemblait à une lourdeur d'entreprise est le mécanisme juste pour ce marché.

| À construire | À ne pas construire |
|---|---|
| Un droit d'accès lié au **cycle**, pas à une date | Aucune passerelle de paiement tant que le volume ne la justifie pas |
| Un registre de facturation (dû, payé, par quel rail) | Aucune coupure d'accès automatique — un impayé se règle par un appel |
| La notion de **payeur ≠ ferme**, pour le partenaire | Aucun essai limité dans le temps : le gratuit est permanent |
| Le calcul du barème à l'ouverture d'une bande | Aucune relance automatisée sans humain pour traiter la réponse |

## 5. Le déclencheur — les trois conditions

Rien ne se facture avant que **les trois** soient réunies simultanément (`docs/11 §7`) :

1. Rétention prouvée : ≥ 4 fermes sur 5 saisissent encore après un cycle complet ;
2. Un partenaire signé ;
3. Charge de support tenable en solo.

**Au 2026-09-08 : aucune ferme en production.** Aucune des trois conditions n'est approchée.

## 6. L'extension multi-espèces

V1 n'est que la volaille. Une seule distinction suffit, et elle est biologique :

| Nature | Espèces | Unité facturée |
|---|---|---|
| **À cycle** | Poulet de chair, embouche ovine/caprine, bovin viande | Par **bande / lot**, barème ci-dessus |
| **Continue** | Pondeuses, bovins laitiers | Par **tête et par mois**, tarif faible |

**Tabaski.** L'embouche ovine culmine sur un seul événement annuel. Un éleveur qui engraisse pour
l'Aïd n'a aucune raison de payer douze mois, et toutes les raisons de payer une **saison**. Le
bundle « Tabaski Edition » de `docs/00 §7` trouve là sa forme naturelle, et un pic de revenu
annuel prévisible.

## 7. Ce qui reste à mesurer

Le barème est **calibré, pas mesuré**. Il tient à 2–3 % d'une marge estimée à 300–800 F/sujet.
Les 16 éleveurs recontactables (`phase-0-liste-appel.md`) sont l'échantillon pour le confirmer —
**la question du prix ne leur a jamais été posée**.

---

### Sources

Marges — ISRA/BAME, filière poulet du pays. Prix de revient et de vente — Purdue, *production
avicole intensive au Sénégal* ; relevés 2026. Modèles SaaS — l'hybride (socle + variable) domine
à 43 %, projeté 61 % fin 2026, meilleure croissance médiane (21 %) et +38 % de rétention nette ;
le par-siège s'effondre à 8 %. Abandon des plateformes agricoles africaines — Wageningen,
*Not-so-digital platforms?* : les abandons viennent des conseils mal calibrés et du manque
d'interactivité, pas de la connexion.
