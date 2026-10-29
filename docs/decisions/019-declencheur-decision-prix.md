# ADR 019 — Un déclencheur, pas un prix

**Date** : 2026-10-29
**Statut** : Accepté — **complète l'ADR 009** (`009-remove-self-serve-subscription.md`)
**Auteur** : Abdou Malick Cisse

## Contexte

L'ADR 009 a retiré le self-serve d'abonnement pour le pilote : gratuit, tous les modules V1 actifs,
mécanisme de gating conservé dormant. Il a aussi posé la thèse de monétisation — B2B2C canal en
primaire, mobile money par cycle en secondaire — et l'a explicitement **différée**.

Ce qu'il n'a pas posé : **jusqu'à quand**. Rien, dans le code ni dans les documents, ne dit à quel
moment la question du prix doit revenir sur la table. Une gratuité sans fin annoncée n'est pas une
stratégie, c'est un oubli qui se découvre le jour où elle devient impossible à retirer.

Deux choses rendent la question concrète aujourd'hui :

1. **Le cap a changé le 2026-10-29.** La V2 « Tabaski Edition » du doc 00 est reportée ; le cap
   retenu est *plus de fermes de volaille, sur plusieurs pays d'Afrique de l'Ouest*
   (cf. `docs/superpowers/specs/2026-10-29-ouvrir-la-porte-design.md`). Ouvrir l'inscription au
   public, c'est accepter des fermes qui arrivent seules.
2. **Chaque ferme coûte quelque chose.** Du crédit WhatsApp, et surtout du temps d'accompagnement
   d'une personne seule. À deux fermes c'est une générosité ; à cinquante c'est intenable, et le
   jour où ça devient intenable est précisément le pire moment pour inventer un prix.

Et une raison de ne **pas** décider maintenant, qui tient : un prix posé en phase pilote est un prix
inventé. On n'a encore aucun signal de disposition à payer — l'ADR 009 le dit déjà, et rien n'a
changé sur ce point.

## Décision

**Aucun prix n'est fixé. Un déclencheur est écrit.**

> La question du prix est rouverte lorsque **dix fermes ont au moins une saisie dans les trente
> derniers jours**.

Ce seuil n'est pas un objectif commercial : c'est le point où l'accompagnement personnel d'un solo
dev cesse de tenir. Tant qu'il n'est pas atteint, il n'y a **rien à faire** — ni code, ni décision,
ni communication.

### Comment il se lit — sans rien construire

Les deux chiffres existent déjà en production :

- **Fermes réellement actives** : la colonne `lastActivityAt` de l'annuaire du back-office
  (`AdminFarmRow`, alimentée par `LivestockFacade.lastActivityByFarm`). Elle se compte à l'œil sur
  une liste triée.
- **Coût par ferme** : `WhatsAppLedger.Usage.byFarm`, rendu dans la console. La migration
  `V45__whatsapp_outbox_accounting.sql` a ajouté `whatsapp_outbox.farm_id` et `source`
  **exactement** pour que cette question ait une réponse.

Le seuil se lit donc à l'œil, délibérément : automatiser une mesure qui ne se déclenche qu'une seule
fois coûterait plus de code que de regarder une liste.

**Attention au faux ami** : le compteur « MAU » de `AdminMetricsService` compte les **utilisateurs**
par `lastLoginAt` sur trente jours, pas les fermes qui saisissent. Ce n'est pas la même question, et
s'y fier donnerait un nombre toujours plus grand que le vrai.

## Conséquences

- La gratuité reste **sans date de fin**, mais plus sans borne de **mots** : partout où la landing
  revendique la gratuité, elle dit déjà « pendant le pilote » ou « pendant la phase pilote »
  (vérifié le 2026-10-29). La page d'inscription web, qui devient la porte publique, reçoit la même
  mention.
- Le mécanisme de gating reste dormant, comme décidé en 009. Cet ADR n'en réactive rien.
- Quand le seuil est atteint, cet ADR **ne dit pas quoi décider** : il oblige seulement à reprendre
  la thèse de l'ADR 009 (canal B2B2C d'abord) avec, cette fois, des chiffres réels — nombre de
  fermes, coût par ferme, et ce que les éleveurs ont dit entre-temps.

## Alternatives écartées

- **Fixer un prix maintenant.** Ce serait un prix inventé : aucune donnée de disposition à payer,
  et un pilote de deux fermes n'en produit pas. C'est aussi ce que l'ADR 009 a déjà tranché.
- **Une échéance de temps** (« on en reparle dans six mois »). Une date ne mesure rien : six mois
  avec trois fermes ne posent aucun problème, trois mois avec trente en posent un.
- **Une alerte automatique sur le seuil.** Du code pour un événement unique, qui vieillirait mal et
  ne serait jamais relu.
- **Se fier au MAU existant.** Il compte les utilisateurs connectés, pas les fermes qui saisissent :
  il répondrait à côté de la question.
