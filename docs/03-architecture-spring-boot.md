# 03 — Architecture Spring Boot détaillée

> Document de référence pour la structure du backend Jawdi Platform.
> À donner en contexte à Claude Code à chaque sprint où on code un bounded context.

---

## 1. Vue d'ensemble — Architecture en 3 couches

L'application Spring Boot `avicare-app` est un **monolithe modulaire** organisé en **bounded contexts DDD**, regroupés en 3 couches conceptuelles :

| Couche | Bounded contexts | Rôle |
|---|---|---|
| **1 — Fondation** | identity, tenancy, subscription, parameters, livestock | Socle technique et métier réutilisé partout |
| **2 — Métier volaille** | poultry, health, inventory, commercial, finance | Logique métier de la V1 (extensible pour V2/V3) |
| **3 — Transverses** | notification, reporting, buyer, qrcode | Services de support, lectures, exports, externalisation |

**Règle :** une couche peut dépendre des couches en dessous d'elle, jamais l'inverse. La fondation ne sait pas qu'il existe du métier volaille. Le métier volaille ne sait pas qu'il existe du reporting.

---

## 2. Mini-glossaire Spring Boot (pour rappel)

Si tu n'es pas familier avec Spring Boot, voici les concepts clés du projet :

| Terme | Définition courte | Exemple |
|---|---|---|
| **Bean** | Objet géré par Spring (créé une fois, partagé) | Un service, un repository |
| **@Service** | Annotation qui marque un bean métier | `@Service public class BatchService` |
| **@Repository** | Annotation qui marque une interface d'accès DB | `interface BatchRepository extends JpaRepository<Batch, Long>` |
| **@RestController** | Annotation qui marque un controller HTTP | `@RestController @RequestMapping("/api/v1/batches")` |
| **@Component** | Bean générique, ni service ni repository | Un filtre, un listener |
| **@Configuration** | Classe qui définit des beans manuellement | Config sécurité, config Redis |
| **@Entity** | Classe qui mappe une table SQL | `@Entity @Table(name = "batches")` |
| **@Transactional** | Méthode/classe exécutée dans une transaction DB | `@Transactional public void createBatch(...)` |
| **DTO** | Data Transfer Object — contrat HTTP, jamais d'@Entity exposée | `record BatchResponse(Long id, String name)` |
| **MapStruct** | Lib qui génère le code de mapping entity ↔ DTO | `BatchMapper.toResponse(batch)` |
| **Lombok** | Lib qui génère getters/setters/builders via annotations | `@Data @Builder class Batch { ... }` |
| **Profile** | Mode d'exécution (dev, prod, test) | `application-dev.yml`, `application-prod.yml` |
| **ApplicationContext** | Conteneur de tous les beans Spring | Géré automatiquement |
| **Injection de dépendance** | Spring fournit les beans dont une classe a besoin | Via constructeur (privilégié) |

**Convention** : on utilise **l'injection par constructeur** (recommandée par Spring), pas `@Autowired` sur les champs.

```java
// ✅ Bon
@Service
@RequiredArgsConstructor  // Lombok : génère un constructeur avec les champs final
public class BatchService {
    private final BatchRepository batchRepository;
    private final ProductionUnitFacade productionUnitFacade;
    // ...
}

// ❌ Mauvais (legacy)
@Service
public class BatchService {
    @Autowired
    private BatchRepository batchRepository;  // injection par champ, à éviter
}
```

---

## 3. Structure standardisée d'un bounded context

> **Nuance super-context (ADR-008).** L'app a **5 contextes racine** : `identity`,
> `tenancy`, `subscription`, `parameters`, `livestock`. `livestock` est un
> **super-context** qui contient les **sous-domaines** du métier élevage —
> `poultry`, `layer`, `health`, `inventory`, puis `commercial` (B5) et `finance`
> (B6) — imposé par le pivot `ProductionUnit` en héritage JPA `JOINED` (Décision
> D5), qui exige un **contexte de persistance unique**. Les sous-domaines
> partagent `livestock/{domain,repository,controller,service}` et communiquent
> entre eux par **appels de services directs**. La structure ci-dessous
> s'applique telle quelle à un **contexte racine** ; au sein de `livestock` elle
> est appliquée **par sous-domaine** (package `livestock.<sousdomaine>` + bins
> `domain`/`repository`/`controller` partagés). Cf. ADR-008.

**Tout** bounded context dans `avicare-app` suit cette structure :

```
com.avicare.<context>/
│
├── api/                                  ← FRONTIÈRE PUBLIQUE
│   ├── <Context>Facade.java               ← Interface publique
│   ├── dto/
│   │   ├── <Entity>Info.java              ← DTO publique (lecture)
│   │   └── <Entity>Command.java           ← DTO publique (écriture)
│   └── event/
│       └── <Entity>CreatedEvent.java      ← Events publiés
│
├── domain/                               ← Modèle métier (PRIVÉ)
│   ├── <Entity>.java                      ← @Entity JPA
│   ├── <Status>Enum.java                  ← Enums
│   └── vo/
│       └── <ValueObject>.java             ← records pour les VO
│
├── repository/                           ← Accès DB (PRIVÉ)
│   └── <Entity>Repository.java            ← extends JpaRepository
│
├── service/                              ← Logique métier (PRIVÉ)
│   ├── <Context>FacadeImpl.java           ← @Service implémentant la facade
│   ├── <Feature>Service.java              ← Services internes
│   └── <Helper>Service.java               ← Helpers internes
│
├── controller/                           ← Endpoints REST
│   └── <Context>Controller.java           ← @RestController
│
├── dto/                                  ← DTOs HTTP (Request/Response)
│   ├── request/
│   │   ├── Create<Entity>Request.java     ← @Valid
│   │   └── Update<Entity>Request.java
│   └── response/
│       └── <Entity>Response.java          ← record
│
├── mapper/                               ← MapStruct entity ↔ DTO
│   └── <Context>Mapper.java               ← @Mapper(componentModel = "spring")
│
├── exception/                            ← Exceptions du contexte (héritent de BusinessException)
│   ├── <Entity>NotFoundException.java
│   └── <Feature>BusinessException.java
│
├── config/                               ← Configuration Spring (optionnel)
│   └── <Context>Config.java
│
└── validator/                            ← Validations métier (optionnel)
    └── <Entity>Validator.java
```

