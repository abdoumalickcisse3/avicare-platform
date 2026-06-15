# 04 — Schéma DB initial (Flyway)

> Document de référence pour toutes les migrations DB de la V1.
> À donner en contexte à Claude Code à chaque sprint où on ajoute des tables.
>
> ⚠️ **Statut (mis à jour Sprint A5).** Ce document a été rédigé au démarrage comme
> *plan* du schéma. Les migrations réellement mergées (V1→V5) ont divergé de ce
> draft sur plusieurs points (décisions A2–A4 : RBAC YAGNI, feature gating OFF/HARD,
> bundles sans table dédiée, etc.). **En cas de doute, le code fait foi**, pas les
> blocs SQL détaillés ci-dessous (conservés comme intention initiale). Les écarts
> implémentés sont recensés dans l'**Annexe — alignement code ↔ doc (Sprint A3–A5)**
> en fin de document, et le tableau de séquençage du §2 reflète l'état réel.

---

## 1. Principes fondamentaux

### Règles d'or

1. **Flyway est la SEULE source de vérité du schéma**. JAMAIS d'auto-DDL Hibernate en prod (`ddl-auto: validate`).
2. **Une migration mergée est IMMUTABLE**. Si erreur → nouvelle migration corrective.
3. **Une migration = un sujet logique**. Pas de "V5 qui fait tout".
4. **Naming strict** : `V<num>__<description>.sql` (deux underscores).
5. **Toujours réversible mentalement** : si tu casses, tu sais comment réparer.

### Conventions techniques

| Élément | Convention |
|---|---|
| IDs | `BIGSERIAL PRIMARY KEY` |
| Timestamps | `created_at` + `updated_at` (trigger auto) |
| Soft delete | `deleted_at TIMESTAMP NULL` (sur entités métier) |
| Strings courts | `VARCHAR(N)` avec N réfléchi |
| Énumérations | `VARCHAR` + `CHECK constraint` (plus flexible que ENUM SQL) |
| Décimaux financiers | `NUMERIC(12, 2)` (12 chiffres dont 2 décimales) |
| Décimaux ratios | `NUMERIC(5, 4)` |
| Quantités | `INTEGER` ou `NUMERIC(10, 3)` selon contexte |
| JSON | `JSONB` (pas `JSON`) |
| Dates seules | `DATE` |
| Horodatages | `TIMESTAMP` (sans timezone, on stocke UTC) |
| Foreign keys | `BIGINT REFERENCES <table>(id)` avec `ON DELETE` explicite |
| Index FK | TOUJOURS sur les colonnes `xxx_id` filtrées |
| Index composites | `(farm_id, status)` pour requêtes fréquentes |
| Index partiels | `WHERE deleted_at IS NULL` pour soft delete |

### Trigger réutilisable `updated_at`

À créer une seule fois en V1 :

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

Puis sur chaque table :

