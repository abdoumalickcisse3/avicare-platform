# Endpoints livrés sans surface — rapport d'audit

_2026-09-07 · relevé automatique, décisions à prendre_

## Ce que c'est

Un audit des hooks RTK Query exportés par les deux apps et appelés par aucun écran. Un hook
exporté sans appelant, c'est un endpoint backend livré, testé, exposé dans la couche API des
deux côtés — et invisible pour l'éleveur.

Le relevé est désormais **tenu par un test** (`web/src/store/api/parity.test.ts`, registre
`HOOKS_WITH_NO_SCREEN`). Ce document explique les lignes de ce registre ; le test empêche la
liste de grandir en silence. Chaque décision prise ici se traduit par une ligne supprimée du
registre — soit parce que l'écran est fait, soit parce que le binding l'est.

**Ce rapport ne code rien.** Il pose les questions dans l'ordre où elles coûtent.

---

## 0. Rectification — la déconnexion web, elle, va bien

> La première version de ce rapport annonçait que la déconnexion web ne révoquait pas le refresh
> token. **C'est faux.** Le thunk `logout()` de `store/authActions` appelle bien
> `authApi.endpoints.logout.initiate(...)` (commit `b73ecf8`) : la session est fermée côté
> serveur. Le constat d'audit du 2026-09-04 a été corrigé depuis.
>
> Ce qui a produit l'erreur : le relevé ne lisait que les **noms de hooks**. Hors composant — dans
> un thunk, un garde de route — on n'appelle pas le hook mais `api.endpoints.<nom>.initiate(...)`,
> ce qui est la bonne façon de faire. Le détecteur compte désormais aussi cette forme, et
> `useLogoutMutation` a quitté le registre.
>
> Leçon pour la suite : **un hook absent du registre ne prouve rien de plus qu'une absence
> d'appel par ce nom-là.** Avant de conclure qu'une capacité manque, ouvrir le code appelant.

---

## 1. Trois capacités mobiles absentes du web — ✅ comblées

La règle du projet est « ce qui part sur le web part aussi sur le mobile ». Ces trois-là étaient
parties dans l'autre sens. **Chacune a été vérifiée en ouvrant l'écran web** — la première
version de ce rapport en annonçait six, dont trois n'en étaient pas (voir §2).

| Capacité | Ce qui manquait au web | État |
|---|---|---|
| **Régler le seuil d'alerte d'un article** | le seuil était **affiché** en KPI, jamais réglable | ✅ tuile cliquable + `ThresholdDialog` |
| **Archiver un article de stock** | le web ne désactivait que les formules | ✅ au pied de la fiche article |
| **Vaccinations enregistrées sur un lot** | invisibles sans programme assigné | ✅ liste sous l'échéancier |

Le seuil était le plus net : `StockItemDetailView` montrait « Seuil d'alerte » comme un chiffre,
et rien sur la page ne permettait de le changer. Un gérant au bureau voyait la valeur qui
déclenche ses alertes sans pouvoir l'ajuster.

La troisième était plus discrète : `VaccinationSection` proposait « Saisir une vaccination
ponctuelle » sur un lot sans programme, puis n'en montrait aucune trace. On pouvait vacciner sans
le moindre accusé de réception.

Les deux gestes de stock sont gardés par `inventory:write`, comme le mobile et comme le backend.

---

## 2. Redondances — instruites, et le verdict n'est pas celui annoncé

> La première version recommandait de **supprimer** ces endpoints, au motif que « deux chemins
> vers le même chiffre finissent par ne plus dire la même chose ». En allant voir, deux des trois
> ne sont pas deux chemins du tout — et le troisième cachait un vrai défaut.

### 2.1 Sanitaire : une seule implémentation, deux routes — ne rien faire

`AlertService` appelle **exactement les mêmes méthodes de service** que les endpoints dédiés :

