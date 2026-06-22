# Dashboard principal cross-module (Spec B — Rill)

**Date** : 2026-06-22
**Statut** : Validé (design) — en attente de relecture spec
**Sprint** : post-B5 (suite différée de la refonte commerciale Spec A) ; préfigure le `reporting` de roadmap §C2
**Périmètre** : Backend (nouveau contexte `reporting`, lecture seule) + Frontend (`web/`, refonte de `/dashboard`) + projet Rill design-time. Modules métier inchangés (consommés via façades).

---

## 1. Contexte & problème

La refonte commerciale (Spec A) a **retiré tous les KPI par page** au profit d'un **tableau de bord principal centralisé** (décision utilisateur : « les vues d'ensemble doivent être sur le tableau de bord principal, pas répétées dans chaque module »). Ce dashboard n'existe pas encore : `/dashboard` est un placeholder (cartes « — » en dur + message de bienvenue + `TrialBanner`).

La vision §19 décrit un **dashboard adaptatif** affichant les KPI de l'activité (taux de ponte, GMQ, mortalité, encours client…) ; la roadmap §C2 prévoit un bounded-context `reporting` + des widgets adaptatifs selon les modules actifs. Spec B matérialise ce dashboard.

## 2. Objectif

Donner à l'éleveur une **vue d'ensemble cross-module, par ferme, mobile-first** : commercial (CA, encours, impayés), élevage (bandes, effectif, mortalité, GMQ, ponte, santé), stocks (stock bas, valeur, consommation). Les widgets s'**adaptent aux modules actifs** de la ferme.

**Non-objectifs (hors Spec B)** :
- Embarquer Rill en runtime (iframe/JWT/RLS) — Rill reste un **outil de modélisation design-time**, la prod sert les chiffres via des endpoints Spring Boot.
- Rollup « toutes mes fermes » consolidé — V1 = **une ferme à la fois** via le sélecteur header existant (le contexte `reporting` rend ce rollup facile à ajouter plus tard).
- Exports PDF/Excel (roadmap §C2 séparé), alerting, drill-down profond.
- Toute modification du modèle métier ou des migrations existantes.

## 3. Décisions d'architecture (validées)

### 3.1 Backend — contexte `reporting` lecture seule
- Nouveau bounded-context `com.avicare.reporting` (lecture seule). `ReportingService` **orchestre** : il appelle `CommercialFacade`, `LivestockFacade`, `InventoryFacade`. **Cross-context via façades uniquement** (règle CLAUDE.md ; commercial & inventory sont des sous-domaines plats de livestock, reporting un contexte qui les compose).
- **Chaque façade gagne des méthodes d'agrégation lecture seule** (ex. `revenueByPeriod(farmId, range)`, `outstandingTotal(farmId)`, `mortalityRate(farmId, range)`, `eggRate(farmId, range)`, `lowStockCount(farmId)`, `stockValue(farmId)`). Implémentées en **requêtes SQL/JPQL agrégées** (`SUM/COUNT/GROUP BY`), **jamais** par chargement de toutes les lignes. `InventoryFacade` est **créée** (n'existe pas encore).
- **Un endpoint composé et gaté** : `GET /farms/{id}/dashboard?period=today|7d|30d|mtd` **ou** `?from=YYYY-MM-DD&to=YYYY-MM-DD`. Le serveur ne renvoie **que** les sections des modules actifs de la ferme (feature-gating existant). **Un seul appel réseau** (mobile-first).

### 3.2 Frontend — refonte de `/dashboard`
- `dashboardApi` (RTK Query) → **1 appel** ; widgets **adaptatifs** rendus selon les sections présentes dans la réponse (jamais en dur).
- Graphiques via **recharts** (déjà installé `^3.8.1` — zéro nouvelle dépendance). Couleurs `@/theme/tokens`, format `@/lib/format`.
- **Sélecteur de période** (presets + plage custom) en tête. **Sélecteur de ferme** = le sélecteur header existant (`setSelectedFarmId`).