```sql
CREATE TRIGGER trg_<table>_updated_at
    BEFORE UPDATE ON <table>
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

---

## 2. Vue d'ensemble du séquençage Flyway

### Migrations réellement mergées (état du code)

| Version | Fichier | Sprint | Tables principales |
|---|---|---|---|
| V1 | `V1__init_identity_tenancy.sql` | A3 | users, refresh_tokens, farms, user_farms |
| V2 | `V2__subscription.sql` | A4 | subscriptions, subscription_modules, subscription_change_requests *(pas de `bundles`/`entitlements` — cf. Annexe / Décision 15)* |
| V3 | `V3__parameters.sql` | A4 | catalog_items, farm_settings, user_settings, farm_catalog_items, price_lists, price_list_items, alert_thresholds |
| V4 | `V4__seed_reference_data.sql` | A4 | *(seed only)* catalog_items : modules, bundles, breeds, vaccines, expense_categories |
| V5 | `V5__init_livestock_socle.sql` | A5 | breeds, production_units, lifecycle_events |

> **Décalage vs plan initial.** Le draft prévoyait `V4 = livestock`. En pratique le
> **seed** a pris V4 et le **livestock socle** est devenu **V5** (les migrations
> mergées sont immuables — règle d'or n°2). Tout le plan ci-dessous est donc
> décalé de +1 à partir du livestock.

### Plan prévisionnel (non encore mergé — numéros indicatifs, à confirmer au sprint)

| Version | Sprint | Tables principales |
|---|---|---|
| V6 | B1 | poultry_batches, daily_records |
| V7 | B1 | weighing_samples, growth_performance |
| V8 | B2 | egg_collection_configs, egg_collections, egg_tray_stocks, daily_egg_productions |
| V9 | B1-B2 | slaughter_records |
| V10 | B3 | vaccination_programs, vaccination_schedules, treatments, vet_visits, mortality_records, health_events |
| V11 | B4 | stock_categories, stocks, stock_movements, suppliers, purchase_orders, purchase_order_items, feed_formulas |
| V12 | B5 | clients, orders, order_items, sales, sale_items, deliveries, delivery_items, invoices, invoice_items, payments |
| V13 | B6 | expense_categories, expenses, employees, salaries, salary_advances, batch_cost_allocations |
| V14 | C1 | notifications, notification_preferences, alerts |

> Les blocs SQL détaillés du §3 ci-dessous restent le **draft initial** (intention).
> Pour V1–V5 (déjà mergé), l'**Annexe** en fin de document décrit ce qui a réellement
> été construit et pourquoi.

---

## 3. Migrations détaillées (V1 → V19, état réel)

> **Le code est la source de vérité.** Cette section a été réécrite à la clôture
> du Sprint B4 (B4-8) pour refléter les **migrations réellement mergées** sur
> `main`, remplaçant l'ancien brouillon `§3` (séquençage spéculatif, désormais
> supprimé). Conventions SQL : cf. §1. Détails par migration ci-dessous ; le DDL
> exhaustif (colonnes, index, triggers, CHECK, seeds) vit dans
> `backend/avicare-app/src/main/resources/db/migration/`.

### Phase A — Fondations (V1 → V5)

**`V1__init_identity_tenancy.sql`** (A3) — Auth + multi-tenant.
Tables : `users` (email, password BCrypt, locale, `is_active`, `role`),
`refresh_tokens` (token, `expires_at`, `revoked_at`), `farms` (name, location,
`created_by`, soft delete), `user_farms` (membership user↔farm : `role`,
`permissions` JSONB). FK + index sur les colonnes filtrées.

**`V2__subscription.sql`** (A4) — Abonnements + feature gating.
Tables : `subscriptions` (farmId, `plan_key`, `status` CHECK
TRIAL/ACTIVE/…, `trial_ends_at`), `subscription_modules` (`module_key`, `mode`
CHECK OFF/HARD, `expires_at`), `subscription_change_requests` (workflow
DRAFT→SUBMITTED→APPROVED/REJECTED). D14 (OFF/HARD), D16.

**`V3__parameters.sql`** (A4) — Paramétrage 3 couches.
Tables : `catalog_items` (catégorie/clé/`value` JSONB — défauts plateforme, D15),
`farm_settings`, `user_settings`, `farm_catalog_items` (overrides ferme),
`price_lists` + `price_list_items`, `alert_thresholds`.

**`V4__seed_reference_data.sql`** (A4) — Seed plateforme (pas de table, D17 :
aucune donnée démo). `catalog_items` : 16 modules (`modules`), bundles
(`bundles`), souches volaille, vaccins, catégories de dépense.

**`V5__init_livestock_socle.sql`** (A5) — Pivot multi-espèces (D5).
Tables : `breeds` (species CHECK, `growth_curve` JSONB, `catalog_item_id`),
`production_units` (**table parente, héritage JPA `JOINED`** : farmId, species,
`unit_kind` BATCH/INDIVIDUAL, `breed_id`, `start_date`, status, `current_count`,
soft delete), `lifecycle_events` (générique, `details` JSONB). Cf. ADR-008.

### Phase B — Métier volaille (V6 → V19)

**`V6__poultry_chair.sql`** (B1) — `poultry_batches` (hérite de `production_units`
en JOINED : `target_weight_g`, `target_age_days`…), `daily_records` (saisie
quotidienne : mortalité, aliment, eau, observations ; UNIQUE unit/date).

**`V7__poultry_performance.sql`** (B1) — `weighing_samples` (pesées échantillon),
`growth_performance` (GMQ, IC, uniformité — recalcul auto).

**`V8__poultry_layer.sql`** (B2) — `egg_collections` (collecte par créneau +
grades JSONB), `egg_tray_stocks` (plaquettes pleines/vides temps réel).

**`V9__poultry_layer_daily_production.sql`** (B2) — `daily_egg_productions`
(clôture jour : agrégation, taux de ponte/casse).

**`V10__breed_type.sql`** (B2) — `ALTER breeds` : dénormalisation `type`
(broiler/layer) pour le focus de production (D17).

**`V11__subscription_plan_modules.sql`** (A4 affinage / B) — Met à jour les
bundles `catalog_items` (`pro_volaille`, `ferme_complete` : listes de modules,
flag `recommended`). Mapping plan→modules = source de vérité backend (D16, ADR-005).

**`V12__health_catalog_seed.sql`** (B3) — Seed santé via `catalog_items` :
10 vaccins, 6 traitements (médicaments, délais d'attente), 4 programmes vaccinaux
par souche.

**`V13__health_executions.sql`** (B3) — `vaccinations` (UNIQUE unit/vaccin/date),
`vaccination_programs_lot` (1 programme/lot, `schedule_overrides` JSONB),
`health_observations` (severity).

**`V14__health_treatments_vet.sql`** (B3) — `veterinarians` (annuaire ferme),
`treatments_executed` (snapshot délais d'attente viande/œufs — ADR-007),
`vet_visits` (visites + suivi).

**`V15__inventory_catalog_stock_suppliers.sql`** (B4-1) — `stock_items`
(per-farm : `article_key`, `article_source` INVENTORY/TREATMENT, `current_quantity`
NUMERIC peut être négatif (D19), `alert_threshold`, snapshot prix/unité, soft
delete ; UNIQUE farm/source/clé), `suppliers` (annuaire ferme, `types` JSONB).
Catalogue `inventory_items` (17 articles) seedé dans `catalog_items` (D15).

**`V16__inventory_stock_movements.sql`** (B4-2) — `stock_movements` (journal
append-only : `movement_type` IN/OUT/ADJUSTMENT, magnitude + `quantity_before/after`,
`reason` CHECK, backrefs cross-sous-domaine `production_unit_id`/`daily_record_id`/
`vaccination_id`/`treatment_executed_id`, snapshot prix). Alertes compute-on-read.

**`V17__inventory_purchase_orders.sql`** (B4-3) — `purchase_orders` (workflow
`status` DRAFT→SENT→RECEIVED + CANCELLED, `order_number` BC-YYYY-NNN,
`@ManyToOne` supplier intra-contexte), `purchase_order_items` (lignes,
`received_quantity` à la réception). `ALTER stock_movements` : FK `purchase_order_id`.

**`V18__inventory_feed_formulas.sql`** (B4-4) — `feed_formulas` (per-farm :
`ingredients` JSONB List<record>, `target_breed_keys` JSONB, `target_phase` CHECK,
coût snapshot ; clonage depuis 6 templates plateforme). D20 (formule simple V1).

**`V19__stock_movement_consumption_reasons.sql`** (B4-5) — `ALTER` du CHECK
`stock_movements.reason` : ajoute `CONSUMPTION_VACCINATION` et
`CONSUMPTION_TREATMENT` pour le couplage D18 (`StockConsumptionService`).

---

## 4. Mapping JPA — exemples critiques

### 4.1 — Héritage `JOINED` côté JPA

```java
// Dans livestock/domain/ProductionUnit.java
@Entity
@Table(name = "production_units")
@Inheritance(strategy = InheritanceType.JOINED)
@DiscriminatorColumn(name = "species", discriminatorType = DiscriminatorType.STRING)
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public abstract class ProductionUnit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "farm_id", nullable = false)
    private Long farmId;

    @Enumerated(EnumType.STRING)
    @Column(insertable = false, updatable = false)
    private Species species;

    @Enumerated(EnumType.STRING)
    @Column(name = "unit_kind", nullable = false)
    private UnitKind unitKind;

    @Column(name = "breed_id")
    private Long breedId;

    private String name;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    @Column(name = "current_count", nullable = false)
    private Integer currentCount;

    @Enumerated(EnumType.STRING)
    private ProductionUnitStatus status;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
