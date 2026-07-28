# Retrait de la gestion d'abonnement (pilote gratuit, tout allumé) — Design

**Date :** 2026-07-14
**Contexte :** Décision GTM. Jawdi n'a pas encore de fermes en production ; la priorité est
l'adoption et la preuve de ROI, pas la monétisation. Le modèle « modules vendus à la carte » en
self-serve (doc 00 §7, D13-D16) ajoute de la friction inadaptée à la réalité ouest-africaine
(mobile money, pas de carte ; trésorerie en dents de scie ; distribution par canaux). On **retire la
gestion d'abonnement de l'expérience** et on passe le pilote en **gratuit, tous modules actifs**, en
**gardant le mécanisme de gating dormant** pour une monétisation future.

## Décisions verrouillées (brainstorming)

- **GTM** : pilote **gratuit** ; thèse de monétisation **B2B2C canal** (coopérative / provendier /
  couvoir paie pour son réseau) en primaire, **mobile money par cycle** en secondaire — **différée**,
  hors code pour l'instant.
- **Couche 1 (management self-serve)** : **retirée** de l'app (éleveur + admin).
- **Couche 2 (feature gating `@features`, ~53 points)** : **conservée**, mais chaque ferme naît avec
  **tous les modules V1 actifs** → tout est visible/accessible. Réactivable pour la monétisation.
- **Approche « provisioning complet »** (retenue vs basculer `gating-enabled=false` en prod) : les
  lignes `subscription_modules` existent vraiment, donc le gate passe honnêtement, la sidebar (qui lit
  les vraies données) montre tout, et on **ne touche pas** au garde-fou prod ADR-004 ni à la
  sémantique du gate. Le levier de monétisation = **re-restreindre le provisioning + réactiver le
  self-serve**.
- Pas de suppression physique de la table `subscription_modules` / du contexte `subscription` (gardé
  dormant). Pas d'intégration paiement. Pas de rip du gating des 53 endpoints.

## Architecture existante (réutilisée)

- **Gating** : `FeatureChecker.isEnabled(farmId, moduleKey)` (bean `@features`) → bypass si
  `avicare.features.gating-enabled=false` (ADR-004, dev-only, garde-fou prod) ; sinon bypass admin ;
  sinon `subscriptionFacade.isModuleEnabled` (présence d'une ligne `subscription_modules` non
  expirée). **On garde tout ça inchangé.**
- **`SubscriptionService`** : `getOrCreate(farmId)` (crée un abonnement TRIAL vide),
  `applyPlan(farmId, planKey)` (réconcilie les modules à un bundle — appelé par le signup),
  `enableModule/disableModule/isModuleEnabled/listModules/listPlans`.
- **Catalogue modules** : `catalog_items` catégorie `modules`, value JSONB `{label, scope, wave}` ;
  `wave` marque la disponibilité (D13). 16 modules déclarés (V1→V3).
- **Frontend** : `useActiveModules` lit `GET /subscription` → `computeActiveModules` (modules HARD non
  expirés) → pilote la sidebar et les hooks `useHealthGating`/`useInventoryGating`. Signup appelle
  `applyPlan` après `createFarm`.

## Backend

### `SubscriptionService.getOrCreate` — provisioning complet à la création

Quand `getOrCreate` **crée** un nouvel abonnement (pas quand il en trouve un existant), activer
immédiatement **tous les modules disponibles en vague V1** via `enableModule(..., HARD, null)`.
- La liste V1 est dérivée du **catalogue** : lire `parametersFacade.listPlatform("modules")` (ou le
  service catalog interne) et filtrer les entrées dont `value.wave == "V1"` (12 modules : broiler,
  layer, health.basic, health.advanced, commercial.basic, commercial.advanced, inventory, finance,
  kpi.advanced, buyer_portal, qr_codes, api_access — exclut `smallruminants.*`/`cattle.*` en V2/V3).
  Pas de liste codée en dur qui dériverait du catalogue.