### 3.3 Rill — design-time only
- Projet Rill **versionné** dans `analytics/rill/`, connecté au **Postgres de dev**, contenant les *metrics views* de référence des KPI. Usage : `rill start` en local pour **modéliser et valider visuellement** chaque agrégation **avant** de la porter en backend ; sert de **documentation vivante** des définitions de métriques.
- **Pas** déployé, **pas** dans le chemin prod, **pas** un gate CI. Un `analytics/rill/README.md` explique comment le lancer (DSN dev via variable d'env, filtrer sur un `farm_id` d'exemple pour valider).

### 3.4 Multi-tenant
- Aucune nouvelle surface : le farm-scoping JWT + le path `/farms/{id}` restent la garde (403 backend). Le front n'expose pas de rôle-ferme (cohérent avec le reste).

## 4. Modèle de période

- **Presets** : `today`, `7d`, `30d`, `mtd` (month-to-date). Param `?period=`.
- **Plage custom** : `?from=YYYY-MM-DD&to=YYYY-MM-DD` (exclusif avec `period`). Validation : `from ≤ to`, plage raisonnable, dates ISO ; erreur `BusinessRuleException` (422) sinon.
- Les **KPI snapshot** (encours, impayés, stock bas, valeur stock, bandes/effectif) ne dépendent **pas** de la période (état courant) ; les **KPI période** (CA, mortalité, ponte, consommation, séries) la respectent. Le DTO distingue clairement les deux.

## 5. Catalogue des KPI (par section adaptative)

Chaque section n'apparaît que si le module est actif sur la ferme (gating serveur).

### 5.1 Commercial (V20–V23)
- **CA** = Σ `sales.totalXof` sur la période + **série temporelle** (par jour).
- **Encours total** (snapshot) = Σ (facturé − payé) des factures non annulées.
- **Impayés en retard** (snapshot) = Σ outstanding des factures *overdue*.
- **Top 5 clients** par CA (période) · **Top 5 débiteurs** par encours (snapshot).
- **Compteurs worklist** (snapshot) : commandes *à livrer*, factures *à encaisser*.

### 5.2 Élevage (V5–V9, V14) — widgets conditionnels selon l'espèce présente
- **Bandes actives** (count) · **Effectif vivant total** (Σ `current_count`).
- **Mortalité période** : nombre + **taux** (morts / effectif initial) + série.
- **GMQ** (chair) = Δ `avg_weight_g` / jours, depuis les pesées (V7).
- **Taux de ponte** (pondeuses) = œufs collectés / effectif (V9) + série.
- **Santé** (si module actif) : vaccinations/traitements sur la période (V14).

