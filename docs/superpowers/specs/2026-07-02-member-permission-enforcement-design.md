# Application des permissions membre (menu + lectures back + dashboard)

**Date** : 2026-07-02
**Statut** : Validé (design) — en attente de relecture spec
**Périmètre** : Backend (`livestock` contrôleurs d'accès + `reporting` dashboard + `parameters`) + Frontend (`web/` sidebar, dashboard, plomberie permissions). **Aucune migration.**
**Contexte** : correctif RBAC révélé après le Sous-projet A ([[member_access_customization_done]]). Un membre **FARMER** voit tous les modules du menu et peut lire tous les modules côté back, car le menu est gardé par l'abonnement de la ferme (pas par les permissions du membre) et les lectures back par `hasAccess` (n'importe quel membre).

> Sous-projet **A-bis**. Suit le Sous-projet A (provisioning + édition membres, PR #113 mergée). Le Sous-projet B (réglages catalogue) reste après.

---

## 1. Problème & diagnostic (établi par débogage systématique)

- **Front** : `web/src/components/layout/Sidebar.tsx` filtre les groupes/feuilles **uniquement** par `isModuleActive(requiredModule)` = modules souscrits de la ferme (`useActiveModules` → `subscriptionApi`). Il ne consulte **jamais** le rôle ni les permissions de l'utilisateur. `authSlice` ne stocke que les tokens + `currentUser` ; le JWT (qui porte pourtant `memberships` role+permissions) n'est jamais décodé côté client.
- **Back** : les lectures des modules sont gardées par `@farmAccess.hasAccess(#farmId)` (membre, n'importe quel rôle) + `@features.isEnabled` (abonnement). Les permissions granulaires (`inventory:read`, `commercial:read`, …) stockées par membre **ne sont pas consultées**. `FarmAccessChecker.hasPermission` existe (gère les wildcards `*` / `resource:*`, bypass ADMIN) mais n'est utilisé que dans l'exemple/test poultry.

**Conséquence** : un FARMER (défauts `poultry:*`/`health:*` seulement) voit et lit Stocks, Commercial, etc.

## 2. Décisions verrouillées (via questions de cadrage)

- **Portée** : menu (front) **ET** back (lectures) **ET** dashboard.
- **Enforcement back** : **lectures** → `hasPermission('resource:read')` ; **écritures inchangées** (les paliers de rôle actuels — `hasRole(OWNER/MANAGER[/FARMER])` — encodent une distinction *terrain vs superviseur* que le catalogue de permissions n'a pas ; on ne la casse pas).
- **Source des permissions côté front** : décodage du JWT d'accès déjà en main (il porte `memberships`). Pas de nouvel endpoint. La fenêtre de péremption (permissions changées par un admin mais token pas encore rafraîchi) est bornée par la rotation refresh (A3) ; le **back reste la vraie autorité** (toujours à jour).
- **Compte de test de la capture** = membre FARMER (confirmé) → c'est un vrai bug, pas un OWNER.

## 3. Mapping permission → surface

| Surface (menu + endpoints de lecture) | Permission requise |
|---|---|
| Élevage › Poulets de chair, Œufs | `poultry:read` |
| Élevage › Sanitaire | `health:read` |
| Stocks (tous les sous-menus + lectures) | `inventory:read` |
| Commercial (tous les sous-menus + lectures) | `commercial:read` |
| Réglages (paramètres **ferme**) | `settings:read` |
| Dashboard — section Élevage | `poultry:read` |
| Dashboard — section Commercial/Finance (CA, impayés, top clients/débiteurs) | `commercial:read` **OU** `finance:read` |

Défauts rôles (rappel, `FarmRole.defaultPermissions()`) : OWNER `["*"]` · MANAGER `poultry/health/commercial/inventory:*` + `finance/settings:read` · FARMER `poultry:read/write` + `health:read/write` · VETERINARIAN `health:read/write` + `poultry:read` · BUYER `commercial:read` + `finance:read`.

Effet attendu (membre non-OWNER) :
- **FARMER** : Élevage (Poulets, Œufs, Sanitaire) + dashboard Élevage. **Pas** de Stocks, Commercial, Réglages, ni cartes Commercial du dashboard.
- **VETERINARIAN** : Élevage (Sanitaire + lecture Poulets/Œufs). Pas de Stocks/Commercial/Réglages.
- **BUYER** : Commercial + dashboard Commercial/Finance. Pas d'Élevage/Stocks/Réglages.
- **OWNER** (`*`) : tout, comme aujourd'hui.

Notes :
- **Réglages** = paramètres au niveau ferme (5 catégories, `reglages/page.tsx`). Les réglages **compte/profil** vivent dans le menu avatar du `Header` et **ne sont pas gardés** (tout utilisateur y accède).
- L'abonnement reste un **ET** avec la permission : un module non souscrit reste masqué même avec la permission (comportement actuel conservé).

## 4. Back — enforcement des lectures

Convertir les constantes `READ` (aujourd'hui `@farmAccess.hasAccess(#farmId) and <FEATURE>`) en `@farmAccess.hasPermission(#farmId, '<resource>:read') and <FEATURE>` :

- `PoultryBatchController.READ` et `LayerAccess.READ` → `poultry:read`
- `HealthAccess.READ_BASIC` et `HealthAccess.READ_ADVANCED` → `health:read`
- `InventoryAccess.READ` → `inventory:read`
- `CommercialAccess.READ` → `commercial:read`
- Paramètres **ferme** (lecture) → `settings:read` (les endpoints `/farms/{id}/settings`, `/catalog/...`, price-lists, thresholds en **lecture** ; l'écriture garde son gating actuel).

Les constantes `WRITE_*` restent **inchangées**.

**Dashboard** (`reporting/controller/DashboardController` — aujourd'hui `@farmAccess.hasAccess`) :
- L'endpoint reste accessible à tout membre (`hasAccess`) : le tableau de bord est une vue transverse, on ne veut pas un 403 global.
- Le **service d'agrégation** construit conditionnellement les sections selon le principal courant :
  - section `commercial` incluse seulement si `commercial:read` **ou** `finance:read` (via `FarmAccessChecker.hasAnyPermission`) ;
  - section `livestock` incluse seulement si `poultry:read`.
- Une section omise → `null` dans `DashboardResponse` (le front sait déjà gérer les sections absentes : `dashboardData?.commercial` etc.).

## 5. Front — plomberie permissions + gating

**Plomberie (nouveau)** :
- Décoder le JWT d'accès en `memberships` (`{ farmId, role, permissions }[]`). Sélecteur `selectMemberships(state)` (depuis `authSlice.accessToken`), et hook `useFarmPermissions(farmId)` → `{ can(permission: string): boolean }`.
- `can` gère les wildcards : `*` (tout), `resource:*`, et l'exact `resource:verb`. Util pur réutilisable `memberHasPermission(perms: string[], target: string): boolean` (testable en isolation). OWNER porte `["*"]` → `can` toujours vrai.

**Sidebar** :
- Ajouter un champ optionnel `requiredPermission?: string` (et/ou `requiredPermissionAny?: string[]`) aux `Leaf`/`Group` du `NAV`.
- Visibilité d'une feuille/groupe = **abonnement (existant) ET** (`!requiredPermission || can(requiredPermission)`), en plus des règles focus actuelles.
- Comportement inchangé pour OWNER et pour l'état « aucun module » (CTA d'activation).

**Dashboard** :
- Masquer la section Commercial si `!can('commercial:read') && !can('finance:read')`, la section Élevage si `!can('poultry:read')` (défense en profondeur : le back les omet déjà, le front ne les rend pas).

## 6. Gestion d'erreurs & états

- Front : si le JWT est absent/non décodable → `can` renvoie `false` (fail-closed) ; le squelette de chargement du sidebar reste inchangé.
- Un membre qui atteint une route non autorisée par URL directe : le back renvoie **403** sur les lectures (nouvelle garde) ; le front peut afficher l'état d'erreur existant (pas de nouvelle page 403 dédiée en V1).
- Back : `hasPermission` est déjà fail-closed (principal absent → refus).

## 7. Blast radius & tests

**Backend** :
- **ITs impactés** : tout test où un membre **FARMER** (ou sans la permission de lecture) fait un **GET** sur un module qu'il ne possède pas passera de 200 → 403. À auditer et ajuster :
  - Commerciaux (`ClientOrderApiIT`, `SaleDeliveryApiIT`, `InvoicePaymentApiIT`) : le FARMER y teste des **écritures** (création de commande = write terrain, inchangé) — vérifier qu'aucune **lecture** commerciale n'est faite en tant que FARMER ; sinon utiliser l'OWNER pour les lectures ou accorder `commercial:read` au membre de test.
  - Idem inventory/health/poultry/layer flows.
- **Nouveaux tests** : `FarmAccessCheckerTest` couvre déjà `hasPermission` (wildcards). Ajouter un IT ciblé « FARMER lit Stocks/Commercial → 403 » et « OWNER lit → 200 ». Test du service dashboard : sections omises selon permissions.

**Frontend (Vitest)** :
- `memberHasPermission` (exact, `resource:*`, `*`, absent).
- `useFarmPermissions` (décodage JWT, ferme sans membership → tout refusé).
- `Sidebar` par rôle : FARMER ne voit pas Stocks/Commercial/Réglages ; OWNER voit tout ; module non souscrit reste masqué même avec permission.
- Dashboard : sections masquées selon `can`.

**Garde-fou** : backend `mvn verify` + `spotless:apply -pl avicare-app` ; web `tsc/lint/vitest/next build`. `*IT` Testcontainers = CI seulement (Docker local KO).

## 8. Risques & mitigations

- **Péremption du JWT** (permissions changées, token pas rafraîchi) : le menu peut être en retard d'une session ; le back (autorité) est à jour. Acceptable, documenté (idem mémo A3). Amélioration V2 : forcer un refresh après édition d'un membre.
- **Blast radius ITs** : principal poste de travail ; l'audit des lectures FARMER doit être exhaustif avant merge (CI verte = ITs passent).
- **Incohérence lecture/écriture** (un FARMER pourrait faire une écriture terrain d'un module qu'il ne peut pas lire) : conséquence assumée du choix « écritures inchangées » ; en pratique les écritures FARMER concernent poultry/health qu'il peut lire. Documenté comme non-objectif.
- **Dashboard** : le service doit lire le principal courant — vérifier qu'il a accès au `SecurityContext`/`FarmAccessChecker` (injecté) sans casser les tests DB-less.