### Distinction critique : DTO publique vs DTO HTTP

C'est subtil mais important :

| Type | Package | Rôle |
|---|---|---|
| **DTO publique (`api/dto`)** | Exposée aux **autres bounded contexts** via la facade | `ProductionUnitInfo` |
| **DTO HTTP (`dto/`)** | Exposée aux **clients HTTP** via le controller | `BatchResponse`, `CreateBatchRequest` |

**Pourquoi cette séparation ?**
- L'API HTTP peut évoluer (changer un champ) sans casser les contrats inter-contextes
- Les DTOs HTTP portent souvent des considérations frontend (champs calculés, format de date, ...)
- Les DTOs publiques sont stables et minimalistes

---

## 4. Détail des bounded contexts de la V1

> **Reclassement (ADR-008).** §4.6 `poultry`, §4.7 `health`, §4.8 `inventory`
> (ainsi que `layer`, et `commercial`/`finance` à venir) ne sont **pas des
> contextes racine** : ce sont des **sous-domaines de `livestock`**. Dans leurs
> « dépendances » ci-dessous, distinguer : vers un **contexte racine**
> (`subscription`, `parameters`, `tenancy`) = **via façade** ; vers un **autre
> sous-domaine `livestock`** = **appel de service direct autorisé** (ex.
> `StockConsumptionService` orchestre le couplage D18 entre poultry/health et
> inventory).

Pour chaque contexte : **responsabilité**, **entités principales**, **facade publique exposée**, **dépendances**.

### 4.1 — `identity` (Phase A, Sprint A3)

**Responsabilité** : authentification, utilisateurs, sessions.

**Entités** :
- `User` (id, email, fullName, password hashé, locale, isActive, role)
- `RefreshToken` (id, userId, token, expiresAt, revokedAt)