```

```java
// Dans poultry/domain/PoultryBatch.java
@Entity
@Table(name = "poultry_batches")
@DiscriminatorValue("POULTRY")
@PrimaryKeyJoinColumn(name = "production_unit_id")
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
public class PoultryBatch extends ProductionUnit {

    @Enumerated(EnumType.STRING)
    @Column(name = "poultry_type", nullable = false)
    private PoultryType poultryType;

    @Column(name = "initial_count", nullable = false)
    private Integer initialCount;

    @Column(name = "building_label")
    private String buildingLabel;

    @Column(name = "target_weight_kg")
    private BigDecimal targetWeightKg;

    @Column(name = "target_age_days")
    private Integer targetAgeDays;

    @Column(name = "target_production_rate")
    private BigDecimal targetProductionRate;
}
```

### 4.2 — Référencement par ID, pas par @ManyToOne

```java
// ✅ BON
@Entity
@Table(name = "sales")
public class Sale {
    @Id @GeneratedValue private Long id;

    @Column(name = "farm_id", nullable = false)
    private Long farmId;          // ID seul

    @Column(name = "client_id")
    private Long clientId;        // ID seul

    @Column(name = "order_id")
    private Long orderId;         // ID seul

    // ...
}

// Quand on veut l'info client, on passe par la facade :
ClientCreditInfo credit = commercialFacade.getClientCredit(sale.getClientId());
```

### 4.3 — JSONB côté JPA (avec Hibernate 6.4)

Hibernate 6.4 supporte natively le JSON :

```java
@Column(columnDefinition = "jsonb")
@JdbcTypeCode(SqlTypes.JSON)
private Map<String, Object> metadata;