- Idempotent : sur un abonnement existant, aucun changement (le provisioning ne se fait qu'à la
  création). Le write-on-read existe déjà (`getOrCreate` crée l'abonnement au premier GET).

> Effet : toute ferme, quelle que soit sa voie de création, a tous les modules V1 dès le premier
> accès à `GET /subscription`. Plus besoin que le frontend appelle `applyPlan`.

### Endpoints backend — approche **lean** (aucun retrait)

Décision de périmètre (brainstorming) : on **ne supprime aucun endpoint/service backend**. La couche
self-serve backend (`SubscriptionController.applyPlan`, `SubscriptionPlanController`,
`ChangeRequestController`, `AdminChangeRequestController`, `ChangeRequestService`, `applyPlan`/
`listPlans`) **reste dormante** — injoignable depuis l'expérience éleveur une fois le frontend retiré,
et **cohérente avec la décision « garder le mécanisme pour la monétisation future »**. Motif : ces
endpoints sont activés au setup par ~12 ITs (vérifiables **CI-only**, Docker local KO) ; les retirer
imposerait un recâblage fragile pour un simple gain de propreté, sans valeur pilote.

- **Seul changement backend = le provisioning complet dans `getOrCreate`** (ci-dessus).
- Les ITs qui appellent `applyPlan`/`enableModule` au setup **continuent de fonctionner** (activer un
  module déjà actif est idempotent) — aucun recâblage requis.
- `SubscriptionController` GET `/subscription` + GET/POST/DELETE `/subscription/modules` restent (le
  GET est lu par `useActiveModules`). `FeatureChecker`/gating/garde-fou ADR-004 inchangés.

## Frontend

**Supprimer :**
- La route/page `/abonnement` (+ l'entrée nav `Header`/`Sidebar`, déjà `enabled:false`).
- `FarmSubscriptionTab` (+ l'onglet « subscription » de la fiche ferme `/fermes/{id}`).
- `TrialBanner` (+ son montage dans le dashboard/layout).
- L'**étape de choix de plan** du wizard signup : le signup crée la ferme et redirige, **sans**
  `applyPlan` ni sélection de bundle. `bundles.ts` (labels/prix marketing) et les mutations de
  management de `subscriptionApi` (`useApplyPlanMutation`, `useGetPlansQuery`) sont retirées.

**Garder :**
- `useActiveModules` + `useGetSubscriptionQuery` (le GET `/subscription`) — désormais tous modules
  actifs → sidebar/gating montrent tout. `computeActiveModules` inchangé.
- Les hooks de gating (`useHealthGating`, `useInventoryGating`) inchangés.

## Documentation (obligatoire — inversion de décisions verrouillées)

- **Nouvel ADR** (`docs/decisions/009-remove-self-serve-subscription.md`) : acte le pivot — retrait du
  self-serve d'abonnement, pilote gratuit tous modules, gating conservé dormant, thèse de monétisation
  **B2B2C canal (différée)**. Marque le volet « friction » d'**ADR-004 superseded** (le provisioning
  complet remplace le bypass dev pour l'usage courant ; le flag/garde-fou restent pour dev).
- **`docs/00-vision-strategique.md` §7** (« Modèle commercial ») + le tableau des décisions (D13-D16) :
  note d'amendement pointant l'ADR, sans réécrire l'historique.

## Tests

- **Backend** :
  - `SubscriptionService.getOrCreate` : une **nouvelle** ferme obtient tous les modules V1 actifs
    (12) ; un abonnement **existant** n'est **pas** re-provisionné (idempotence).
  - `isModuleEnabled` renvoie true pour chaque module V1 d'une ferme neuve.
  - Approche lean → **aucun IT à recâbler/supprimer** (les endpoints restent). Vérifier que les ITs
    existants passent toujours en CI (le provisioning n'active que des modules ; les activations de
    setup deviennent redondantes mais idempotentes).
- **Frontend** :
  - `signup` : ne choisit plus de plan, crée la ferme et poursuit (adapter/retirer l'assertion de
    l'étape 2).
  - Retirer `FarmSubscriptionTab.test`, `TrialBanner.test`, `subscriptionApi.test` (volet management).
  - La sidebar montre les entrées modules pour une ferme neuve (gating hooks voient tout).

## Hors périmètre (V1 pilote)

- Intégration mobile money / facturation (thèse B2B2C, différée).
- Suppression physique du contexte `subscription` / table `subscription_modules`.
- Retrait du gating `@features` des endpoints.
- Portail / contractualisation partenaire canal (futur).

## Contraintes globales

- Aucune signature Claude/AI dans les commits ; Conventional Commits, scope bounded-context
  (`feat(subscription)` / `refactor(subscription)`, `feat(web)`, `docs`).
- Branch protection → PR + `gh pr merge --rebase --delete-branch`.
- **Migrations immuables** : ne pas modifier/supprimer une migration mergée ; la table
  change-requests reste (dormante).
- RBAC/tenancy (`@farmAccess`, memberships JWT) **inchangés** — c'est de la sécurité réelle, hors
  périmètre du gating.
- Le garde-fou prod ADR-004 (`FeatureGatingGuard`) **reste** : on ne désactive pas le gating en prod,
  on le laisse enforced avec des fermes complètes.
- Spotless Google Java Format avant commit backend ; `*IT` Testcontainers = CI only.
- MUI **v9** ; « This is NOT the Next.js you know ».
