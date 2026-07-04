# Module finance (Sprint B6) — dépenses, analytique par lot, salaires & avances

**Date** : 2026-07-04
**Statut** : Validé (design) — en attente de relecture spec
**Périmètre** : Backend (nouveau bounded context racine `com.avicare.finance` + points d'accroche `livestock.inventory`/`livestock.commercial`/`tenancy`) + Frontend (`web/`). Migrations **V25** (P1) et **V26** (P2).
**Contexte** : Sprint B6 du roadmap (`docs/01-roadmap-v1.md` §4). Dernier sprint backend métier avant le mobile (B7).

> Deux PRs : **P1** dépenses + analytique par lot (V25), **P2** salaires + avances (V26). Une seule spec.

---

## 1. Problème & objectif

L'éleveur encaisse (commercial, livré B5) mais ne trace pas ce qu'il **dépense** : pas de registre de dépenses, pas de coût par lot, pas de marge, pas de paie. Objectif B6 :

1. **Dépenses** : registre farm-scoped, catégorisé (catalogue `expense_categories`, éditable par l'éleveur via le gestionnaire de catalogue PR #115), avec tag lot optionnel — alimenté **manuellement ET automatiquement** par les achats de stock.
2. **Analytique par lot** : coût total + ventilation par catégorie + coût/tête + revenus (dérivés des ventes V24) + marge.
3. **Salaires & avances** : salaire mensuel par membre, génération mensuelle, marquage payé ; avances demandées in-app par le membre, approuvées par OWNER/MANAGER, déduites du prochain salaire.

## 2. Décisions verrouillées (cadrage utilisateur)

- **Employé = membre de la ferme** (`user_farms`) — le provisioning de comptes (PR #113) donne déjà nom + téléphone à chaque fermier. Pas de table employés en doublon.
- **Coût par lot = dépenses taguées** sur le lot (pas de valorisation automatique des consommations : les mouvements de stock n'ont pas de prix, les actes sanitaires pas de coût — vérifié). **ET** : « tout ce qui est entrées ou ajustements doit être pris comme une dépense » → les entrées de stock alimentent le registre (cf. §4, sources `PURCHASE`/`STOCK_ENTRY`).
- **2 PRs** : P1 dépenses+analytique, P2 salaires+avances.
- **Architecture** : `finance` = **bounded context racine** `com.avicare.finance` (comme `reporting`), PAS un sous-domaine livestock (les salaires n'ont rien d'avicole). Référencement par ID, communication par facades uniquement.

## 3. Faits d'ancrage (vérifiés dans le code)

- Prochaine migration : **V25** (V24 = commercial production source).
- `module.finance` déjà seedé (V4) ; `finance:read`/`finance:write` déjà dans `PermissionConstants` (MANAGER et BUYER ont `finance:read` par défaut).
- `expense_categories` : 7 catégories seedées (`feed, veterinary, staff, energy, equipment, transport, other`), gérables par ferme via `/reglages/comptabilite`.
- `PurchaseOrderItem` porte `unitPriceXof` + `lineTotalXof` → la réception d'un bon est valorisable.
- `StockItem` porte `typicalUnitPriceXof` → pré-remplissage du coût d'une entrée manuelle.
- `SaleItem` porte `productionUnitId` + `lineTotalXof` (V24) → revenu par lot dérivable.
- `TenancyFacade` n'expose que `getAccessibleFarmIds` → **ajouter** `listMembers(farmId)` (P2).
- `CommercialFacade` n'expose pas le revenu par lot → **ajouter** une méthode (P1).

## 4. P1 — Dépenses (migration V25)

### Table `expenses`

```sql
CREATE TABLE expenses (
  id BIGSERIAL PRIMARY KEY,
  farm_id BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  category_key VARCHAR(100) NOT NULL,          -- clé du catalogue expense_categories
  amount_xof BIGINT NOT NULL CHECK (amount_xof > 0),
  expense_date DATE NOT NULL,
  label VARCHAR(200) NOT NULL,
  notes TEXT,
  production_unit_id BIGINT REFERENCES production_units(id),   -- tag lot optionnel
  source VARCHAR(20) NOT NULL CHECK (source IN ('MANUAL','PURCHASE','STOCK_ENTRY','SALARY')),
  purchase_order_id BIGINT REFERENCES purchase_orders(id),
  stock_movement_id BIGINT REFERENCES stock_movements(id),
  salary_id BIGINT,                            -- FK ajoutée en V26 (table pas encore créée)
  created_by BIGINT NOT NULL REFERENCES users(id),
  created_at/updated_at TIMESTAMP (trigger), deleted_at TIMESTAMP NULL
);
-- index: farm_id+expense_date, production_unit_id, partiels WHERE deleted_at IS NULL
```

### Les 3 sources de dépense

| Source | Déclencheur | Montant | Catégorie | Lot |
|---|---|---|---|---|
| `MANUAL` | Formulaire Dépenses | saisi | choisie (catalogue) | optionnel |
| `PURCHASE` | **Réception d'un bon de commande** (`PurchaseOrderService.receive`) | Σ `lineTotalXof` des lignes reçues, **groupées par catégorie d'article** | mapping article→dépense : aliment→`feed`, traitement/médicament→`veterinary`, sinon→`other` | non (achat = niveau ferme) |
| `STOCK_ENTRY` | Entrée manuelle / ajustement **positif** de stock avec le champ optionnel « Montant dépensé (XOF) » rempli (pré-rempli `typicalUnitPriceXof × quantité`) | saisi | mapping article→dépense (idem) | non |

- Accroche `PURCHASE` : `PurchaseOrderService.receive` appelle `FinanceFacade.recordPurchaseExpenses(farmId, purchaseOrderId, lignes reçues)` **dans la même transaction** (précédent : commercial→livestock `consumeProduction`). L'annulation d'un bon RECEIVED n'existe pas en V1 (workflow B4-3) → pas de reverse à gérer.
- Accroche `STOCK_ENTRY` : le DTO du mouvement manuel gagne un champ optionnel `spentAmountXof` ; si présent et mouvement IN/ajustement positif → `FinanceFacade.recordStockEntryExpense(...)` même transaction. Aucun changement de schéma sur `stock_movements`.
- **Anti-double-compte** : dépenses auto badgées par source dans l'UI (« Achat », « Entrée stock ») et **non modifiables/supprimables** par le formulaire (leur vérité vient du flux source) ; le formulaire manuel affiche un rappel « Les achats de stock sont enregistrés automatiquement ».
- CRUD manuel : create/update/soft-delete réservés aux dépenses `MANUAL`. Update/delete d'une dépense auto → 422 `EXPENSE_NOT_EDITABLE`.

### Endpoints P1 (préfixe `/api/v1/farms/{farmId}/finance`)

- `GET /expenses?from&to&category&unitId` — liste filtrée. Lecture : `finance:read` + `module.finance`.
- `POST /expenses`, `PUT /expenses/{id}`, `DELETE /expenses/{id}` (soft) — OWNER/MANAGER + module.
- `GET /units/{unitId}/analytics` → `{ costs: [{categoryKey, label, amountXof}], totalCostXof, costPerHeadXof, revenueXof, marginXof }`. Lecture : `finance:read` + module.
  - `costPerHeadXof = totalCost ÷ effectif initial` du lot (arrondi), null si effectif 0.
  - `revenueXof` = Σ `sale_items.lineTotalXof` du lot via **nouvelle méthode** `CommercialFacade.revenueByProductionUnit(farmId, unitId)` (ventes non annulées).
- `GET /summary?from&to` → totaux dépenses par catégorie sur la période (pour la page Dépenses).

## 5. P2 — Salaires & avances (migration V26)

### Tables

```sql
salary_settings ( id, farm_id, user_id, monthly_salary_xof BIGINT >0, active BOOLEAN,
                  UNIQUE(farm_id, user_id), audit trigger )
salaries ( id, farm_id, user_id, period CHAR(7) 'YYYY-MM', gross_xof, advance_deducted_xof,
           net_xof, status CHECK (DUE|PAID), paid_at TIMESTAMP NULL,
           UNIQUE(farm_id, user_id, period), audit )
salary_advances ( id, farm_id, user_id, amount_xof >0, reason VARCHAR(200),
                  status CHECK (PENDING|APPROVED|REJECTED), requested_at, decided_by BIGINT NULL,
                  decided_at TIMESTAMP NULL, remaining_xof BIGINT NOT NULL, audit )
-- V26 ajoute aussi la FK expenses.salary_id → salaries(id)
```

### Flux

- **Réglage salaire** : OWNER/MANAGER fixe `monthly_salary_xof` par membre (liste des membres via **nouvelle méthode** `TenancyFacade.listMembers(farmId)` → `{userId, fullName, role, active}`).
- **Génération mensuelle** (`POST /salaries/generate {period}`) : une ligne `DUE` par réglage actif ; `advance_deducted = min(Σ remaining des avances APPROVED, gross)` ; les `remaining_xof` des avances sont décrémentés (plus anciennes d'abord) ; `net = gross − deducted`. Idempotent par `UNIQUE(farm, user, period)` (regénérer → 409 `SALARY_PERIOD_EXISTS`).
- **Marquer payé** (`POST /salaries/{id}/pay`) : status `PAID` + **crée une dépense** `source=SALARY`, catégorie `staff`, montant **net**, `salary_id` renseigné, même transaction.
- **Avances** :
  - `POST /api/v1/my/advances {farmId, amountXof, reason}` — **self-service**, gated `@farmAccess.hasAccess(#farmId)` (un FARMER n'a pas `finance:read` ; l'UI vit dans le menu compte « Mes avances », pas dans le module Finance). `GET /api/v1/my/advances?farmId` idem.
  - `POST /farms/{farmId}/finance/advances/{id}/approve|reject` — OWNER/MANAGER. À l'**approbation** (= versement V1) : `remaining_xof = amount_xof` + **dépense** `staff` du montant versé (`source=SALARY`, note « Avance »). Comptabilité juste : avance 30 000 versée + salaire net 90 000 payé = 120 000 au total, pas de double compte.
  - `GET /farms/{farmId}/finance/advances?status` — OWNER/MANAGER (finance:read + rôle pour la liste complète).

## 6. RBAC & gating (pattern maison, cf. A-bis)

- Lectures module Finance : `@farmAccess.hasPermission(#farmId,'finance:read') and @features.isEnabled(#farmId,'module.finance')`.
- Écritures (dépenses, réglages salaires, génération, paiement, décision avance) : `hasRole(OWNER, MANAGER)` + module.
- Self-service avances : `hasAccess` + **self-only** (le `user_id` vient du principal, jamais du body).
- Sidebar : groupe **Finance** — `requiredModule: "module.finance"`, `requiredPermission: "finance:read"` → Dépenses, Analytique lots, Salaires & avances. « Mes avances » dans le menu avatar (tout membre).
- Les auto-dépenses créées par la réception d'un bon s'exécutent sous l'identité de l'appelant inventory (OWNER/MANAGER déjà requis pour recevoir un bon) — pas de gating supplémentaire dans la facade.

## 7. Frontend

- **P1** : page `/finance/depenses` (tableau filtré : période, catégorie, lot, badge source ; formulaire dépense manuelle : catégorie depuis `useGetCatalogQuery(expense_categories)` — réutilise `catalogApi` PR #115 ; montant ; date ; lot optionnel depuis les unités) ; page `/finance/analytique` (sélecteur de lot → KPI coût/revenu/marge + tableau par catégorie). Champ « Montant dépensé » ajouté au dialog de mouvement de stock existant (pré-rempli, optionnel).
- **P2** : page `/finance/salaires` (réglages par membre, génération du mois, liste avec statut/marquer payé ; onglet Avances : liste PENDING avec approuver/rejeter) ; « Mes avances » (menu avatar) : formulaire demande + historique self.
- Slices RTK : `financeApi` (expenses/analytics/summary P1 ; salaries/advances P2). Tags : `Expense`, `Salary`, `Advance` (à ajouter aux tagTypes).

## 8. Non-objectifs

Vues impayés/encours (déjà couvertes : page Factures, fiche client compte-courant, dashboard) · valorisation automatique des consommations de stock (pas de prix sur les mouvements — V2) · comptabilité en partie double / plan comptable · paiement partiel d'un salaire · reverse d'une auto-dépense d'achat (pas d'annulation de bon RECEIVED en V1) · devise autre que XOF · widgets dashboard finance (V2, avec Spec B).

## 9. Tests

- **Backend unit** : mapping catégorie article→dépense (fallback `other`) ; déduction d'avances (partielle, report du reliquat, plus anciennes d'abord) ; garde `EXPENSE_NOT_EDITABLE` ; idempotence génération (409).
- **Backend IT (Testcontainers, CI)** : dépense manuelle taguée lot → analytics l'agrège par catégorie ; réception d'un bon → dépenses `PURCHASE` groupées par catégorie, montants = Σ lignes ; mouvement IN avec `spentAmountXof` → dépense `STOCK_ENTRY` ; salaire payé → dépense `staff` net ; avance : demande self OK, demande pour autrui → 403, approbation → dépense + déduction au prochain salaire ; gating `finance:read` (FARMER → 403 sur /expenses) + module OFF → 403.
- **Frontend Vitest** : formulaire dépense (payload, catégories du catalogue), page analytique (KPI), salaires (génération, payer), mes avances (self). Patterns stub fetch existants.
- Garde-fous : `spotless` + `test-compile` local, ITs en CI ; web tsc/lint/vitest/build.

## 10. Risques & mitigations

- **Double compte achats** (auto + saisie manuelle du même achat) : badges source, dépenses auto verrouillées, rappel dans le formulaire. Résiduel accepté V1.
- **Mapping catégories article→dépense** : les clés exactes des catégories d'articles inventaire seront relevées au plan ; fallback `other` garanti.
- **`expenses.salary_id` sans FK en V25** : colonne créée nullable en V25, contrainte FK ajoutée en V26 (migrations immuables respectées).
- **Membre sans réglage salaire** : simplement absent de la génération (pas d'erreur).
- **Avance approuvée puis membre retiré de la ferme** : le `remaining_xof` reste ; la déduction n'aura jamais lieu (pas de salaire généré) — accepté V1, visible dans la liste des avances.
