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

## 1. À décider en priorité

### 1.1 La déconnexion web ne révoque rien

`useLogoutMutation` n'est appelé par aucun écran. Le bouton Déconnexion de `Header.tsx`
dispatche `logout()` (`store/authActions`), qui vide le stockage local et rien d'autre. Le
refresh token reste valide côté serveur jusqu'à son expiration — 30 jours.

Concrètement : un éleveur qui se déconnecte d'un poste partagé (cybercafé, poste d'une
coopérative) croit avoir fermé sa session. Elle est fermée sur cet écran seulement.

C'était déjà un constat de l'audit du 2026-09-04, resté ouvert. Le binding existe, il suffit de
l'appeler. **Recommandation : corriger, c'est une ligne.**

### 1.2 Six capacités sur le mobile, absentes du web

La règle du projet est « ce qui part sur le web part aussi sur le mobile ». Ces six-là sont
parties dans l'autre sens et personne ne l'a vu :

| Capacité | Monté sur mobile | Web |
|---|---|---|
| Alertes de stock bas | onglet Stocks | absent |
| Régler le seuil d'alerte d'un article | fiche article | absent |
| Désactiver un article de stock | fiche article | absent |
| Encours d'un client (D26) | fiche client | absent |
| Vaccinations d'un lot (liste) | onglet Sanitaire | absent (échéancier seulement) |
| Lecture d'une formule seule | édition de formule | absent |

Les trois premières touchent le stock, qui est le défi n°1 de 14 éleveurs sur 17. Un gérant qui
travaille au bureau n'a pas ses alertes de stock bas.

**Recommandation : traiter les trois du stock ; les trois autres sont mineures.**

---

## 2. Redondances — supprimer plutôt que monter

| Endpoint | Pourquoi il ne sert pas |
|---|---|
| `getActiveWithdrawals` | Les délais d'attente actifs arrivent déjà par l'agrégat `getHealthAlerts`, qui alimente l'écran Sanitaire des deux côtés. **Il n'y a pas de trou sanitaire** : le délai d'attente est bien affiché. |
| `getUpcomingFollowUps` | Même chose, les visites de suivi viennent de `getHealthAlerts`. |
| `getOverdueInvoices` | Les impayés sont dérivés côté client (`isInvoiceOverdue`) sur la liste des factures. Deux façons de calculer la même chose : en garder une. |

**Recommandation : supprimer les bindings front, et les endpoints backend s'ils n'ont pas
d'autre client.** Deux chemins vers le même chiffre finissent par ne plus dire la même chose.

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

## Comment ce rapport se périme

Bien. Chaque ligne traitée disparaît du registre `HOOKS_WITH_NO_SCREEN`, et le test échoue si
elle y reste. Quand le registre ne contient plus que la section 4, ce document n'a plus lieu
d'être.