// Ou avec un POJO typé
@Column(columnDefinition = "jsonb")
@JdbcTypeCode(SqlTypes.JSON)
private List<ProgramItem> programItems;
```

---

## 5. Données de seed initiales

À créer après les migrations, dans une migration séparée `V100__seed_dev_data.sql` (uniquement en profil `dev`) :

```sql
-- Profil dev uniquement
-- Utilisateur super_admin de test
INSERT INTO users (email, password_hash, full_name, role, locale, is_active)
VALUES ('admin@avicare.local', '$2a$10$...', 'Super Admin', 'SUPER_ADMIN', 'fr', TRUE);

-- Utilisateur éleveur de test
INSERT INTO users (email, password_hash, full_name, role, locale, is_active)
VALUES ('test@avicare.local', '$2a$10$...', 'Éleveur Test', 'ADMIN', 'fr', TRUE);

-- Ferme de test
INSERT INTO farms (name, location, gps_latitude, gps_longitude, capacity, created_by)
VALUES ('Ferme Bambilor', 'Bambilor, Rufisque, Sénégal', 14.7333, -17.2167, 5000, 2);

-- Membership owner
INSERT INTO user_farms (user_id, farm_id, role, joined_at, is_active)
VALUES (2, 1, 'OWNER', NOW(), TRUE);

-- Souscription Pro
INSERT INTO subscriptions (farm_id, bundle_code, status, start_date)
VALUES (1, 'pro_volaille', 'ACTIVE', CURRENT_DATE);

