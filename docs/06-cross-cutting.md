# 06 — Cross-cutting concerns

> Document de référence pour les **préoccupations transverses** d'AviCare Platform.
> Ces patterns sont utilisés par TOUS les bounded contexts. À lire avant d'attaquer
> Sprint A4 (parameters) et tous les sprints métier Phase B.
>
> **Pré-requis :** avoir lu `00-vision-strategique.md` et `01-roadmap-v1.md`.

---

## Table des matières

1. [Gestion d'erreurs RFC 7807](#1-gestion-derreurs-rfc-7807)
2. [Internationalisation (i18n)](#2-internationalisation-i18n)
3. [Paramétrage 3 couches](#3-paramétrage-3-couches) ← **Critique Sprint A4**
4. [Observabilité](#4-observabilité)
5. [Conventions transverses](#5-conventions-transverses)

---

## 1. Gestion d'erreurs RFC 7807

### Principe

Toutes les erreurs API retournent du **Problem Details JSON** (RFC 7807) — jamais de string nue, jamais de stack trace, jamais de `ResponseStatusException` brute.

### État dans le code (Sprint A2 livré)

Le module `common-api` fournit déjà :

- `ProblemDetailResponse` (record + Builder) — payload standard RFC 7807
- `BusinessException` (classe abstraite) + 9 enfants : `NotFoundException`, `ValidationException`, `ForbiddenException`, `FeatureForbiddenException`, `BusinessRuleException`, `QuotaExceededException`, `UnauthorizedException`, `ConflictException`, `ServiceUnavailableException`
- `GlobalExceptionHandler` (`@RestControllerAdvice`) qui mappe automatiquement chaque exception vers le bon `ProblemDetailResponse`
- `CorrelationIdFilter` qui injecte un `traceId` dans MDC et le propage dans toutes les réponses

### Convention `type` URI

```
https://avicare.com/errors/<slug-en-kebab-case>
```

Exemples :
- `https://avicare.com/errors/not-found`
- `https://avicare.com/errors/forbidden`
- `https://avicare.com/errors/duplicate-email`
- `https://avicare.com/errors/credit-limit-exceeded`

### Convention d'usage dans les services

```java
// ❌ NE JAMAIS faire ça
throw new RuntimeException("User not found");
throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found");

// ✅ TOUJOURS faire ça
throw new NotFoundException("USER_NOT_FOUND", "User with id=%d not found".formatted(userId));
```

Le code d'erreur (premier paramètre) sert à l'i18n côté client. Le message (deuxième) est pour les logs serveur — il ne devrait pas atteindre l'utilisateur final tel quel.

### Réponse RFC 7807 standard

```json
{
  "type": "https://avicare.com/errors/not-found",
  "title": "Resource not found",
  "status": 404,
  "detail": "User with id=42 not found",
  "instance": "/api/v1/users/42",
  "traceId": "8f2a3b1c4d5e6f7a"
}
```

### Cas spécifiques Spring Security

Les exceptions levées **dans la filter chain** (avant `@RestControllerAdvice`) ne passent pas par `GlobalExceptionHandler`. Il faut :
- `AuthenticationEntryPoint` custom → 401 RFC 7807
- `AccessDeniedHandler` custom → 403 RFC 7807

Implémenté dans `SecurityConfig` (Sprint A2 livré).

### Référence implémentation

Voir `backend/common/common-api/` pour le code complet + tests.

---

## 2. Internationalisation (i18n)

### Principe

Toute chaîne destinée à l'utilisateur final passe par un mécanisme i18n. **Aucun texte UI en dur** dans le code Java.

### Langues V1 / V2+

| Langue | Code | V1 | V2+ |
|---|---|---|---|
| Français | `fr` | ✅ | ✅ |
| Wolof | `wo` | ❌ | ✅ |
| Anglais | `en` | ❌ (placeholder) | ✅ |

### État dans le code (Sprint A2 livré)

Le module `common-i18n` fournit :

- `ResourceBundleMessageSource` avec basenames `classpath:i18n/messages`
- `AcceptHeaderLocaleResolver` (lit `Accept-Language` header, fallback `fr`)
- `MessageService` avec API `getMessage(code, args, locale)`
- Bundles : `messages_fr.properties`, `messages_en.properties`, `messages_wo.properties` (placeholder)

### Convention de nommage des clés

Pattern : `<context>.<entity>.<field>.<rule>` ou `<context>.<action>.<status>`

Exemples :
```properties
# Validations
identity.user.email.invalid=L'email n''est pas valide
identity.user.email.duplicate=Cet email est déjà utilisé
identity.user.password.too_short=Le mot de passe doit faire au moins 8 caractères

# Erreurs métier
livestock.batch.creation.module_disabled=Le module {0} n''est pas activé pour cette ferme
commercial.client.credit_limit_exceeded=Limite de crédit dépassée pour {0}

# Succès / messages
common.action.saved=Enregistré avec succès
```

### Convention dans les exceptions

Le **code d'erreur** de `BusinessException` est une constante stable (`UPPER_SNAKE_CASE`, ex. `USER_NOT_FOUND`) — conforme au code livré (`BAD_CREDENTIALS`, `EMAIL_ALREADY_USED`...). Le client (Web/Mobile) le mappe vers sa propre clé i18n pour traduire :

```java
throw new NotFoundException("USER_NOT_FOUND",
                            "User with id=%d not found".formatted(userId));
```

Côté bundles, on peut dériver la clé i18n du code (ex. `error.user_not_found`) ; le **code reste la constante**, jamais une clé pointée.

### Libellés métier paramétrables

Les libellés métier (souches, vaccins, catégories de dépenses) sont **dans la DB** via le système de paramétrage 3 couches (section 3) et **non dans les bundles i18n**.

Distinction :
- Bundles i18n = UI/erreurs/validations (figés, livrés avec le code)
- Paramétrage 3 couches = données métier (paramétrables par éleveur)

### Référence implémentation

Voir `backend/common/common-i18n/` pour le code complet + tests.

---

## 3. Paramétrage 3 couches

> ⚠️ **CRITIQUE Sprint A4.** Cette section décrit le pattern central du paramétrage AviCare.

### Principe — La règle d'or n°0

> **Aucune valeur métier en dur dans le code.**
>
> Tout libellé, prix, seuil, formule, catégorie est paramétrable.
> Le lookup runtime parcourt 3 couches du plus spécifique au plus général.

### Les 3 couches

```
┌─────────────────────────────────────────────────────────┐
│  Couche 3 — Préférences USER                            │
│  user_settings (user_id, key, value)                    │
│  Surcharges par l'utilisateur connecté                  │
│  Ex: format de date préféré, ordre des colonnes         │
└─────────────────────────────────────────────────────────┘
                          ▲ fallback si absent
┌─────────────────────────────────────────────────────────┐
│  Couche 2 — Paramètres FERME                            │
│  farm_settings (farm_id, key, value)                    │
│  Surcharges par l'admin de la ferme                     │
│  Ex: souches favorites, seuils alerte, prix de vente    │
└─────────────────────────────────────────────────────────┘
                          ▲ fallback si absent
┌─────────────────────────────────────────────────────────┐
│  Couche 1 — Catalogue PLATEFORME                        │
│  catalog_items (category, key, value, locale)           │
│  Défauts gérés par super-admin AviCare                  │
│  Ex: liste Cobb 500/Ross 308, vaccins Newcastle/Gumboro │
└─────────────────────────────────────────────────────────┘
```

### Tables (Sprint A4 — migration V3)

```sql
-- Couche 1 : Catalogue plateforme
CREATE TABLE catalog_items (
    id          BIGSERIAL PRIMARY KEY,
    category    VARCHAR(50) NOT NULL,   -- 'breeds', 'vaccines', 'expense_categories'
    key         VARCHAR(100) NOT NULL,  -- 'cobb_500', 'newcastle', 'feed'
    value       JSONB NOT NULL,         -- { "label": "Cobb 500", "species": "poultry", ... }
    locale      VARCHAR(5),             -- NULL = universel, sinon 'fr', 'wo', 'en'
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (category, key, locale)
);

-- Couche 2 : Paramètres ferme
CREATE TABLE farm_settings (
    id          BIGSERIAL PRIMARY KEY,
    farm_id     BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    key         VARCHAR(100) NOT NULL,  -- 'default_breed', 'mortality_threshold', 'currency'
    value       JSONB NOT NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (farm_id, key)
);

-- Couche 3 : Préférences user
CREATE TABLE user_settings (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key         VARCHAR(100) NOT NULL,
    value       JSONB NOT NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, key)
);

-- Tables auxiliaires pour catalogue surchargé par ferme
CREATE TABLE farm_catalog_items (
    id              BIGSERIAL PRIMARY KEY,
    farm_id         BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    catalog_item_id BIGINT REFERENCES catalog_items(id),  -- NULL si custom pure
    category        VARCHAR(50) NOT NULL,
    key             VARCHAR(100) NOT NULL,
    value           JSONB NOT NULL,                       -- surcharge ou ajout
    is_disabled     BOOLEAN NOT NULL DEFAULT FALSE,       -- la ferme désactive un item du catalogue
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (farm_id, category, key)
);
```

### Service de lookup

Le module `parameters` expose un `FarmSettingService` avec lookup 3 couches :

```java
@Service
@RequiredArgsConstructor
public class FarmSettingService {
    
    private final UserSettingRepository userSettingRepo;
    private final FarmSettingRepository farmSettingRepo;
    private final CatalogItemRepository catalogItemRepo;
    
    /**
     * Lookup d'une valeur en parcourant les 3 couches.
     * 
     * Priorité : user > farm > catalog
     * 
     * @return Optional.empty() si aucune des 3 couches ne définit la clé
     */
    public Optional<JsonNode> resolve(
        Long userId, 
        Long farmId, 
        String key,
        Locale locale
    ) {
        // Couche 3 : user
        Optional<JsonNode> userValue = userSettingRepo
            .findByUserIdAndKey(userId, key)
            .map(UserSetting::getValue);
        if (userValue.isPresent()) return userValue;
        
        // Couche 2 : farm
        Optional<JsonNode> farmValue = farmSettingRepo
            .findByFarmIdAndKey(farmId, key)
            .map(FarmSetting::getValue);
        if (farmValue.isPresent()) return farmValue;
        
        // Couche 1 : catalog (avec locale fallback)
        return catalogItemRepo
            .findByCategoryAndKeyAndLocale(parseCategory(key), key, locale)
            .or(() -> catalogItemRepo.findByCategoryAndKeyAndLocale(
                parseCategory(key), key, null))  // fallback universel
            .map(CatalogItem::getValue);
    }
    
    public <T> T resolveAs(Long userId, Long farmId, String key, Class<T> type, T defaultValue) {
        return resolve(userId, farmId, key, Locale.FRENCH)
            .map(node -> objectMapper.convertValue(node, type))
            .orElse(defaultValue);
    }
}
```

### Exemples d'usage

**Récupérer la souche par défaut d'un éleveur :**
```java
String defaultBreed = farmSettingService.resolveAs(
    currentUserId, currentFarmId, "default_breed", String.class, "cobb_500"
);
```

**Lister les souches disponibles (catalogue + surcharges ferme) :**
```java
List<BreedDto> breeds = catalogService.listForFarm(farmId, "breeds");
// Renvoie : catalog_items non disabled par la ferme + farm_catalog_items custom
```

**Surcharger un libellé côté éleveur :**
```java
farmCatalogService.override(farmId, "breeds", "cobb_500", 
    Map.of("label", "Mes Cobb 500 du Sénégal"));
```

### Feature gating — Modes OFF/SHADOW/SOFT/HARD

Le bean `@features.isEnabled(farmId, 'module.xxx')` (Sprint A4) supporte 4 modes :

| Mode | Comportement | Usage |
|---|---|---|
| `OFF` | Endpoint inaccessible (403 immédiat) | Module désactivé en prod |
| `SHADOW` | Endpoint accessible, mais résultats non affichés (logs uniquement) | Debug / observation discrète |
| `SOFT` | Endpoint accessible avec warning UI | Période d'évaluation |
| `HARD` | Endpoint inaccessible (403) + message "Upgrade your plan" | Push commercial |

Configuration via `farm_settings` :
```sql
INSERT INTO farm_settings (farm_id, key, value) VALUES
(123, 'features.module.poultry.broiler.mode', '"HARD"'),
(123, 'features.module.qr_codes.mode', '"OFF"');
```

### Plans d'abonnement (Plan → Modules) — Sprint B2-5, ADR-005

Le mapping **Plan → Modules** est la **source de vérité du backend** (Décision 16),
pas une constante frontend. Les plans sont des `catalog_items` de catégorie
`bundles` (Décision 15 — pas de table dédiée), chacun portant
`value {label, price_xof, wave, recommended?, custom?, modules[], quotas}`.

- **`GET /api/v1/subscription/plans`** (public) : liste les plans V1 (filtre `wave`)
  avec leurs `modules[]`. Lu via `ParametersFacade.listPlatform("bundles")`.
- **`POST /api/v1/farms/{farmId}/subscription/plan`** (`OWNER`) : résout les modules
  du plan côté serveur, **réconcilie** l'abonnement à exactement cet ensemble
  (active manquants / désactive surnuméraires) et fixe `plan_key`. Idempotent ;
  plan `custom` (sur mesure) → `422 PLAN_REQUIRES_QUOTE` ; inconnu/hors V1 → `404`.

Politique V1 : **plans = pré-bundles only** (pas d'à-la-carte) ; les **quotas sont
indicatifs (marketing), non enforced** backend. Détails : `docs/decisions/005-…`.

### Seed data minimal (Sprint A4)

Liste à insérer en seed pour V1 :

**Catégorie `breeds` (volaille) :**
- Cobb 500 (chair, rapide)
- Ross 308 (chair, standard)
- ISA Brown (ponte, brune)
- Lohmann Brown (ponte, brune)
- Hy-Line W-36 (ponte, blanche)

**Catégorie `vaccines` :**
- Newcastle (J7, J21, rappel)
- Gumboro (J14, J28)
- Bronchite infectieuse (J1, J28)
- Variole aviaire (J21)

**Catégorie `expense_categories` :**
- Aliment
- Vétérinaire / médicaments
- Personnel
- Énergie
- Matériel
- Transport
- Autres

### Anti-patterns à éviter

```java
// ❌ NE JAMAIS faire ça
public class BatchService {
    private static final List<String> AVAILABLE_BREEDS = 
        List.of("cobb_500", "ross_308", "isa_brown");  // hardcodé !
    
    public void create(BatchRequest req) {
        if (!AVAILABLE_BREEDS.contains(req.breed())) {
            throw new ValidationException("Invalid breed");
        }
        // ...
    }
}

// ✅ TOUJOURS faire ça
public class BatchService {
    private final CatalogService catalogService;
    
    public void create(Long farmId, BatchRequest req) {
        List<String> availableBreeds = catalogService
            .listForFarm(farmId, "breeds")
            .stream().map(BreedDto::key).toList();
            
        if (!availableBreeds.contains(req.breed())) {
            throw new ValidationException("breed.not_available_for_farm");
        }
        // ...
    }
}
```

---

## 4. Observabilité

### Stack cible (Sprint C5 — production)

| Concern | Outil |
|---|---|
| Métriques | Micrometer + Prometheus |
| Traces | OpenTelemetry |
| Logs centralisés | Loki ou fichier rotatif + Grafana |
| Alerting | Grafana Alerting OU UptimeRobot (simple V1) |

### Convention dès maintenant (Sprint A2+)

**Tous les logs portent un Correlation ID** (déjà en place via `CorrelationIdFilter` du module `common-api`).

Format JSON structuré (Spring Boot par défaut) :

```json
{
  "@timestamp": "2026-05-31T14:23:01.234Z",
  "level": "INFO",
  "logger": "com.avicare.identity.AuthService",
  "message": "User logged in",
  "traceId": "8f2a3b1c4d5e6f7a",
  "userId": 42,
  "farmId": 12
}
```

### Métriques minimales V1

À exposer via `/actuator/prometheus` (Sprint A1 livré) :

- HTTP request count + latency (par endpoint, par status)
- DB connection pool (Hikari : active, idle, waiting)
- JVM heap + GC time
- Custom métiers (Sprint B+) :
  - `avicare_batches_created_total` (compteur de lots créés)
  - `avicare_mortality_events_total` (mortalité par espèce, par cause)
  - `avicare_active_subscriptions_total` (souscriptions actives par bundle)

### Health checks

`/actuator/health` (Sprint A2 livré, public) inclut :
- DB connectivity (Postgres)
- Redis connectivity (Sprint A3+ si Redis utilisé)
- Disk space

### Feature gating state (`/actuator/info`)

`/actuator/info` expose `features.gatingEnabled` (booléen) pour rendre observable, par
environnement, l'état du feature gating. En prod il doit valoir `true` ; un `false` signale
le bypass dev (`avicare.features.gating-enabled=false`) qui ne doit jamais y tourner — cf.
**ADR-004**. Le boot est refusé si le bypass est demandé sous profil `prod`.

### Reporter Sprint C5

L'observabilité avancée (OpenTelemetry traces distribuées, Grafana dashboards, alerting Prometheus) est **différée à Sprint C5 (déploiement production)**. En attendant, les logs JSON + métriques Prometheus suffisent pour le développement et la bêta privée.

---

## 5. Conventions transverses

### Naming Java

| Type | Convention | Exemple |
|---|---|---|
| Package | snake_case_descriptif | `com.avicare.identity` |
| Classe | PascalCase | `UserService` |
| Méthode / variable | camelCase | `findByEmail` |
| Constante | UPPER_SNAKE_CASE | `MAX_LOGIN_ATTEMPTS` |
| DTO record | PascalCase + suffixe | `UserDto`, `LoginRequest`, `AuthResponse` |
| Exception | PascalCase + `Exception` | `DuplicateEmailException` |

### Naming SQL (verrouillé)

- Tables : **snake_case pluriel** — `users`, `farms`, `user_farms`, `refresh_tokens`
- Colonnes : **snake_case** — `first_name`, `created_at`, `is_active`
- ⚠️ Champ JPA `active` ≠ colonne `is_active` → toujours `@Column(name = "is_active")` explicite

### Audit fields obligatoires

Toute table métier porte :
```sql
created_at TIMESTAMP NOT NULL DEFAULT NOW(),
updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
deleted_at TIMESTAMP NULL  -- soft delete
```

`updated_at` est géré par **trigger PostgreSQL DB-owned** (pas Hibernate). JPA en lecture seule sur ce champ.

### Soft delete

- Colonne `deleted_at TIMESTAMP NULL`
- Index unique partiel : `UNIQUE (email) WHERE deleted_at IS NULL`
- Annotation JPA : `@SQLDelete(sql = "UPDATE ... SET deleted_at = NOW() WHERE id = ?")` + `@SQLRestriction("deleted_at IS NULL")`

### Locale par défaut

- `Locale.FRENCH` (français Sénégal)
- Migration V2+ pour ajouter wolof + anglais

### Currency par défaut

- `XOF` (FCFA) sur tous les champs financiers
- Type SQL : `NUMERIC(12, 2)` pour les montants (cf. doc 04 verrouillé)
- Type Java : `BigDecimal` (jamais `double` ou `float`)

### Multi-tenant (rappel)

Toute requête lecture/écriture passe par `getAccessibleFarmIds(user)` :

```java
@Service
public class BatchService {
    private final TenancyFacade tenancyFacade;
    
    public List<BatchDto> list(AvicarePrincipal principal) {
        List<Long> accessibleFarmIds = tenancyFacade.getAccessibleFarmIds(principal);
        return batchRepository.findByFarmIdIn(accessibleFarmIds)
            .stream().map(BatchMapper::toDto).toList();
    }
}
```

**Jamais de filtre direct par `Farm.userId` seul.**

---

## 6. Documents associés

- `00-vision-strategique.md` — Vision globale + décisions
- `01-roadmap-v1.md` — Roadmap V1 par sprint
- `02-setup-monorepo.md` — Setup mono-repo + CI/CD
- `03-architecture-spring-boot.md` — Architecture backend détaillée
- `04-schema-db-initial.md` — Schéma DB Flyway
- `05-securite-rbac.md` — Sécurité, JWT, RBAC
- **`06-cross-cutting.md`** — Ce document
- `07-frontend-nextjs.md` — À créer (Sprint A6 frontend bootstrap)
- `08-mobile-react-native.md` — À créer (Sprint B7)
- `09-plan-j1-j30.md` — À discuter

---

_Document créé pendant Sprint A3 → A4. À mettre à jour à chaque évolution des patterns transverses._
