# Refonte UX du module Commercial (Spec A)

**Date** : 2026-06-21
**Statut** : Validé (design) — en attente de relecture spec
**Sprint** : B5 (post-livraison) — dette UX
**Périmètre** : Frontend uniquement (`web/`). Backend inchangé (réutilise l'API REST B5-5).

---

## 1. Contexte & problème

Le module Commercial a été livré de bout en bout (B5-1 → B5-6, backend + REST + front). À l'usage, le **frontend** pose 4 problèmes confirmés par l'utilisateur :

1. **Navigation fragmentée** — 7 entrées sidebar (Vue d'ensemble, Clients, Commandes, Ventes, Livraisons, Factures, Paiements). On se perd.
2. **Enchaînements métier confus** — passer de commande → livraison → facture → paiement n'est pas guidé ; les liens entre documents sont peu visibles ; pas de « prochaine étape » claire.
3. **Fonctionnalités manquantes** — pas de liens inter-documents, pas de facturation/encaissement en 1 clic, pas d'historique consolidé par client, pas d'impression PDF.
4. **Ergonomie / visuel** — pas assez clair/moderne/mobile pour la cible (éleveur ouest-africain, mobile-first).

**Décision transverse de l'utilisateur** : les **vues d'ensemble (KPI/statistiques)** doivent être centralisées sur **le tableau de bord principal** (chantier séparé, via Rill — *Spec B*), **pas répétées dans chaque page commerciale**. Les pages commerciales redeviennent des **listes transactionnelles épurées**.

## 2. Objectif

Refondre l'expérience transactionnelle du module pour qu'elle soit **simple, guidée et mobile-first**, sans toucher au backend. Cible : un éleveur qui veut, sans se perdre, prendre une commande, la livrer, la facturer et l'encaisser — et savoir à tout moment « quoi faire ensuite ».

**Non-objectifs (hors Spec A)** :
- Statistiques/analytique sur le dashboard → **Spec B (Rill)**.
- **TVA** (D25 = HT only V1), **remises**, **avoirs/retours** → nécessitent du backend, exclus.
- Toute modification du backend, des migrations ou de l'API REST.

## 3. Architecture de navigation (Approche A — validée)

Le groupe sidebar **Commercial** passe de 7 à **5 entrées** :

```
Commercial
 ├ Accueil      → /commercial            (worklist « à faire », SANS KPI)
 ├ Clients      → /commercial/clients
 ├ Commandes    → /commercial/commandes  (livraisons incluses)
 ├ Ventes       → /commercial/ventes
 └ Factures     → /commercial/factures   (paiements inclus)
```

- **Livraisons** n'est plus une entrée racine : une livraison est l'aboutissement d'une commande. Elle reste visible (a) sur la fiche commande (document lié) et (b) via un **onglet « Livraisons »** dans la page Commandes, et (c) dans la worklist « à livrer ». La route `/commercial/livraisons` est **supprimée** (redirigée vers `/commercial/commandes`).
- **Paiements** n'est plus une entrée racine : un paiement est une action sur une facture. Il reste visible (a) sur la fiche facture et (b) via un **onglet « Paiements »** dans la page Factures. La route `/commercial/paiements` est **supprimée** (redirigée vers `/commercial/factures`).

Justification : moins d'entrées = moins de dispersion ; les concepts « fulfillment » (livraison) et « encaissement » (paiement) se rattachent à leur document parent plutôt que de flotter en silos.

## 4. Fil conducteur — `DocumentFlow` (le cœur de la refonte)

Un composant réutilisable **`DocumentFlow`** affiché en tête de chaque fiche (commande, vente, livraison, facture). Il rend :

- **Provenance** : d'où vient ce document (ex. une facture « depuis la commande ORD-2026-012 »).
- **Documents liés** : chaîne cliquable commande → livraison → facture → paiement(s).
- **Étape suivante** : un **bouton d'action unique, contextuel**, qui fait avancer le parcours.

Mapping « étape suivante » (réutilise les transitions REST existantes) :

| Document / état | Bouton « étape suivante » | Action REST |
|---|---|---|
| Commande PENDING | Confirmer | `POST orders/{id}/confirm` |
| Commande CONFIRMED | Préparer | `POST orders/{id}/start-preparation` |
| Commande IN_PROGRESS | Livrer | `POST deliveries` (from order) |
| Commande/Livraison DELIVERED, non facturée | Générer la facture | `POST invoices/from-delivery` |
| Vente COMPLETED, non facturée | Générer la facture | `POST invoices/from-sale` |
| Facture ISSUED/PARTIALLY_PAID (reste dû > 0) | Encaisser | `POST payments` |
| Facture PAID / doc terminal | (aucun — état final affiché) | — |

La détection « déjà facturée » se fait côté front en croisant `invoices` (champs `saleId`/`deliveryId`) — même logique que l'`InvoiceDialog` actuel.

## 5. Actions en 1 clic

Depuis la fiche concernée, sans repasser par la liste Factures pour choisir une source :
- **Générer la facture** sur une commande livrée ou une vente (préremplit la source, échéance optionnelle via mini-dialog).
- **Encaisser** sur une facture (réutilise `PaymentDialog`, montant ≤ reste dû).

Ces actions sont exposées à la fois par le bouton « étape suivante » de `DocumentFlow` et dans le menu d'actions de la fiche.

## 6. Fiche client = compte courant

La fiche `/commercial/clients/[id]` devient le **hub** du client :
- En-tête : identité, type, statut, encours + barre de crédit (vert→orange→rouge, D26), actions Éditer/Désactiver/**Nouvelle commande**/**Encaisser**.
- **Timeline commerciale** agrégée et triée par date : commandes, ventes, factures, paiements du client (données déjà disponibles via les listes filtrées par `clientId`). Chaque entrée est cliquable vers sa fiche.

## 7. Accueil = worklist (sans KPI)

`/commercial` n'est plus un cockpit de KPI mais une **liste d'actions** :
- **À faire** : *Commandes à livrer* (IN_PROGRESS), *Factures à encaisser* (impayées), regroupées avec compteur et lien.
- **Ils me doivent** : clients à encours > 0, triés décroissant, barre de crédit (liste de relance, pas une statistique).
- Raccourci **Vente rapide** (FAB conservé).
- **Aucune carte KPI** (CA / commandes en cours / impayés total / encours total) — ces chiffres iront sur le dashboard principal (Spec B).

## 8. Épuration des KPI par page

Suppression des bandeaux KPI introduits en B5-6 :
- `ClientsKpis` (clients actifs / encours total / clients à risque) — supprimé de la page Clients.
- KPI « Ventes du jour / Transactions » — supprimés de la page Ventes.
- KPI « impayées / en retard / CA facturé » — supprimés de la page Factures.
- Cartes KPI du cockpit — supprimées (l'accueil devient la worklist du §7).

Les composants KPI désormais inutilisés (`ClientsKpis`, etc.) sont retirés. Les listes deviennent : barre de titre + recherche/onglets + tableau.

## 9. Impression PDF

Bouton **Imprimer / PDF** sur :
- la **facture** (en-tête ferme + client + lignes HT + total + reste dû + statut),
- le **bon de livraison** (en-tête + client + lignes livrées + transporteur, sans montants si souhaité).

Implémentation front-only via une **feuille print CSS dédiée** (route/vue imprimable `@media print`) ou `react-to-print`. Choix de la lib tranché au plan d'implémentation ; pas de dépendance lourde si une vue print CSS suffit.

## 10. Design (frontend-design)

Le skill **frontend-design** guide le visuel à l'implémentation : rendu moderne, intuitif, **mobile-first**, dérivé des tokens existants (`theme/tokens`, doc 10) et des écrans Stitch *Avicare Design System*. Restraint : la signature reste la barre d'encours + le fil conducteur ; pas de réinvention du design system partagé (cohérence avec Élevage/Stocks).

## 11. Contraintes & conventions (inchangées)

- 100% Next.js 16 App Router + MUI v7 + RTK Query ; routes dynamiques `[id]` = server component `await params` → client view.
- Gating front `useCommercialGating` (`module.commercial.basic`) ; le **403 backend reste la garde réelle** (pas de rôle-ferme exposé au front).
- Pas de changement des slices RTK Query existantes (clients/sales/orders/deliveries/invoices/payments) ni de l'API ; on consomme l'existant.
- Conventions repo : commits sans signature, 1 PR = 1 sujet, CI verte avant merge.

## 12. Découpage en livraisons (PRs)

- **R1 — Nav resserrée & épuration** : sidebar 5 entrées, fusion Livraisons→onglet Commandes & Paiements→onglet Factures, redirections des routes supprimées, retrait de tous les bandeaux KPI, suppression des composants KPI inutilisés.
- **R2 — Fil conducteur & actions 1-clic** : composant `DocumentFlow` (provenance + liens + étape suivante) sur les 4 fiches, facturation/encaissement 1 clic, refonte de l'**Accueil** en worklist.
- **R3 — Fiche client compte courant** : timeline agrégée + actions contextuelles.
- **R4 — Impression PDF** : facture + bon de livraison.

Chaque PR : `tsc` + lint + suite vitest + `next build` verts, CI verte avant merge.

## 13. Tests

- Slices RTK Query : tests existants conservés (pas de changement d'endpoints).
- Nouveaux tests composant (Vitest + Testing Library) : logique « étape suivante » de `DocumentFlow` (mapping état → action), agrégation de la timeline client, worklist d'accueil (regroupements/compteurs).
- Garde-fou : `next build` (les routes compilent), suite web complète verte.

## 14. Risques & mitigations

- **Régression sur du code fraîchement mergé** (B5-6) : avancer par PR ciblées, suite de tests web complète à chaque étape.
- **Routes supprimées** (`/livraisons`, `/paiements`) : ajouter des redirections pour ne pas casser d'éventuels liens/bookmarks.
- **Surcharge mobile** du `DocumentFlow` : design compact (chaîne horizontale scrollable + un seul bouton d'action), validé via frontend-design.
- **Glissement de périmètre** vers TVA/remises/avoirs : explicitement hors Spec A ; à rediscuter en backend si besoin.