| Endpoint | Ce qu'il appelle | Ce que l'agrégat `getHealthAlerts` appelle |
|---|---|---|
| `GET …/treatments/active-withdrawals` | `treatmentService.getActiveWithdrawals` | la même méthode |
| `GET …/vet-visits/upcoming-follow-ups` | `vetVisitService.listUpcomingFollowUps` | la même méthode |

Il n'y a qu'un seul calcul, exposé par deux routes. **Aucun risque de divergence** : mon argument
ne tenait pas. Les supprimer serait cosmétique, avec un risque de régression non nul pour zéro
bénéfice. **Décision : on les garde**, et leurs lignes restent au registre avec ce motif.

### 2.2 Factures en retard : deux implémentations, et elles ne disaient pas la même chose

Là, il y avait bien deux calculs — un prédicat SQL et un prédicat TypeScript — et ils
**divergeaient d'un jour** :

| Facture due le 7 septembre, consultée le 7 | Verdict |
|---|---|
| Backend : `due_date < today` (`findOverdue` **et** `sumOverdue`) | pas en retard |
| Web : `new Date(dueDate).getTime() < Date.now()` | **en retard** dès minuit UTC |

Conséquences visibles : le tableau de bord (« En retard : X F », calculé par le backend) et la
page Factures (« N en retard », calculée par le web) se contredisaient exactement des factures
dues du jour ; et un client était annoncé en retard alors qu'il avait jusqu'au soir pour payer.

Le backend a raison — une échéance au 7 n'est pas dépassée le 7. `isInvoiceOverdue` compare
désormais des **dates**, pas des instants, et six cas le tiennent (`commercial.overdue.test.ts`).

L'endpoint `/overdue` reste inutilisé, mais ce n'est plus la question : les deux définitions
concordent. **Décision : on le garde**, et on garde la dérivation côté client, qui évite un
aller-retour réseau pour un filtre d'onglet.

---

## 3. Décisions produit en attente

| Endpoint | La question |
|---|---|
| `getClientsOverCreditLimit` | Veut-on un écran « clients au-dessus de leur encours » ? D26 dit que l'alerte est indicative et non bloquante — reste à savoir où on la montre. |
| `deleteVaccination` | Les traitements et les visites vétérinaires se suppriment, pas les vaccinations. Incohérence assumée ou oubli ? |
| `updatePurchaseOrder` | Modifier un bon d'achat après création. Aucune des deux apps ne l'offre. |
| `updateStockNotes` | Notes libres sur une ligne de stock. Aucun champ ne les expose. |
| `getSale` | Fiche vente détaillée : les deux apps listent les ventes sans page de détail. |
| `getProgramsByBreed` | Filtrer le catalogue de programmes par race. Le catalogue complet est affiché tel quel. |
| `getMovementsByLot` | Mouvements de stock filtrés par lot. La fiche article les montre tous. |

---

## 4. Attendus, pas des manques

- `getAccountSettings` / `upsertSetting` — réglages de compte génériques, déjà listés dans
  `DESKTOP_ONLY`.
- `getIntegrityChecks`, `getPurgePreview` — console super-admin, dont les écrans ne sont pas
  faits (design validé, non codé).
- `getDelivery` côté mobile — le web s'en sert pour le bon de livraison imprimable ; imprimer
  est un geste de bureau.
- `recordVaccination`, `recordObservation` côté mobile — **ce ne sont pas des manques** : la
  saisie terrain passe par la file hors-ligne (`enqueueFieldMutation`), qui poste l'URL
  directement. Le hook RTK reste pour un futur appel en ligne.

---

## Ce que ce rapport ne prouve pas

Le relevé dit qu'aucun appel ne porte ce nom. Il ne dit pas qu'une capacité manque — cf. la
rectification en tête. Chaque ligne du registre est une **question à instruire**, pas un verdict :
ouvrir le code avant de coder quoi que ce soit.

---

## Comment ce rapport se périme

Bien. Chaque ligne traitée disparaît du registre `HOOKS_WITH_NO_SCREEN`, et le test échoue si
elle y reste. Quand le registre ne contient plus que la section 4, ce document n'a plus lieu
d'être.