-- Clone des entitlements du bundle vers la souscription
INSERT INTO entitlements (subscription_id, feature_key, feature_kind, enabled, quota_value)
SELECT 1, feature_key, feature_kind, enabled, quota_value
FROM bundle_entitlement_templates
WHERE bundle_code = 'pro_volaille';
```

---

## 6. Règles d'évolution du schéma

| Cas | Que faire |
|---|---|
| Ajouter une colonne | Nouvelle migration `V<n>__add_<col>_to_<table>.sql` avec `ALTER TABLE ... ADD COLUMN ...` |
| Supprimer une colonne | Idem mais `DROP COLUMN` — réfléchir 2× avant en prod (data perdue) |
| Renommer une colonne | `ALTER TABLE ... RENAME COLUMN old TO new` — attention aux dépendances code |
| Modifier un type | Souvent impossible directement, faire : ajouter nouvelle col → copier data → drop ancienne → renommer |
| Ajouter un index | `CREATE INDEX CONCURRENTLY` en prod (pour ne pas bloquer) — mais Flyway ne supporte pas, à faire manuellement |
| Migration de data | Migration séparée Flyway avec `INSERT/UPDATE/SELECT` |
| Rollback | Pas de rollback automatique avec Flyway gratuit — préparer un script manuel si besoin |

---

## 7. Checklist d'une migration "bien faite"

- [ ] Nom du fichier conforme : `V<n>__<description>.sql`
- [ ] Pas de modification d'une migration déjà mergée sur `main`
- [ ] Tous les `CHECK` et contraintes documentés explicitement
- [ ] Index sur toutes les FK filtrables
- [ ] Index partiels pour les soft deletes (`WHERE deleted_at IS NULL`)
- [ ] Triggers `updated_at` créés
- [ ] Pas de `SELECT *` dans la migration
- [ ] Données de seed séparées (profil dev only)
- [ ] Testée localement avec `make reset-db && make backend-run` (Flyway log doit montrer "Migrating to version X")
- [ ] Reviewée (par toi-même via Claude Code) avant merge

---

## 8. Pour Claude Code — prompt type

```
Lis :
- docs/00-vision-strategique.md
- docs/03-architecture-spring-boot.md (section du contexte concerné)
- docs/04-schema-db-initial.md (section de la migration à ajouter)

Aujourd'hui je dois créer la migration Flyway V<X> pour le bounded context <Y>.

Génère :
1. Le fichier SQL conforme aux conventions du §1 du doc DB
2. Les entités JPA correspondantes (héritage ProductionUnit si applicable)
3. Le repository Spring Data
4. Vérifie que toutes les FK ont leurs index
5. Vérifie que les triggers updated_at sont en place