**Endpoints** :
- `POST /api/v1/auth/signup`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET  /api/v1/account/profile`
- `PUT  /api/v1/account/profile`

**Facade publique** : `IdentityFacade`
```java
public interface IdentityFacade {
    UserInfo findById(Long userId);
    UserInfo findByEmail(String email);
    boolean isActive(Long userId);
}
```

**Dépendances** : `common-security`, `common-api`. Aucun autre bounded context.

---

### 4.2 — `tenancy` (Phase A, Sprint A3)

**Responsabilité** : gestion des fermes (anciens "sites") et des memberships user-ferme.

**Entités** :
- `Farm` (id, name, location, gpsCoords, createdBy, isActive)
- `UserFarm` (userId, farmId, role, permissions JSONB, joinedAt) — rôle effectif par ferme

**Endpoints** :
- `GET  /api/v1/farms` (mes fermes accessibles)
- `POST /api/v1/farms`
- `GET  /api/v1/farms/{id}`
- `PUT  /api/v1/farms/{id}`
- `DELETE /api/v1/farms/{id}`
- `GET  /api/v1/farms/{farmId}/users`
- `POST /api/v1/farms/{farmId}/users`
- `PUT  /api/v1/farms/{farmId}/users/{userId}`
- `DELETE /api/v1/farms/{farmId}/users/{userId}`

**Facade publique** : `TenancyFacade`
```java
public interface TenancyFacade {
    FarmInfo findById(Long farmId);
    List<Long> getAccessibleFarmIds(Long userId);
    boolean hasAccess(Long userId, Long farmId);
    UserFarmInfo findMembership(Long userId, Long farmId);
}
```

**Note clé** : `getAccessibleFarmIds(userId)` est **la méthode appelée partout** pour borner les requêtes. C'est l'implémentation centralisée du multi-tenancy.

**Dépendances** : `identity` (via `IdentityFacade`), `common-security`, `common-api`.

---

### 4.3 — `subscription` (Phase A, Sprint A4)

**Responsabilité** : abonnements, modules activés, entitlements, demandes de changement.

**Entités** :
- `Subscription` (id, farmId, planCode, status, startDate, endDate)
- `Entitlement` (id, subscriptionId, featureKey, enabled, quotaValue, expiresAt)
- `SubscriptionChangeRequest` (id, subscriptionId, requestedPlan, status, reviewedBy)
- `Bundle` (référentiel : starter, pro, complete) — table seed

**Endpoints** :
- `GET  /api/v1/subscription` (pour la ferme courante)
- `GET  /api/v1/subscription-change-requests`
- `POST /api/v1/subscription-change-requests`
- `POST /api/v1/subscription-change-requests/{id}/review` (super_admin)
- Backoffice super_admin : CRUD complet souscriptions

**Facade publique** : `SubscriptionFacade`
```java
public interface SubscriptionFacade {
    SubscriptionInfo findByFarmId(Long farmId);
    boolean isFeatureEnabled(Long farmId, String featureKey);
    long getQuotaValue(Long farmId, String quotaKey);
    EnforcementResult enforceQuota(Long farmId, String quotaKey, long delta);  // SOFT/HARD selon mode
}
```

**Bean dédié** : `@features` (alias SpEL pour les `@PreAuthorize`)
```java
@Component("features")
public class FeatureCheck {
    public boolean isEnabled(Long farmId, String key) { ... }
    public boolean check(String key) { ... }  // récupère farmId depuis le contexte
}
```

**Dépendances** : `tenancy` (via `TenancyFacade`), `common-api`.

---

### 4.4 — `parameters` (Phase A, Sprint A4)

**Responsabilité** : tout le paramétrage 3 couches (catalogue plateforme, settings ferme, settings user). Prix, seuils, catalogues custom.

**Sous-packages** (atypique : `parameters` contient plusieurs sous-modules logiques) :
```
parameters/
├── catalog/        ← Référentiels plateforme (souches, vaccins...)
├── farmsetting/    ← Settings ferme
├── usersetting/    ← Préférences user
├── pricelist/      ← Listes de prix
└── threshold/      ← Seuils d'alerte
```

**Entités** :
- `CatalogItem` (catégorie, code, libellés multi-langue)
- `FarmSetting` (farmId, category, key, value JSONB)
- `UserSetting` (userId, category, key, value JSONB)
- `FarmCatalogItem` (extensions custom par ferme)
- `PriceList`, `PriceListItem`, `ClientPriceList`
- `AlertThreshold`

**Endpoints** :
- `GET  /api/v1/catalog/{category}` (référentiel plateforme + custom ferme)
- `POST /api/v1/farm-catalog` (créer un item custom)
- `GET  /api/v1/settings`
- `POST /api/v1/settings`
- `DELETE /api/v1/settings/{id}`
- `GET  /api/v1/price-lists`
- `POST /api/v1/price-lists`
- `GET  /api/v1/thresholds`
- `POST /api/v1/thresholds`

**Facade publique** : `ParametersFacade`
```java
public interface ParametersFacade {
    <T> T getSetting(Long farmId, String category, String key, Class<T> type, T defaultValue);
    BigDecimal getPrice(Long farmId, Long clientId, String productType, Map<String, Object> variant);
    BigDecimal getThreshold(Long farmId, String scope, Long scopeId, String metric);
    List<CatalogEntry> getCatalog(Long farmId, String category);  // plateforme + custom merged
}
```

**Dépendances** : `tenancy`, `common-api`.

---

### 4.5 — `livestock` (Phase A, Sprint A5)

**Responsabilité** : socle abstrait de tout élevage. Définit `ProductionUnit` (la classe mère), les espèces, les souches/races, les événements génériques de cycle de vie.

**Entités** :
- `ProductionUnit` (abstract, table parente, héritage JPA `JOINED`)
- `Species` (enum : POULTRY, OVINE, BOVINE, CAPRINE, PORCINE, OTHER)
- `Breed` (id, speciesId, code, name multi-langue, parentBreedId optionnel)
- `LifecycleEvent` (id, productionUnitId, eventType, occurredAt, details JSONB)

**Endpoints** :
- `GET /api/v1/species`
- `GET /api/v1/breeds?species=POULTRY`
- `GET /api/v1/production-units/{id}` (vue générique, sans détails espèce-spécifiques)

**Facade publique** : `LivestockFacade`
```java
public interface LivestockFacade {
    ProductionUnitInfo findById(Long id);
    boolean existsAndIsActive(Long id, Long farmId);
    void recordOutflow(Long id, int quantity, OutflowReason reason);  // mortalité, vente, transfert
    void recordInflow(Long id, int quantity, InflowReason reason);    // ajout d'animaux
    SpeciesInfo getSpecies(Long productionUnitId);
}
```

**C'est LE bounded context central**. Tous les contextes transverses (`health`, `commercial`, `finance`...) passent par `LivestockFacade` plutôt que d'importer `PoultryBatch` ou `SmallRuminantAnimal`.

**Dépendances** : `tenancy`, `parameters` (pour les races custom), `common-api`.

---

### 4.6 — `poultry` (Phase B, Sprints B1-B2)

> **Sous-domaine de `livestock`** (ADR-008). `PoultryBatch extends ProductionUnit`
> (JPA JOINED, D5) ⇒ vit sous `com.avicare.livestock.poultry` (+ `layer` pour la
> ponte), pas en contexte racine.

**Responsabilité** : tout ce qui est spécifique aux volailles (lots, saisies quotidiennes, pesées, GMQ, œufs, abattages).

**Sous-packages** :
```
poultry/
├── batch/              ← Lots de volaille (chair OU ponte)
├── dailyrecord/        ← Saisies quotidiennes
├── broiler/            ← Pesées, GMQ, performance chair
├── egg/                ← Configuration, collectes, plaquettes, clôtures jour
└── slaughter/          ← Abattages
```

**Entités principales** :
- `PoultryBatch extends ProductionUnit` (héritage JOINED → table `poultry_batches`)
- `DailyRecord` (batchId, date, mortality, feed, water, weight, eggs, notes)
- `WeighingSample` (batchId, date, weights[], avgWeight, minWeight, maxWeight, uniformity)
- `GrowthPerformance` (calculé : GMQ, IC, mortalité cumulée)
- `EggCollectionConfig` (par ferme : créneaux, taille plateau, grades)
- `EggCollection` (batchId, slot, collectorId, totalEggs, brokenEggs, grades JSONB)
- `EggTrayStock` (farmId, fullTrays, emptyTrays)
- `DailyEggProduction` (clôture jour : agrégation)
- `SlaughterRecord` (batchId, quantity, liveWeight, carcassWeight, yield, destination)

**Facade publique** : `PoultryFacade`
```java
public interface PoultryFacade {
    PoultryBatchInfo findBatchById(Long batchId);
    GrowthPerformanceInfo getPerformance(Long batchId);
    EggStockInfo getEggStock(Long farmId);
}
```

**Feature gating** :
- Toute la branche `broiler/` est gated par `module.poultry.broiler`
- Toute la branche `egg/` est gated par `module.poultry.layer`

**Dépendances** : `livestock`, `tenancy`, `parameters` (pour les souches, prix, seuils), `subscription` (pour feature gating).

---

### 4.7 — `health` (Phase B, Sprint B3)

> **Sous-domaine de `livestock`** (ADR-008) : `com.avicare.livestock.health`.
> Manipule `ProductionUnit` (générique, jamais `PoultryBatch`) ; reçoit un
> couplage stock optionnel (D18) via `StockConsumptionService` (intra-livestock).

**Responsabilité** : tout le suivi sanitaire, **toutes espèces confondues** (notable : `health` ne sait pas ce qu'est un poulet).

**Entités** :
- `VaccinationProgram` (farmId, name, programItems JSONB)
- `VaccinationSchedule` (programId, productionUnitId, scheduledDate, executedAt)
- `Treatment` (productionUnitId, medication, dose, withdrawalDaysMeat, withdrawalDaysEggs)
- `VetVisit` (farmId, vetName, visitDate, notes, attachments)
- `MortalityRecord` (productionUnitId, date, quantity, cause, notes)
- `HealthEvent` (productionUnitId, eventType, occurredAt, severity, notes)

**Endpoints** :
- `GET/POST/DELETE /api/v1/vaccination-programs[/{id}]`
- `POST /api/v1/vaccination-schedules/{id}/execute`
- `GET/POST/PUT/DELETE /api/v1/treatments[/{id}]`
- `GET /api/v1/treatments/withdrawal-status`
- `GET/POST/PUT/DELETE /api/v1/vet-visits[/{id}]`
- `GET/POST/DELETE /api/v1/mortality-records[/{id}]`
- `GET/POST/PUT/DELETE /api/v1/health-events[/{id}]`

**Facade publique** : `HealthFacade`
```java
public interface HealthFacade {
    WithdrawalStatusInfo getWithdrawalStatus(Long productionUnitId);  // viande/œufs encore en délai ?
    List<TreatmentInfo> findActiveTreatments(Long productionUnitId);
    int countMortalityInPeriod(Long productionUnitId, LocalDate from, LocalDate to);
}
```

**Important** : `health` manipule **uniquement `ProductionUnit`** via `LivestockFacade`. Il ne fait JAMAIS d'import de `PoultryBatch`. C'est ce qui le rend utilisable par les ovins, bovins, etc. plus tard.

**Dépendances** : `livestock`, `tenancy`, `parameters`, `subscription`.

---

### 4.8 — `inventory` (Phase B, Sprint B4)

> **Sous-domaine de `livestock`** (ADR-008) : `com.avicare.livestock.inventory`.
> `StockConsumptionService` y est l'**orchestrateur intra-livestock** du couplage
> D18 (appelé directement par poultry/health). Dépendances racine via façades :
> `subscription` (gating `module.inventory` + Option α), `parameters` (catalog).
> **Livré tel quel** : entités dans `livestock/domain`, controllers dans
> `livestock/controller`, DTOs dans `livestock/inventory/dto` — pas de façade
> `InventoryFacade` en V1 (le couplage est *consommé* par inventory, pas exposé).

**Responsabilité** : stocks, mouvements, fournisseurs, achats, formules d'aliment.

**Entités** :
- `Stock` (farmId, category, name, currentQty, unit, minThreshold)
- `StockMovement` (stockId, type IN/OUT, quantity, unitPrice, reason, occurredAt)
- `StockCategory` (taxonomie)
- `Supplier` (farmId, name, contact)
- `PurchaseOrder` (farmId, supplierId, status, items, totalAmount)
- `PurchaseOrderItem`
- `FeedFormula` (farmId, name, ingredients JSONB)

**Endpoints** : voir ARCHITECTURE.md GINAARTECH §11 "Stocks & achats".

**Facade publique** : `InventoryFacade`
```java
public interface InventoryFacade {
    void recordOutflow(Long stockId, BigDecimal quantity, String reason);
    void recordInflow(Long stockId, BigDecimal quantity, BigDecimal unitPrice, String reason);
    StockInfo findById(Long stockId);
    boolean hasAvailability(Long farmId, String productType, BigDecimal quantity);
}
```

**Dépendances** : `tenancy`, `parameters`, `subscription`, `livestock` (pour décrémenter le stock d'œufs/poulets lors d'une vente).

---

### 4.9 — `commercial` (Phase B, Sprint B5)

> **Réalignement (B5, le code fait foi).** Le découpage en sous-packages
> `client/order/sale/...` ci-dessous **n'a pas été retenu** : il contredit
> l'ADR-008 (entités dans le bin partagé `livestock.domain`) et la convention
> réellement appliquée aux 4 autres sous-domaines (`inventory`, `health`,
> `layer`, `poultry`), tous **plats**. `commercial` suit la même convention.

**Responsabilité** : tout le pipeline commercial (clients, commandes, ventes, livraisons, factures, paiements).

**Sous-domaine de `livestock`** (ADR-008), package **plat** `com.avicare.livestock.commercial`
(services + commandes + records publics ensemble, comme `inventory`/`health`) :
```
livestock/commercial/        ← ClientService, OrderService, SaleService,
                               DeliveryService, InvoiceService, (PaymentService B5-4),
                               *Command, CreditStatus, CommercialFacade(+Impl),
                               ClientCreditInfo, InvoiceInfo
