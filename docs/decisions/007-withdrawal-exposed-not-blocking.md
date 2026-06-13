# ADR 007 — Délais d'attente médicamenteux : exposés, jamais bloquants (V1)

**Date** : 2026-06-13
**Statut** : Accepté
**Auteur** : Abdou Malick Cisse

## Contexte

Un traitement médicamenteux (antibiotique, anticoccidien…) impose un **délai
d'attente** réglementaire avant que la production puisse être vendue : un délai
viande et un délai œufs, exprimés en jours après la fin du traitement. Vendre
avant l'échéance expose à des résidus médicamenteux — un risque sanitaire et
réglementaire réel.

Le module santé (Sprint B3) calcule ces dates à l'enregistrement d'un traitement
(`treatments_executed` : snapshot figé des délais issus du catalogue, puis
`withdrawalEndDate* = endDate + withdrawalDays*`). La question : que fait le
système quand l'éleveur tente une vente pendant un délai d'attente actif ?

Deux options :
- **Bloquer** la vente / l'endpoint commercial tant qu'un délai est actif (garde
  dure).
- **Exposer** le délai comme avertissement visible et laisser l'éleveur décider.

## Décision

En V1, les délais d'attente sont **calculés et exposés**, mais **ne bloquent
jamais** :

- Aucun endpoint santé ou commercial n'est refusé à cause d'un délai actif —
  `getActiveWithdrawals` renvoie les délais en cours, il ne les **applique** pas.
- Le frontend affiche un **encadré orange** (`WithdrawalNotice`) avec la date
  minimale de vente recommandée (viande / œufs) et un compteur « J-n restants »,
  plus une remontée dans les alertes consolidées — informatif, jamais un blocage.
- La responsabilité de respecter le délai reste à **l'éleveur**.

## Justification

- **Réalité terrain** : l'éleveur ouest-africain reste seul décideur ; un blocage
  dur frustrerait des cas légitimes (vente d'un lot non traité, erreur de saisie)
  et pousserait au contournement.
- **Le module commercial n'existe pas encore** (Sprint B5) : un couplage
  santé→ventes serait prématuré et créerait une dépendance cross-context que
  l'architecture proscrit.
- **Sécurité par la visibilité** : rendre le délai impossible à manquer (encadré
  orange + alerte) couvre l'objectif de protection sans verrou rigide.

## Conséquences

- Pas de garde transactionnelle santé↔ventes à maintenir en V1.
- La donnée nécessaire au futur blocage est déjà persistée (snapshot des délais,
  dates de fin calculées) : un durcissement reste possible plus tard sans
  migration.
- **Évolution possible (V2+)** : mode « strict » optionnel par ferme (réglage)
  qui avertit fortement, voire bloque, la vente d'un lot sous délai actif — à
  reconsidérer une fois le module commercial livré.

## Liens

- Sprint B3 (santé) — `treatments_executed`, `AlertService`, `WithdrawalNotice`.
- Décision verrouillée en discussion produit, formalisée à la clôture du Sprint B3
  (tag `v0.8.0-health`).