Respecte STRICTEMENT les conventions de naming et les règles d'évolution.
```

---

## Annexe — alignement code ↔ doc (Sprint A3–A5)

> Recense les écarts entre les blocs SQL « draft » du §3 et les migrations
> **réellement mergées** sur `main` (V1→V5). Le code fait foi. Conventions
> générales (§1) confirmées par le code : `TIMESTAMP` (sans TZ), `NUMERIC(12,2)`
> pour le monétaire, `BIGSERIAL`, enums en `VARCHAR + CHECK`, trigger
> `update_updated_at_column()` réutilisé sur chaque table.

### V1 — `V1__init_identity_tenancy.sql` (Sprint A3)

- **`users.role`** : `CHECK (role IN ('ADMIN','USER'))` — **pas** `SUPER_ADMIN`.
  Décision 11 (RBAC plateforme YAGNI : 2 niveaux en V1). L'enum code est
  `UserRole{ADMIN, USER}`.
- **`user_farms.role`** : `CHECK (... IN ('OWNER','MANAGER','FARMER','VETERINARIAN','BUYER'))`
  — `VETERINARIAN`, **pas** `ACCOUNTANT` (Décision 12, enum `FarmRole`).
- Le `CHECK` SQL doit refléter exactement l'enum (`@Enumerated(STRING)`) : une
  valeur absente de l'enum ferait échouer le mapping à la lecture.
- Tables au **pluriel** (`users`, `farms`, `user_farms`, `refresh_tokens`).
  `users` n'a **pas** de `deleted_at` (utilise `is_active`) ; `farms` est
  soft-deletable.

### V2 — `V2__subscription.sql` (Sprint A4)

Réécrit par rapport au draft (qui décrivait `bundles` + `entitlements` +
`bundle_entitlement_templates`). **Décision 15 : les bundles sont des collections
d'entitlements, sans table dédiée.** Tables réelles :

- **`subscriptions`** : `plan_key VARCHAR`, `status` défaut `TRIAL`
  (`TRIAL/ACTIVE/SUSPENDED/CANCELLED/EXPIRED`), `started_at TIMESTAMP`,
  `expires_at`, `trial_ends_at`, `UNIQUE(farm_id)`. Pas de `bundle_code`,
  `start_date DATE`, `auto_renew`, `custom_pricing`.
- **`subscription_modules`** (remplace `entitlements`) : `module_key`,
  `mode VARCHAR CHECK ('OFF','HARD')` (Décision 14 — SHADOW/SOFT différés),
  `expires_at`, `UNIQUE(subscription_id, module_key)`.
- **`subscription_change_requests`** : workflow `status CHECK ('DRAFT','SUBMITTED','APPROVED','REJECTED')`
  (pas `PENDING`), `requested_plan`, `requested_modules JSONB`, `requested_by`,
  `reviewer_id`, `reviewed_at`, `reason`. Création/soumission par l'OWNER ferme,
  approbation/rejet par un ADMIN plateforme.
- **Pas de** `bundles`, `entitlements`, `bundle_entitlement_templates` en base :
  modules et bundles sont seedés comme `catalog_items` (cf. V4).

### V3 — `V3__parameters.sql` (Sprint A4)

- **`catalog_items`** : modèle `category` / `key` / `value JSONB` / `locale`
  (NULL = universel) / `is_active`. **Pas** les colonnes du draft
  (`species`, `code`, `name_fr/wo/en`, `metadata`, `sort_order`). Unicité via
  **index partiels** : `(category,key,locale) WHERE locale IS NOT NULL` et
  `(category,key) WHERE locale IS NULL`.
- **`farm_settings`** / **`user_settings`** : `(farm_id|user_id, key, value JSONB)`,
  `UNIQUE` sur (scope, key).
- **`farm_catalog_items`** : surcharges/désactivations ferme du catalogue
  (`is_disabled`, `catalog_item_id` nullable).
- **`price_lists`** (soft delete `deleted_at` — seule table parameters concernée)
  + **`price_list_items`** (`unit_price NUMERIC(12,2)`, `currency` défaut `XOF`).
- **`alert_thresholds`** : `threshold_type`, `threshold_value NUMERIC(12,3)`
  (pas `NUMERIC(15,4)`), `severity CHECK ('INFO','WARNING','CRITICAL')`.
- **Pas de** `client_price_lists` (reporté ; non requis en V1).

### V4 — `V4__seed_reference_data.sql` (Sprint A4, seed only)

Insère des `catalog_items` plateforme (locale NULL), **sans demo data**
(Décision 17 — pas de ferme/user de démo) :

- `modules` (16 — tous V1+V2+, `value {label, scope, wave}`, Décision 13),
- `bundles` (4 — `starter_volaille`, `pro_volaille`, `ferme_complete`,
  `tabaski_edition` ; `value {modules[], price_xof, quotas}` — Décision 15),
- `breeds` (5 souches volaille), `vaccines` (4), `expense_categories` (7)
  (cf. doc 06 §3).

### V5 — `V5__init_livestock_socle.sql` (Sprint A5)

Correspond au draft « V4 livestock » (renuméroté V5). Conforme au §3, avec :

- **`breeds`** seedé **depuis `catalog_items` (category `'breeds'`)** en dérivant
  l'espèce du `value` JSONB (`UPPER(value->>'species')`) — et **non** depuis une
  hypothétique `category='breed'` avec colonnes `species/name_fr` (qui n'existent
  pas dans notre `catalog_items`).
- **`production_units`** : table parente, héritage **JPA `JOINED`**. L'entité
  `ProductionUnit` est **concrète** (une racine JOINED abstraite sans sous-classe
  n'est pas requêtable par Hibernate) ; les sous-classes par espèce
  (`PoultryBatch`, B1+) ajoutent leur table joignant sur `id` sans toucher le parent.
- **`lifecycle_events`** : événements génériques (`quantity_delta`, `details JSONB`),
  append-only.

### Dette / à corriger plus tard

- Les **blocs SQL détaillés du §3** pour V1–V5 restent le draft initial (non
  réécrits ici pour limiter le bruit). Les réécrire intégralement pourra se faire
  si le doc devient une référence consultée telle quelle.
- La numérotation prévisionnelle V6+ (§2) est **indicative** : à confirmer au
  démarrage de chaque sprint B+.

---

_Document créé en démarrage du projet. À mettre à jour à chaque nouvelle migration majeure._
_Annexe d'alignement ajoutée au Sprint A5 (réconciliation avec les migrations V1–V5)._