livestock/domain/            ← Client, Order/OrderItem, Sale, Delivery/DeliveryItem,
                               Invoice/InvoiceItem, (Payment B5-4) + enums  ← bin JPA partagé (ADR-008)
livestock/repository/        ← Client/Order/Sale/Delivery/Invoice repositories ← partagé
```

**Couplage stock (D21)** : la création d'une `Sale`/`Delivery` déclenche des mouvements
`OUT` (`reason=SALE`) via **appel direct intra-livestock** à `StockMovementService`
(ADR-008 : intra-livestock = appels de services directs, pas de façade ;
cf. D18 `StockConsumptionService`). Stock négatif autorisé (D19).

**Facade publique** : `CommercialFacade` (lectures farm-scoped, multi-tenant)
```java
public interface CommercialFacade {
    ClientCreditInfo getClientCredit(Long farmId, Long clientId);  // alertes dépassement (D26)
    InvoiceInfo findInvoiceById(Long farmId, Long invoiceId);
}
```

> **Events** (`SaleCreatedEvent`, etc.) : différés — pas en V1. La consommation
> par `finance` (B6) / reporting se fait via `CommercialFacade`.

**Dépendances** : sous-domaines `livestock` (dont `inventory` pour le couplage stock) en appels
directs ; contextes racine `parameters`, `subscription`, `tenancy` **via leurs façades** (ADR-008).

---

### 4.10 — `finance` (Phase B, Sprint B6)

**Responsabilité** : dépenses, comptabilité analytique, salaires, avances.

**Entités** :
- `Expense` (farmId, category, amount, date, productionUnitId optionnel)
- `Salary` (employeeId, month, baseSalary, bonus, deductions, netPay, status)
- `SalaryAdvance` (employeeId, requestDate, amount, status, deductedFromSalaryId)

**Service clé** : `AnalyticalAccountingService`
```java
@Service
public class AnalyticalAccountingService {
    public BatchCostReport computeCostByProductionUnit(Long productionUnitId) {
        // 1. Récupère les dépenses directement liées au lot
        // 2. Récupère les coûts via HealthFacade (traitements)
        // 3. Récupère les coûts via InventoryFacade (aliment, intrants)
        // 4. Récupère les ventes via CommercialFacade
        // 5. Calcule coût total + marges
    }
}
```

**Facade publique** : `FinanceFacade`
```java
public interface FinanceFacade {
    BatchCostInfo getBatchCost(Long productionUnitId);
    BigDecimal getTotalExpensesByCategory(Long farmId, String category, LocalDate from, LocalDate to);
}
```

**Dépendances** : `tenancy`, `livestock`, `health`, `inventory`, `commercial`, `parameters`, `subscription`. C'est le contexte qui a le plus de dépendances (normal, il agrège).

---

### 4.11 — `notification` (Phase C, Sprint C1)

**Responsabilité** : alertes générées, notifications in-app, préférences, jobs cron.

**Entités** :
- `Notification` (userId, title, message, type, isRead, createdAt)
- `NotificationPreference` (userId, type, channel, enabled)
- `Alert` (farmId, productionUnitId optionnel, severity, type, message, isAcknowledged)

**Service clé** : `ScheduledJobsService`
```java
@Service
public class ScheduledJobsService {
    @Scheduled(cron = "${CRON_DAILY_SCHEDULE:0 0 6 * * *}")
    public void runDailyChecks() {
        // Boucle sur toutes les fermes
        // Pour chaque ferme :
        //   - Check mortalité anormale (via HealthFacade + ParametersFacade.getThreshold)
        //   - Check stocks bas (via InventoryFacade)
        //   - Check fins de délai d'attente (via HealthFacade)
        //   - Génère Alert + Notification + applique préférences
    }
}
```

**Pattern important** : `notification` est un **gros consommateur d'events**. Il écoute presque tout :
- `MortalityRecordedEvent` (de health)
- `StockLowEvent` (de inventory)
- `InvoiceOverdueEvent` (de commercial)
- `SubscriptionExpiringEvent` (de subscription)

**Facade publique** : `NotificationFacade`
```java
public interface NotificationFacade {
    void send(Long userId, String type, String title, String message);
    void createAlert(Long farmId, AlertSeverity severity, String type, String message);
}
```

**Dépendances** : presque tous les autres contextes (pour les events), mais via **EventListener**, pas via imports directs.

---

### 4.12 — `reporting` (Phase C, Sprint C2)

**Responsabilité** : exports PDF/Excel, calcul de KPI, dashboards adaptatifs.

**Services clés** :
- `PdfExportService` — utilise OpenPDF ou similar
- `ExcelExportService` — utilise Apache POI
- `KpiService` — calcul score Or/Argent/Bronze + KPI configurables (gated `module.kpi.advanced`)
- `DashboardService` — agrège les données pour les widgets adaptatifs

**Endpoints** :
- `GET /api/v1/exports/batch/{id}/pdf`
- `GET /api/v1/exports/batch/{id}/excel`
- `GET /api/v1/exports/financial/pdf`
- `GET /api/v1/exports/health/pdf`
- `GET /api/v1/dashboard`
- `GET /api/v1/kpi-configs/{farmId}`

**Facade publique** : `ReportingFacade` (minimale, ce contexte est plus consommateur)
```java
public interface ReportingFacade {
    DashboardSnapshot getDashboard(Long farmId, String period);
}
```

**Dépendances** : presque tous les autres contextes (pour agréger).

---

### 4.13 — `buyer` (Phase C, Sprint C3)

**Responsabilité** : portail client (vue read-only pour les buyers).

**Endpoints** : `/api/v1/buyer/*` — gated par `module.buyer_portal`.

**Pattern** : `buyer` ne crée pas de nouvelle entité. Il fait des **vues filtrées** sur les entités `commercial` (orders, invoices, payments) restreintes au client connecté.

**Dépendances** : `commercial`, `identity`, `subscription`.

---

### 4.14 — `qrcode` (Phase C, Sprint C3)

**Responsabilité** : génération de QR codes + lookup public.

**Endpoints** :
- `GET /api/v1/qr/batch/{id}` (PNG)
- `GET /api/v1/qr/stock/{id}` (PNG)
- `GET /api/v1/qr/lookup?code=...` (résolution, auth optionnelle)

**Dépendances** : `livestock`, `inventory`, `subscription` (gated `module.qr_codes`).

---

## 5. Règles de communication inter-contextes — STRICT

### Règle : façade entre contextes racine ; service direct intra-`livestock` (ADR-008)

La règle d'import dépend de la frontière franchie :

```java
// ❌ INTERDIT — entre contextes RACINE : importer l'@Entity/Repository d'un autre
//    contexte racine. On passe par sa façade publique.
import com.avicare.subscription.domain.Subscription;        // ❌ depuis livestock
import com.avicare.subscription.api.SubscriptionFacade;     // ✅ la façade, oui

// ✅ AUTORISÉ — INTRA-`livestock` (super-context) : un sous-domaine importe les
//    entités partagées et appelle les services des autres sous-domaines.
import com.avicare.livestock.domain.ProductionUnit;         // ✅ pivot partagé (D5)
import com.avicare.livestock.domain.PoultryBatch;           // ✅ PoultryBatch extends ProductionUnit (JOINED)
import com.avicare.livestock.inventory.StockConsumptionService; // ✅ orchestrateur D18
```

- **Entre contextes racine** (`identity`, `tenancy`, `subscription`, `parameters`,
  `livestock`) : import d'`@Entity`/`Repository` d'un autre contexte **INTERDIT**
  → façade publique uniquement (règle inchangée).
- **Intra-`livestock`** : les sous-domaines (`poultry`, `health`, `inventory`,
  `layer`…) **partagent** `livestock/domain` + `livestock/repository` et
  s'appellent par **services directs**. C'est imposé par D5 (héritage JPA JOINED
  ⇒ contexte de persistance unique) et formalisé par **ADR-008**.

### Mécanismes autorisés de communication

1. **Synchrone — Appel direct via facade** (le plus courant)
   ```java
   ProductionUnitInfo info = livestockFacade.findById(productionUnitId);
   ```

2. **Asynchrone — Spring Application Events** (effets secondaires)
   ```java
   // Dans commercial/service/SaleService.java
   events.publishEvent(new SaleCreatedEvent(saleId, items, farmId));
   
   // Dans notification/listener/CommercialEventListener.java
   @EventListener
   public void on(SaleCreatedEvent event) { ... }
   ```

3. **Différé — Job cron** (rarement, pour batches lourds)
   ```java
   @Scheduled(cron = "0 0 6 * * *")
   public void runDailyChecks() { ... }
   ```

### Ce qui est INTERDIT

- Import d'une `@Entity` d'un autre contexte
- Injection d'un `Repository` d'un autre contexte
- Appel direct d'un `Service` privé d'un autre contexte
- Cross-référence DB (JPA `@ManyToOne` vers une entité d'un autre contexte) — sauf cas spéciaux documentés

### Cas spécial : référencer par ID

Beaucoup d'entités référencent une autre entité d'un autre contexte (ex: `Sale.clientId`). On le fait par **simple `Long` ID**, pas par `@ManyToOne` :

```java
// ✅ Bon
@Entity
public class Sale {
    @Id @GeneratedValue Long id;
    Long farmId;          // ← ID seul, pas de @ManyToOne
    Long clientId;        // ← ID seul
    Long productionUnitId; // ← ID seul
    // ...
}

// ❌ Mauvais (couple Sale à Client, Farm, ProductionUnit entités)
@Entity
public class Sale {
    @ManyToOne Farm farm;
    @ManyToOne Client client;
    @ManyToOne ProductionUnit productionUnit;  // ← coupling fort
}
```

**Pour récupérer l'info, passer par la facade :**
```java
ClientCreditInfo credit = commercialFacade.getClientCredit(sale.getClientId());
```

**Avantages :**
- Pas de fetch JPA automatique non désiré (N+1, lazy loading)
- Découplage parfait inter-contextes
- Performance prévisible (tu décides quand charger)

---

## 6. Conventions de code Spring Boot

### 6.1 — Naming

| Élément | Convention | Exemple |
|---|---|---|
| Package racine contexte | `com.avicare.<context>` | `com.avicare.poultry` |
| @Entity | Singulier, nom métier | `PoultryBatch`, `Treatment` |
| Table SQL | snake_case pluriel | `poultry_batches`, `treatments` |
| @Repository | `<Entity>Repository` | `PoultryBatchRepository` |
| @Service métier | `<Feature>Service` | `BatchService`, `EggCollectionService` |
| Facade publique | `<Context>Facade` | `LivestockFacade` |
| Implémentation facade | `<Context>FacadeImpl` | `LivestockFacadeImpl` |
| @RestController | `<Context>Controller` ou `<Feature>Controller` | `BatchController` |
| DTO Request | `<Action><Entity>Request` | `CreateBatchRequest`, `UpdateClientRequest` |
| DTO Response | `<Entity>Response` | `BatchResponse` |
| DTO publique | `<Entity>Info` | `ProductionUnitInfo` |
| Event | `<Entity><Action>Event` | `SaleCreatedEvent`, `MortalityRecordedEvent` |
| Exception métier | `<Context><Reason>Exception` | `BatchNotFoundException`, `InsufficientStockException` |

### 6.2 — DTOs : utiliser des `record` Java

Java 21 permet les records, c'est immutable, concis, parfait pour les DTOs :

```java
public record BatchResponse(
    Long id,
    String name,
    Species species,
    LocalDate startDate,
    Integer currentCount,
    String status
) {}
```

Pour les Request, on peut utiliser des records aussi (avec validation) :

```java
public record CreateBatchRequest(
    @NotBlank String name,
    @NotNull Species species,
    @NotNull Long breedId,
    @NotNull @Future LocalDate startDate,
    @Positive Integer initialCount
) {}
```

### 6.3 — Service transactionnel — annoter au bon niveau

```java
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)  // ← Par défaut readOnly (lectures)
public class BatchService {

    private final BatchRepository batchRepository;
    private final LivestockFacade livestockFacade;

    public BatchResponse findById(Long id) {
        // readOnly hérité, OK
        return batchRepository.findById(id)
            .map(mapper::toResponse)
            .orElseThrow(() -> new BatchNotFoundException(id));
    }

    @Transactional  // ← Surcharge pour écriture
    public BatchResponse create(CreateBatchRequest req) {
        // Logique de création
    }
}
```

### 6.4 — Controller : minimaliste, jamais de logique métier

```java
@RestController
@RequestMapping("/api/v1/batches")
@RequiredArgsConstructor
public class BatchController {

    private final BatchService batchService;

    @GetMapping
    public ApiResponse<PageResponse<BatchResponse>> list(
            @AuthenticationPrincipal Long userId,
            Pageable pageable) {
        return ApiResponse.of(batchService.findAccessible(userId, pageable));
    }

    @GetMapping("/{id}")
    @PreAuthorize("@farmAccess.hasPermission(#farmId, 'poultry:read')")
    public ApiResponse<BatchResponse> findById(
            @PathVariable Long id,
            @RequestParam Long farmId) {
        return ApiResponse.of(batchService.findById(id));
    }

    @PostMapping
    @PreAuthorize("@farmAccess.hasPermission(#req.farmId(), 'poultry:write') " +
                  "and @features.isEnabled(#req.farmId(), 'module.poultry.broiler')")
    public ApiResponse<BatchResponse> create(@Valid @RequestBody CreateBatchRequest req) {
        return ApiResponse.of(batchService.create(req));
    }
}
```

**Règles :**
- Pas de logique métier dans le controller — uniquement HTTP
- Toujours `ApiResponse<T>` (standard du `common-api`)
- Validation avec `@Valid` sur les DTOs
- Sécurité avec `@PreAuthorize` (RBAC + features)

### 6.5 — Repository — utiliser Spring Data JPA, éviter les requêtes natives sauf nécessité

```java
@Repository
public interface BatchRepository extends JpaRepository<PoultryBatch, Long> {

    // ✅ Méthodes dérivées du nom
    List<PoultryBatch> findByFarmIdAndStatusOrderByStartDateDesc(Long farmId, BatchStatus status);

    // ✅ @Query JPQL si la dérivation est trop verbeuse
    @Query("SELECT b FROM PoultryBatch b WHERE b.farmId IN :farmIds AND b.status = 'ACTIVE'")
    List<PoultryBatch> findActiveByFarmIds(@Param("farmIds") List<Long> farmIds);

    // ⚠️ Native query uniquement si JPQL ne suffit pas (perf, fonctions SQL spécifiques)
    @Query(value = "SELECT * FROM poultry_batches WHERE ...", nativeQuery = true)
    List<PoultryBatch> findByCustomCriteria(...);
}
```

### 6.6 — Mapper avec MapStruct

```java
@Mapper(componentModel = "spring")
public interface BatchMapper {

    BatchResponse toResponse(PoultryBatch entity);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "status", expression = "java(BatchStatus.ACTIVE)")
    PoultryBatch toEntity(CreateBatchRequest req);

    void updateEntity(@MappingTarget PoultryBatch entity, UpdateBatchRequest req);
}
```

MapStruct **génère le code de mapping** à la compilation — zéro reflection runtime, performances optimales.

### 6.7 — Exceptions — toujours hériter de `BusinessException`

```java
// Dans common-api/exception/BusinessException.java
public abstract class BusinessException extends RuntimeException {
    private final String code;
    private final HttpStatus status;
    // ...
}

// Dans poultry/exception/BatchNotFoundException.java
public class BatchNotFoundException extends BusinessException {
    public BatchNotFoundException(Long id) {
        super("BATCH_NOT_FOUND", "Batch with id " + id + " not found", HttpStatus.NOT_FOUND);
    }
}
```

Le `@ControllerAdvice` central (dans `common-api`) mappe automatiquement vers RFC 7807.

---

## 7. Pièges fréquents à éviter

| Piège | Symptôme | Mitigation |
|---|---|---|
| Importer une `@Entity` d'un autre contexte | Couplage fort, impossible d'extraire | Passer par la facade systématiquement |
| Logique métier dans un controller | Code dupliqué, intests des règles métier | Controller = HTTP only, déléguer au service |
| Tests unitaires sans mocker les facades | Tests cassent à chaque changement de contexte | Mocker les facades, pas les repositories |
| Oublier `@Transactional` sur les méthodes d'écriture | Exceptions étranges en prod, lazy loading qui plante | Annoter explicitement `@Transactional` ou `@Transactional(readOnly=true)` |
| `findById` qui retourne `null` | NPE | Toujours retourner `Optional<T>` et lancer une exception métier |
| Requêtes N+1 sur les listings | Performances catastrophiques | Utiliser `@EntityGraph` ou `JOIN FETCH` dans les requêtes |
| Hardcoder des libellés métier | Pas de multi-langue, pas de paramétrage | Tout passe par `ParametersFacade.getCatalog(...)` |
| Oublier `@PreAuthorize` sur un endpoint | Faille de sécurité multi-tenant | Aucun endpoint hors `/auth/*` et `/public/*` sans `@PreAuthorize` |
| Mélanger DTO publique et DTO HTTP | Confusion, contrats inter-contextes instables | Discipline stricte : `api/dto/` vs `dto/` |
| Logique conditionnelle "if species == POULTRY" dans health/commercial | Spaghetti code | Le code transverse ne doit JAMAIS connaître l'espèce |

---

## 8. Architecture Decision Records à créer

Au fil du développement, créer un ADR par décision majeure :

- `002-bounded-contexts-by-domain.md` — Pourquoi DDD vs couches techniques
- `003-facade-pattern-cross-context.md` — Pourquoi facades pour la communication
- `004-no-cross-context-jpa-relations.md` — Pourquoi ID au lieu de @ManyToOne
- `005-records-for-dtos.md` — Pourquoi records Java 21
- `006-mapstruct-for-mapping.md` — Pourquoi MapStruct
- `007-spring-events-for-side-effects.md` — Quand utiliser les events
- `008-transactional-readonly-default.md` — Convention transactionnelle
- `009-feature-gating-strategy.md` — `@features.isEnabled` + entitlements

---

## 9. Checklist d'un bounded context "fini"

Quand on livre un bounded context, vérifier :

- [ ] Structure de package conforme (`api/`, `domain/`, `repository/`, `service/`, `controller/`, `dto/`, `mapper/`, `exception/`)
- [ ] Une `<Context>Facade` interface publique dans `api/`
- [ ] Une `<Context>FacadeImpl` qui l'implémente dans `service/`
- [ ] Aucun import direct d'une `@Entity` d'un autre contexte
- [ ] Tous les controllers ont `@PreAuthorize` (sauf endpoints publics documentés)
- [ ] Tous les controllers retournent `ApiResponse<T>`
- [ ] Toutes les exceptions héritent de `BusinessException`
- [ ] Toutes les méthodes d'écriture sont `@Transactional`
- [ ] Tests unitaires écrits pour les services (mock des facades externes)
- [ ] Tests d'intégration pour les controllers critiques (avec Testcontainers)
- [ ] Migration Flyway versionnée pour les nouvelles tables
- [ ] OpenAPI à jour (générée auto via SpringDoc)
- [ ] Documentation : entrée dans `docs/03-architecture-spring-boot.md` à jour si la facade évolue

---

## 10. Pour aller plus loin avec Claude Code

### Prompt type pour démarrer un bounded context

```
Lis les documents :
- docs/00-vision-strategique.md
- docs/01-roadmap-v1.md (Sprint [X])
- docs/03-architecture-spring-boot.md (section sur le contexte [Y])

Aujourd'hui je veux créer la structure du bounded context [Y].

Génère :
1. La structure de packages conforme au §3 du doc archi
2. L'entité JPA principale avec ses annotations
3. Le repository Spring Data
4. La facade publique (interface + impl)
5. Un service interne
6. Le controller avec @PreAuthorize
7. Les DTOs Request/Response en records Java
8. Le mapper MapStruct
9. Au moins 1 exception métier
10. Une migration Flyway pour la nouvelle table

Respecte strictement les conventions de naming du §6 du doc archi.
Ne crée AUCUN cross-import vers d'autres contextes — utilise les facades publiques.
```

---

_Document créé en démarrage du projet. À mettre à jour si la liste des bounded contexts évolue ou si les conventions changent._