### 5.3 Stocks (V15–V19)
- **Articles en stock bas** (count, seuils d'alerte B4-2).
- **Valeur du stock** = Σ `current_quantity × coût unitaire`. *Coût unitaire = dernier prix d'achat connu ; PMP (coût moyen pondéré) possible plus tard — choix figé au plan.*
- **Consommation période** (Σ mouvements OUT) + **top articles consommés**.

### 5.4 Présentation (frontend)
- En haut : rangée de **cartes-chiffres** (KPI scalaires).
- En dessous : **graphiques** recharts (séries CA / ponte / mortalité / consommation).
- Puis : **tops** (listes cliquables vers la fiche concernée quand pertinent).
- Tout dérivé d'un seul `DashboardResponse` ; états loading (skeletons) et empty (module actif sans données) gérés.

## 6. Contrat d'API (esquisse)

`GET /farms/{id}/dashboard?period=30d` →
```jsonc
{
  "period": { "kind": "preset", "value": "30d", "from": "...", "to": "..." },
  "commercial": {            // présent seulement si module.commercial actif
    "revenueXof": 0, "revenueSeries": [{ "date": "...", "valueXof": 0 }],
    "outstandingXof": 0, "overdueXof": 0,
    "topClients": [{ "clientId": 0, "name": "", "valueXof": 0 }],
    "topDebtors": [{ "clientId": 0, "name": "", "outstandingXof": 0 }],
    "ordersToDeliver": 0, "invoicesToCollect": 0
  },
  "livestock": { /* présent si module élevage actif ; champs conditionnels par espèce */ },
  "inventory": { /* présent si module inventory actif */ }
}
```
Sections absentes = module inactif. Montants `XOF` entiers (HT, cohérent D25). Dates ISO.

## 7. Découpage en livraisons (PRs) — 1 PR = 1 phase

- **Phase 0 — Socle** : projet Rill `analytics/rill/` (connecteur + metrics views de référence) **+** contexte `reporting` scaffold (`ReportingService`, DTO `DashboardResponse`, parsing période presets+custom, contrôleur gaté renvoyant les sections actives — vides au départ) **+** shell frontend `/dashboard` (`dashboardApi`, sélecteur période presets+custom, conteneur adaptatif, loading/empty). *Livrable : dashboard affiche le shell + sélecteur ; endpoint renvoie des sections gatées vides.*
- **Phase 1 — Commercial** : méthodes stats `CommercialFacade` + section commerciale + widgets (cartes + CA série + tops + compteurs). **Ferme la boucle Spec A.**
- **Phase 2 — Élevage** : méthodes stats `LivestockFacade` (bandes, effectif, mortalité, GMQ, ponte, santé) + section + widgets conditionnels par espèce.
- **Phase 3 — Stocks** : création `InventoryFacade` + stats (stock bas, valeur, consommation) + section + widgets.

Chaque PR : `mvn verify` backend vert + `tsc`/lint/vitest/`next build` web verts + CI verte avant merge.

## 8. Tests

- **Backend** : tests unitaires par agrégation (KPI période borné + KPI snapshot), parsing période (presets, from/to, validations 422), **gating** (module inactif → section absente du DTO). Slices `@DataJpaTest`/Testcontainers pour les requêtes agrégées.
- **Frontend** : `dashboardApi` (slice) ; **rendu adaptatif** (section affichée/masquée selon la réponse) ; logique du sélecteur de période (presets + custom) ; helpers de mise en forme des séries en TDD.
- **Rill** : non testé unitairement (artefact de design), validé visuellement.

## 9. Contraintes & conventions (inchangées)

- Backend : `@Service` + `@RequiredArgsConstructor`, DTO records Java 21, `@Transactional(readOnly = true)`, exceptions `BusinessException`, messages techniques en anglais. Pas de cross-import (façades). Aucune valeur métier en dur (paramètres). Aucune migration existante modifiée (Spec B n'ajoute en principe **aucune** table — agrégations sur l'existant ; si une vue s'avérait nécessaire, nouvelle migration Flyway versionnée).
- Frontend : Next.js 16 App Router + MUI v7 + RTK Query ; gating `useActiveModules`/feature-gating ; pas de rôle-ferme exposé (403 backend = garde réelle).
- Commits sans signature ; 1 PR = 1 sujet ; CI verte avant merge.

## 10. Risques & mitigations

- **Agrégations coûteuses** → requêtes `GROUP BY` + index sur `farm_id`/dates déjà présents ; mesurer, ajouter un index ciblé si besoin (migration dédiée).
- **Données clairsemées** (peu de pesées/collectes) → widgets élevage en état *empty* explicite plutôt que valeurs trompeuses ; ne jamais diviser par zéro (taux = null si effectif 0).
- **Rill devient du poids mort** → cadré design-time + doc vivante ; README + non déployé ; revu en fin de Spec B.
- **Coût unitaire stock ambigu** (dernier prix vs PMP) → V1 = dernier prix d'achat, figé au plan, documenté.
- **Glissement de périmètre** vers rollup multi-ferme / exports → explicitement hors Spec B.
