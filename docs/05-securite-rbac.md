# 05 — Sécurité & RBAC

> Document de référence pour le Sprint A2 (`common-*` implémentation).
> À donner en contexte à Claude Code pour générer le code Spring Boot sécurité.
> Profil cible : **dev expérimenté qui découvre Spring Boot**.

---

## Comment lire ce document

Ce doc est dense (~2300 lignes). Voici les **3 niveaux de lecture** :

| Niveau | Quoi lire | Temps |
|---|---|---|
| 🟢 Survol | "But en 1 phrase" + "Concept Spring sous-jacent" de chaque sous-section | 30 min |
| 🟡 Compréhension | + Code commenté + Flux d'exécution | 1h30 |
| 🔴 Implémentation | + Pièges + Tests + Annexes | 3h |

**Conseil :** fais d'abord un survol complet (niveau 🟢) pour avoir la carte mentale, puis reviens en compréhension (🟡) sur ce qui te concerne aujourd'hui.

---

## 📑 Table des matières

- **Partie 0** — Vue d'ensemble & architecture
- **Partie 1** — Concepts Spring critiques (Beans, AOP, SpEL, Security)
- **Partie 2** — `common-api` (ApiResponse, RFC 7807, exceptions, CorrelationId)
- **Partie 3** — `common-security` (JWT, FarmAccess, Spring Security config)
- **Partie 4** — `common-tenancy` (Memberships, helpers)
- **Partie 5** — `common-i18n` (locale, messages, validation)
- **Partie 6** — Feature gating (`@features.isEnabled`)
- **Partie 7** — Récap, pièges, prompt Sprint A2

---

# Partie 0 — Vue d'ensemble & architecture

## 0.1 — Flux d'une requête HTTP authentifiée

Voici ce qui se passe quand un utilisateur appelle `POST /api/v1/batches` depuis le frontend web :

```
[Browser] → Cookie httpOnly avec JWT
   ↓
[Spring Boot App entrée HTTP]
   ↓
[CorrelationIdFilter]
   ├─ Lit/génère X-Correlation-Id
   └─ Met dans MDC pour les logs
   ↓
[CORS Filter] (Spring auto-config)
   ↓
[JwtFilter] (notre filtre custom)
   ├─ Extract token depuis cookie OU header Authorization
   ├─ Validate signature RSA
   ├─ Check blacklist Redis
   ├─ Build AvicarePrincipal (userId, email, memberships)
   └─ Met dans SecurityContextHolder
   ↓
[Spring Security MethodSecurityInterceptor]
   ├─ Lit @PreAuthorize sur la méthode
   ├─ Évalue l'expression SpEL : @farmAccess.hasPermission(#farmId, 'poultry:write')
   ├─ Évalue @features.isEnabled(#farmId, 'module.poultry.broiler')
   └─ Si OK → continue, sinon → 403 Problem Details
   ↓
[Controller @RestController]
   ├─ Validate Request body (Bean Validation)
   ├─ Appelle Service
   ↓
[Service @Service @Transactional]
   ├─ Business logic
   ├─ Lit/écrit DB
   ├─ Appelle facades autres bounded contexts
   └─ Publie event si besoin
   ↓
[Mapper MapStruct] Entity → Response DTO
   ↓
[Controller renvoie ApiResponse<BatchResponse>]
   ↓
[GlobalExceptionHandler] (si erreur)
   ├─ Catch BusinessException → Problem Details
   └─ Log avec correlation ID
   ↓
[Browser reçoit JSON]
```

**Points critiques** :
- Tout ce qui n'est **pas** un controller (filtres, interceptors, exception handlers) est **transverse**. Ça vit dans `common-*`.
- Le controller fait **uniquement** l'orchestration HTTP. La logique métier est dans les services.
- La sécurité est **multi-couche** : filtre (auth) puis SpEL (RBAC + features).

## 0.2 — Les 3 couches de sécurité

| Couche | Quoi | Où dans le code |
|---|---|---|
| **1. JWT user** | Authentifie qui est l'utilisateur | `JwtFilter`, `JwtService` dans `common-security` |
| **2. RBAC tenant** | Autorise quoi cet user peut faire sur cette ferme | `FarmAccessChecker` bean + `@PreAuthorize` dans controllers |
| **3. Service-to-Service** | JWT scopés pour comms internes (futur) | `@RequireServiceAuth` interceptor (squelette en A2, utilisé V2+) |

## 0.3 — Carte des fichiers à créer dans `common-*`

Voici **tout** ce que tu vas créer pendant le Sprint A2 :

### `common-api/`
```
src/main/java/com/avicare/common/api/
├── response/
│   ├── ApiResponse.java                ← record générique
│   └── PageResponse.java               ← record pagination
├── exception/
│   ├── BusinessException.java          ← abstract base
│   ├── NotFoundException.java
│   ├── ValidationException.java
│   ├── ForbiddenException.java
│   ├── ConflictException.java
│   ├── BusinessRuleException.java
│   ├── FeatureForbiddenException.java
│   └── QuotaExceededException.java
├── error/
│   ├── ProblemDetailResponse.java      ← record RFC 7807
│   ├── ErrorCode.java                  ← enum codes erreur
│   └── GlobalExceptionHandler.java     ← @ControllerAdvice
└── filter/
    └── CorrelationIdFilter.java        ← Filter X-Correlation-Id

src/test/java/com/avicare/common/api/
├── GlobalExceptionHandlerTest.java
└── CorrelationIdFilterTest.java
```

### `common-security/`
```
src/main/java/com/avicare/common/security/
├── jwt/
│   ├── JwtService.java                 ← génération/validation
│   ├── JwtProperties.java              ← @ConfigurationProperties
│   ├── JwtFilter.java                  ← filtre Spring Security
│   └── KeyLoader.java                  ← charge clés RSA depuis config
├── principal/
│   ├── AvicarePrincipal.java           ← record principal
│   └── Membership.java                 ← record membership
├── access/
│   ├── FarmAccessChecker.java          ← bean SpEL @farmAccess
│   └── PermissionConstants.java        ← constantes "poultry:write" etc.
├── s2s/
│   ├── RequireServiceAuth.java         ← annotation
│   └── ServiceAuthInterceptor.java     ← interceptor (squelette)
└── config/
    └── SecurityConfig.java             ← SecurityFilterChain

src/main/resources/
├── application-security.yml            ← profil security
└── (clés RSA chargées par variable d'env, pas en config)

src/test/java/com/avicare/common/security/
├── JwtServiceTest.java
├── JwtFilterTest.java
└── FarmAccessCheckerTest.java
```

### `common-tenancy/`
```
src/main/java/com/avicare/common/tenancy/
├── context/
│   ├── TenancyContext.java             ← helper static
│   └── CurrentUser.java                ← utilitaire pour récupérer principal
└── exception/
    └── NoAccessibleFarmException.java
```

### `common-i18n/`
```
src/main/java/com/avicare/common/i18n/
├── config/
│   ├── I18nConfig.java                 ← MessageSource + LocaleResolver
│   └── ApiLocaleResolver.java          ← custom resolver
└── service/
    └── MessageService.java             ← helper pour récupérer messages

src/main/resources/
├── messages.properties                 ← défaut (FR)
├── messages_fr.properties              ← français
├── messages_en.properties              ← anglais
└── messages_wo.properties              ← wolof (vide, V2)
```

## 0.4 — Dépendances entre les common-*

```
common-i18n     (no deps autres que Spring)
   ↑
common-api      (uses common-i18n)
   ↑
common-tenancy  (uses common-api)
   ↑
common-security (uses common-api, common-tenancy)
```

**Règle :** un module commun **ne dépend que** des modules en dessous de lui. Pas de dépendance circulaire.

---

# Partie 1 — Concepts Spring critiques

> Cette partie te donne les **bases conceptuelles** indispensables pour comprendre ce qu'on va construire ensuite. Si tu maîtrises déjà Spring Boot, tu peux skip.

## 1.1 — Beans & Dependency Injection

### 🎯 But en 1 phrase

Spring crée et gère **automatiquement** tes objets (services, repositories, etc.) et **injecte** leurs dépendances sans que tu écrives `new`.

### 🧠 Concept

Sans Spring (Java classique) :
```java
EmailService emailService = new EmailService(new SmtpClient("config..."));
UserRepository userRepo = new UserRepository(new DataSource("..."));
UserService userService = new UserService(userRepo, emailService);
```

Tu construis **toi-même** chaque objet et tu passes ses dépendances **à la main**. Imagine avec 100 services 😱.

Avec Spring :
```java
@Service
public class UserService {
    private final UserRepository userRepo;
    private final EmailService emailService;
    
    public UserService(UserRepository userRepo, EmailService emailService) {
        this.userRepo = userRepo;
        this.emailService = emailService;
    }
}
```

Tu déclares **juste** ce dont `UserService` a besoin (paramètres du constructeur). Spring se charge de :
1. Trouver les beans `UserRepository` et `EmailService` dans son contexte
2. Les passer au constructeur
3. Instancier `UserService`
4. Le rendre disponible pour quiconque a besoin de lui

### 📝 Les 4 annotations principales

| Annotation | Quand l'utiliser | Exemple |
|---|---|---|
| `@Service` | Classe métier (logique business) | `BatchService`, `JwtService` |
| `@Repository` | Accès données | Pas vraiment utilisé chez nous (Spring Data JPA génère les implémentations) |
| `@Component` | Bean générique | Filtres, listeners, helpers |
| `@RestController` | Endpoints HTTP | `BatchController` |
| `@Configuration` | Définit des beans manuellement | `SecurityConfig`, `I18nConfig` |

**En pratique** : `@Service` pour ta logique, `@RestController` pour tes endpoints, `@Configuration` quand tu dois définir des beans qui ne sont pas tes classes (genre un `MessageSource`).

### 🪄 Lombok `@RequiredArgsConstructor`

Toi tu écris :
```java
@Service
@RequiredArgsConstructor      // ← Lombok génère le constructeur
public class UserService {
    private final UserRepository userRepo;
    private final EmailService emailService;
    // Pas besoin d'écrire le constructeur, Lombok le génère
}
```

Au compile-time, Lombok **génère** le code du constructeur avec tous les `final fields`. Donc ce qui est exécuté est :
```java
public UserService(UserRepository userRepo, EmailService emailService) {
    this.userRepo = userRepo;
    this.emailService = emailService;
}
```

**Pourquoi `final` ?** Pour garantir que les dépendances **ne peuvent pas changer** après construction. C'est de l'immutabilité.

**Pourquoi pas `@Autowired` sur les champs ?** C'est l'ancienne façon de faire (Spring 3-4). Aujourd'hui : injection par constructeur, c'est **mieux** pour :
- Tests unitaires (tu peux instancier sans Spring)
- Détecter les dépendances circulaires (échec au boot)
- Immutabilité (`final`)

### ⚠️ Piège — Self-invocation

```java
@Service
public class BatchService {
    
    @Transactional
    public void createBatch(...) {
        // ... insert DB
        this.updateStock(...);   // ❌ Le @Transactional de updateStock ne s'applique PAS
    }
    
    @Transactional
    public void updateStock(...) {
        // ...
    }
}
```

**Pourquoi ?** Spring n'utilise pas ta classe directement. Il crée un **proxy** qui wrap ta classe. Quand tu appelles `this.updateStock()`, tu bypass le proxy, donc l'AOP (transaction, security) **ne s'applique pas**.

**Solution** : extraire `updateStock` dans un autre service injecté, ou utiliser `self.updateStock()` via auto-injection. On va voir ça en pratique.

---

## 1.2 — AOP (Aspect-Oriented Programming)

### 🎯 But en 1 phrase

L'AOP permet d'**intercepter** une méthode pour ajouter du comportement **avant**, **après**, ou **autour** de son exécution sans modifier son code.

### 🧠 Concept

Tu connais `@Transactional` :
```java
@Service
public class BatchService {
    @Transactional
    public Batch createBatch(...) {
        // Spring ouvre une transaction AVANT
        // ... ton code ...
        // Spring commit (ou rollback si exception) APRÈS
    }
}
```

`@Transactional` est un **aspect** : Spring intercepte tous les appels à cette méthode et ajoute la gestion transactionnelle.

D'autres aspects courants :
- `@Cacheable` : met en cache le résultat
- `@PreAuthorize` : vérifie la sécurité avant
- `@Async` : exécute en thread séparé

### 🪄 Comment ça marche techniquement

Spring crée un **proxy** dynamique de ta classe au runtime. Quand un autre bean fait :
```java
@Autowired BatchService batchService;
batchService.createBatch(...);
```

`batchService` n'est **pas** une instance de `BatchService` directement. C'est un proxy `BatchService$$EnhancerBySpringCGLIB$$...` qui :
1. Intercepte l'appel
2. Exécute les aspects (`@Transactional`, `@PreAuthorize`, etc.)
3. Appelle la vraie méthode
4. Exécute les aspects post-méthode

**Conséquence pratique** :
- Les annotations AOP fonctionnent **seulement quand l'appel passe par Spring**
- L'appel `this.method()` interne **bypass** le proxy (cf. piège plus haut)

---

## 1.3 — SpEL (Spring Expression Language)

### 🎯 But en 1 phrase

SpEL est un **mini-langage d'expressions** que Spring évalue au runtime, utilisé dans certaines annotations.

### 🧠 Syntaxe de base

| Syntaxe | Signification | Exemple |
|---|---|---|
| `#{...}` | Expression évaluée | `@Value("#{systemProperties['user.region']}")` |
| `${...}` | Property placeholder | `@Value("${jwt.secret}")` |
| `T(...)` | Référence à un type | `T(java.lang.Math).PI` |
| `@beanName` | Référence à un bean | `@farmAccess.hasPermission(...)` |
| `#paramName` | Référence à un paramètre de méthode | `#farmId` |
| `principal` | L'utilisateur authentifié | `principal.userId` |
| `authentication` | L'objet `Authentication` Spring Security | `authentication.authorities` |

### 📝 Usage typique avec `@PreAuthorize`

```java
@RestController
@RequestMapping("/api/v1/batches")
public class BatchController {

    @PostMapping
    @PreAuthorize("@farmAccess.hasPermission(#req.farmId(), 'poultry:write')")
    public ApiResponse<BatchResponse> create(@RequestBody @Valid CreateBatchRequest req) {
        // ...
    }
}
```

**Décortique** :
- `@PreAuthorize("...")` : annotation Spring Security qui évalue une expression SpEL **avant** d'exécuter la méthode
- `@farmAccess` : référence au bean nommé `farmAccess` dans le contexte Spring
- `.hasPermission(...)` : méthode à appeler sur ce bean
- `#req` : référence au paramètre de méthode `req`
- `.farmId()` : appel de méthode (record `CreateBatchRequest`)
- `'poultry:write'` : string literal

Si l'expression retourne `true` → la méthode s'exécute. Si `false` → Spring Security lance `AccessDeniedException` qui sera convertie en `403 Problem Details` par notre `GlobalExceptionHandler`.

### ⚠️ Piège — Évaluation au mauvais moment

```java
@Value("#{systemProperties['user.region']}")    // Évalué au boot
private String region;
```

Si la system property n'existe pas au boot, le champ vaut `null`. Pas de re-évaluation au runtime.

---

## 1.4 — Spring Security en 5 minutes

### 🎯 But en 1 phrase

Spring Security est une **chaîne de filtres** qui intercepte chaque requête HTTP pour gérer l'authentification et l'autorisation.

### 🧠 Les acteurs principaux

#### `SecurityFilterChain`
La chaîne de tous les filtres de sécurité. **L'ordre compte**. On configure dans `SecurityConfig`.

```
Request entrante
   ↓
SecurityContextPersistenceFilter   (lit le contexte)
   ↓
... autres filtres Spring auto
   ↓
NOTRE JwtFilter                   (notre custom)
   ↓
... autres filtres
   ↓
ExceptionTranslationFilter        (catch les AccessDenied)
   ↓
FilterSecurityInterceptor         (autorisation finale)
   ↓
Controller
```

#### `Authentication`
Interface qui représente "qui est l'utilisateur authentifié". Elle contient :
- `principal` : objet représentant l'user (chez nous : `AvicarePrincipal`)
- `authorities` : liste des permissions/rôles
- `isAuthenticated()` : `true` si authentifié

#### `SecurityContextHolder`
Stocke le `Authentication` courant dans un **ThreadLocal**. Donc chaque thread a son propre contexte. Ça permet de récupérer l'user "depuis n'importe où" :

```java
Authentication auth = SecurityContextHolder.getContext().getAuthentication();
AvicarePrincipal principal = (AvicarePrincipal) auth.getPrincipal();
```

#### `GrantedAuthority`
Représente un rôle ou une permission. Chez nous, simple : `ROLE_USER`, `ROLE_ADMIN`, `ROLE_SUPER_ADMIN`. On fait le RBAC granulaire via les memberships, pas via les authorities classiques.

### 📝 Le flow complet

1. Requête arrive
2. `JwtFilter` (notre custom) :
   - Extract JWT depuis cookie ou header
   - Validate signature
   - Construit `AvicarePrincipal`
   - Crée un `UsernamePasswordAuthenticationToken` avec ce principal
   - `SecurityContextHolder.getContext().setAuthentication(auth)`
3. La requête arrive au controller
4. Avant l'exécution de la méthode, Spring Security lit `@PreAuthorize`
5. Évalue l'expression SpEL (notre `@farmAccess.hasPermission(...)`)
6. Si OK : exécute la méthode. Sinon : `AccessDeniedException` → 403

---

## 1.5 — RFC 7807 Problem Details

### 🎯 But en 1 phrase

RFC 7807 est un **standard** de structure JSON pour les erreurs HTTP, pour qu'un client puisse les parser uniformément.

### 🧠 Structure standard

```json
{
  "type": "https://avicare.com/errors/farm-not-found",
  "title": "Farm Not Found",
  "status": 404,
  "detail": "La ferme avec l'identifiant 42 n'existe pas",
  "instance": "/api/v1/farms/42",
  "traceId": "abc-123-xyz"
}
```

**Champs obligatoires** : `type`, `title`, `status`, `detail`, `instance`.
**Champs custom** (recommandés) : `traceId`, `code`, `errors[]` pour validation.

### ⚠️ Pourquoi pas `ResponseStatusException` ?

Tentant de faire :
```java
throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Farm not found");
```

**Problème** : pas de code structuré, pas de traceId, pas de i18n, message brut. Difficile pour le frontend de gérer.

**Notre approche** : hiérarchie d'exceptions métier + `@ControllerAdvice` qui mappe vers Problem Details. Beaucoup plus propre.

---

# Partie 2 — `common-api`

> Le foundation block. Aucune logique business. Juste des contrats partagés que toutes les autres briques utilisent.

## 2.1 — `ApiResponse<T>` et `PageResponse<T>`

### 🎯 But en 1 phrase

Convention de réponse uniforme : toutes les réponses HTTP retournent `{ "data": ..., "meta": ... }`.

### 📝 Code complet

`common-api/src/main/java/com/avicare/common/api/response/ApiResponse.java` :

```java
package com.avicare.common.api.response;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.Map;

/**
 * Wrapper standard de réponse HTTP.
 *
 * Format JSON :
 *   { "data": T, "meta": { ... } }
 *
 * Le champ "meta" est optionnel.
 *
 * @param <T> type de la donnée payload
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiResponse<T>(
    T data,
    Map<String, Object> meta
) {

    public static <T> ApiResponse<T> of(T data) {
        return new ApiResponse<>(data, null);
    }

    public static <T> ApiResponse<T> of(T data, Map<String, Object> meta) {
        return new ApiResponse<>(data, meta);
    }
}
```

`common-api/src/main/java/com/avicare/common/api/response/PageResponse.java` :

```java
package com.avicare.common.api.response;

import org.springframework.data.domain.Page;

import java.util.List;

/**
 * Wrapper de pagination.
 *
 * Format JSON :
 *   { "items": [...], "page": 0, "size": 20, "totalElements": 156, "totalPages": 8 }
 */
public record PageResponse<T>(
    List<T> items,
    int page,
    int size,
    long totalElements,
    int totalPages
) {

    public static <T> PageResponse<T> from(Page<T> page) {
        return new PageResponse<>(
            page.getContent(),
            page.getNumber(),
            page.getSize(),
            page.getTotalElements(),
            page.getTotalPages()
        );
    }
}
```

### 🔄 Usage dans un controller

```java
@GetMapping
public ApiResponse<PageResponse<BatchResponse>> list(Pageable pageable) {
    Page<BatchResponse> page = batchService.findAll(pageable);
    return ApiResponse.of(PageResponse.from(page));
}

@GetMapping("/{id}")
public ApiResponse<BatchResponse> findById(@PathVariable Long id) {
    return ApiResponse.of(batchService.findById(id));
}
```

### ⚠️ Pièges fréquents

- **Ne PAS exposer directement les entités JPA**. Toujours mapper vers `BatchResponse` (record DTO).
- **`@JsonInclude(NON_NULL)`** sur `ApiResponse` pour ne pas inclure `"meta": null` dans le JSON quand on n'a pas de meta.

---

## 2.2 — Hiérarchie d'exceptions métier

### 🎯 But en 1 phrase

Tous les problèmes métier sont des `BusinessException` (ou enfants), jamais des `RuntimeException` nues ou des `ResponseStatusException`.

### 📝 Code complet

`common-api/src/main/java/com/avicare/common/api/exception/BusinessException.java` :

```java
package com.avicare.common.api.exception;

import org.springframework.http.HttpStatus;

import java.util.Map;

/**
 * Classe mère de toutes les exceptions métier.
 * Mappées en Problem Details par le GlobalExceptionHandler.
 */
public abstract class BusinessException extends RuntimeException {

    private final String code;
    private final HttpStatus status;
    private final Map<String, Object> properties;

    protected BusinessException(String code, String message, HttpStatus status) {
        this(code, message, status, Map.of());
    }

    protected BusinessException(
        String code,
        String message,
        HttpStatus status,
        Map<String, Object> properties
    ) {
        super(message);
        this.code = code;
        this.status = status;
        this.properties = properties;
    }

    public String getCode() {
        return code;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public Map<String, Object> getProperties() {
        return properties;
    }
}
```

`NotFoundException.java` :

```java
package com.avicare.common.api.exception;

import org.springframework.http.HttpStatus;

public class NotFoundException extends BusinessException {

    public NotFoundException(String code, String message) {
        super(code, message, HttpStatus.NOT_FOUND);
    }

    public static NotFoundException of(String entityType, Object id) {
        return new NotFoundException(
            entityType.toUpperCase() + "_NOT_FOUND",
            entityType + " with id " + id + " not found"
        );
    }
}
```

`ValidationException.java` :

```java
package com.avicare.common.api.exception;

import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.Map;

public class ValidationException extends BusinessException {

    public ValidationException(String code, String message) {
        super(code, message, HttpStatus.BAD_REQUEST);
    }

    public ValidationException(String code, String message, List<FieldError> errors) {
        super(code, message, HttpStatus.BAD_REQUEST, Map.of("errors", errors));
    }

    public record FieldError(String field, String code, String message) {}
}
```

`ForbiddenException.java` :

```java
package com.avicare.common.api.exception;

import org.springframework.http.HttpStatus;

public class ForbiddenException extends BusinessException {

    public ForbiddenException(String code, String message) {
        super(code, message, HttpStatus.FORBIDDEN);
    }

    public static ForbiddenException accessDenied(String resource) {
        return new ForbiddenException(
            "ACCESS_DENIED",
            "Access denied to " + resource
        );
    }
}
```

`ConflictException.java` :

```java
package com.avicare.common.api.exception;

import org.springframework.http.HttpStatus;

public class ConflictException extends BusinessException {

    public ConflictException(String code, String message) {
        super(code, message, HttpStatus.CONFLICT);
    }
}
```

`BusinessRuleException.java` :

```java
package com.avicare.common.api.exception;

import org.springframework.http.HttpStatus;

/**
 * Pour les violations de règles métier non-statutaires (422 Unprocessable Entity).
 * Exemple : "Impossible de fermer un lot avec des animaux vivants".
 */
public class BusinessRuleException extends BusinessException {

    public BusinessRuleException(String code, String message) {
        super(code, message, HttpStatus.UNPROCESSABLE_ENTITY);
    }
}
```

`FeatureForbiddenException.java` :

```java
package com.avicare.common.api.exception;

import org.springframework.http.HttpStatus;

import java.util.Map;

/**
 * Levée quand un user essaie d'utiliser une feature non incluse dans son abonnement.
 */
public class FeatureForbiddenException extends BusinessException {

    public FeatureForbiddenException(String featureKey) {
        super(
            "FEATURE_FORBIDDEN",
            "Feature " + featureKey + " is not enabled for your subscription",
            HttpStatus.FORBIDDEN,
            Map.of("featureKey", featureKey)
        );
    }
}
```

`QuotaExceededException.java` :

```java
package com.avicare.common.api.exception;

import org.springframework.http.HttpStatus;

import java.util.Map;

/**
 * Levée quand un user atteint une limite quota (429 Too Many Requests).
 */
public class QuotaExceededException extends BusinessException {

    public QuotaExceededException(String quotaKey, long current, long limit) {
        super(
            "QUOTA_EXCEEDED",
            "Quota " + quotaKey + " exceeded (" + current + "/" + limit + ")",
            HttpStatus.TOO_MANY_REQUESTS,
            Map.of(
                "quotaKey", quotaKey,
                "current", current,
                "limit", limit
            )
        );
    }
}
```

### 🔄 Usage typique

```java
// Dans un service
public Batch findById(Long id) {
    return batchRepository.findById(id)
        .orElseThrow(() -> NotFoundException.of("Batch", id));
}

// Validation métier
if (batch.getCurrentCount() > 0) {
    throw new BusinessRuleException(
        "BATCH_NOT_EMPTY",
        "Cannot close batch with " + batch.getCurrentCount() + " live animals"
    );
}
```

### ⚠️ Pièges fréquents

- Ne jamais utiliser `throw new RuntimeException(...)`. Toujours `BusinessException` ou enfants.
- Le `code` doit être **stable** et **machine-readable** (UPPER_SNAKE_CASE). C'est ce que le frontend va matcher.
- Le `message` peut être traduit (i18n) — voir Partie 5.

---

## 2.3 — `ProblemDetailResponse` (RFC 7807)

### 📝 Code complet

`common-api/src/main/java/com/avicare/common/api/error/ProblemDetailResponse.java` :

```java
package com.avicare.common.api.error;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.net.URI;
import java.time.Instant;
import java.util.Map;

/**
 * Réponse d'erreur conforme RFC 7807.
 *
 * Format JSON :
 *   {
 *     "type": "https://avicare.com/errors/batch-not-found",
 *     "title": "Batch Not Found",
 *     "status": 404,
 *     "detail": "Batch with id 42 not found",
 *     "instance": "/api/v1/batches/42",
 *     "code": "BATCH_NOT_FOUND",
 *     "traceId": "abc-123",
 *     "timestamp": "2026-...",
 *     "properties": { ... }
 *   }
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ProblemDetailResponse(
    URI type,
    String title,
    int status,
    String detail,
    URI instance,
    String code,
    String traceId,
    Instant timestamp,
    Map<String, Object> properties
) {

    public static Builder builder() {
        return new Builder();
    }

    public static class Builder {
        private URI type;
        private String title;
        private int status;
        private String detail;
        private URI instance;
        private String code;
        private String traceId;
        private Instant timestamp = Instant.now();
        private Map<String, Object> properties;

        public Builder type(URI type) { this.type = type; return this; }
        public Builder title(String title) { this.title = title; return this; }
        public Builder status(int status) { this.status = status; return this; }
        public Builder detail(String detail) { this.detail = detail; return this; }
        public Builder instance(URI instance) { this.instance = instance; return this; }
        public Builder code(String code) { this.code = code; return this; }
        public Builder traceId(String traceId) { this.traceId = traceId; return this; }
        public Builder properties(Map<String, Object> p) { this.properties = p; return this; }

        public ProblemDetailResponse build() {
            return new ProblemDetailResponse(
                type, title, status, detail, instance,
                code, traceId, timestamp, properties
            );
        }
    }
}
```

---

## 2.4 — `GlobalExceptionHandler`

### 🎯 But en 1 phrase

Centralise la conversion de **toutes** les exceptions en `ProblemDetailResponse`. Un seul endroit à modifier si on change le format d'erreur.

### 📝 Code complet

`common-api/src/main/java/com/avicare/common/api/error/GlobalExceptionHandler.java` :

```java
package com.avicare.common.api.error;

import com.avicare.common.api.exception.BusinessException;
import com.avicare.common.api.exception.ValidationException;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.net.URI;
import java.util.List;
import java.util.Map;

/**
 * Handler global d'exceptions.
 *
 * Transforme toute exception en Problem Details RFC 7807.
 * Log structuré avec correlation ID.
 */
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    private static final String ERROR_TYPE_BASE = "https://avicare.com/errors/";

    /**
     * Toutes nos exceptions métier.
     */
    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ProblemDetailResponse> handleBusiness(
        BusinessException ex,
        HttpServletRequest request
    ) {
        log.warn("Business exception [{}]: {}", ex.getCode(), ex.getMessage());

        ProblemDetailResponse body = buildProblem(ex, request);
        return ResponseEntity.status(ex.getStatus()).body(body);
    }

    /**
     * Validation Bean Validation (@Valid sur DTOs).
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ProblemDetailResponse> handleValidation(
        MethodArgumentNotValidException ex,
        HttpServletRequest request
    ) {
        List<ValidationException.FieldError> errors = ex.getBindingResult()
            .getFieldErrors()
            .stream()
            .map(fe -> new ValidationException.FieldError(
                fe.getField(),
                fe.getCode(),
                fe.getDefaultMessage()
            ))
            .toList();

        log.warn("Validation failed: {} field(s)", errors.size());

        ProblemDetailResponse body = ProblemDetailResponse.builder()
            .type(URI.create(ERROR_TYPE_BASE + "validation-failed"))
            .title("Validation Failed")
            .status(400)
            .detail("Request validation failed")
            .instance(URI.create(request.getRequestURI()))
            .code("VALIDATION_FAILED")
            .traceId(MDC.get("correlationId"))
            .properties(Map.of("errors", errors))
            .build();

        return ResponseEntity.badRequest().body(body);
    }

    /**
     * Spring Security AccessDeniedException (lancée par @PreAuthorize).
     */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ProblemDetailResponse> handleAccessDenied(
        AccessDeniedException ex,
        HttpServletRequest request
    ) {
        log.warn("Access denied: {}", request.getRequestURI());

        ProblemDetailResponse body = ProblemDetailResponse.builder()
            .type(URI.create(ERROR_TYPE_BASE + "access-denied"))
            .title("Access Denied")
            .status(403)
            .detail("You do not have permission to access this resource")
            .instance(URI.create(request.getRequestURI()))
            .code("ACCESS_DENIED")
            .traceId(MDC.get("correlationId"))
            .build();

        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(body);
    }

    /**
     * Spring Security AuthenticationException (token invalide, manquant, etc.).
     */
    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ProblemDetailResponse> handleAuthentication(
        AuthenticationException ex,
        HttpServletRequest request
    ) {
        log.warn("Authentication failed: {}", ex.getMessage());

        ProblemDetailResponse body = ProblemDetailResponse.builder()
            .type(URI.create(ERROR_TYPE_BASE + "authentication-failed"))
            .title("Authentication Failed")
            .status(401)
            .detail(ex.getMessage())
            .instance(URI.create(request.getRequestURI()))
            .code("AUTHENTICATION_FAILED")
            .traceId(MDC.get("correlationId"))
            .build();

        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(body);
    }

    /**
     * Catch-all : toute autre exception non gérée.
     * On ne révèle PAS les détails internes en prod.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ProblemDetailResponse> handleGeneric(
        Exception ex,
        HttpServletRequest request
    ) {
        log.error("Unhandled exception", ex);

        ProblemDetailResponse body = ProblemDetailResponse.builder()
            .type(URI.create(ERROR_TYPE_BASE + "internal-error"))
            .title("Internal Server Error")
            .status(500)
            .detail("An unexpected error occurred")
            .instance(URI.create(request.getRequestURI()))
            .code("INTERNAL_ERROR")
            .traceId(MDC.get("correlationId"))
            .build();

        return ResponseEntity.internalServerError().body(body);
    }

    private ProblemDetailResponse buildProblem(BusinessException ex, HttpServletRequest request) {
        String slug = ex.getCode().toLowerCase().replace('_', '-');

        return ProblemDetailResponse.builder()
            .type(URI.create(ERROR_TYPE_BASE + slug))
            .title(humanizeCode(ex.getCode()))
            .status(ex.getStatus().value())
            .detail(ex.getMessage())
            .instance(URI.create(request.getRequestURI()))
            .code(ex.getCode())
            .traceId(MDC.get("correlationId"))
            .properties(ex.getProperties().isEmpty() ? null : ex.getProperties())
            .build();
    }

    private String humanizeCode(String code) {
        // BATCH_NOT_FOUND -> "Batch Not Found"
        String[] parts = code.toLowerCase().split("_");
        StringBuilder sb = new StringBuilder();
        for (String p : parts) {
            if (sb.length() > 0) sb.append(' ');
            sb.append(Character.toUpperCase(p.charAt(0))).append(p.substring(1));
        }
        return sb.toString();
    }
}
```

### 🔄 Flux d'exécution

1. Une exception est lancée quelque part dans le code (service, controller, etc.)
2. Spring remonte l'exception jusqu'à `GlobalExceptionHandler`
3. Le bon `@ExceptionHandler` est sélectionné en fonction du type d'exception
4. Le handler construit un `ProblemDetailResponse` + log + retourne `ResponseEntity`
5. Le client reçoit le JSON RFC 7807

### ⚠️ Pièges fréquents

- **`@RestControllerAdvice` vs `@ControllerAdvice`** : utilise `@RestControllerAdvice` pour les API REST (pas de view resolution).
- **Order des handlers** : du plus spécifique au plus général. Le catch-all `Exception` doit être en dernier.
- **Ne JAMAIS exposer les stack traces** en prod. Le `log.error("Unhandled exception", ex)` log la stack côté serveur, mais le client ne reçoit que `"An unexpected error occurred"`.

---

## 2.5 — `CorrelationIdFilter`

### 🎯 But en 1 phrase

Pour chaque requête HTTP, génère ou réutilise un `X-Correlation-Id` qui suit la requête dans tous les logs et services.

### 📝 Code complet

`common-api/src/main/java/com/avicare/common/api/filter/CorrelationIdFilter.java` :

```java
package com.avicare.common.api.filter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

/**
 * Génère/lit un X-Correlation-Id et le met dans MDC pour les logs.
 * Filtre exécuté très tôt dans la chaîne (HIGHEST_PRECEDENCE).
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class CorrelationIdFilter extends OncePerRequestFilter {

    public static final String HEADER_NAME = "X-Correlation-Id";
    public static final String MDC_KEY = "correlationId";

    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain chain
    ) throws ServletException, IOException {

        // 1. Extract from header or generate
        String correlationId = request.getHeader(HEADER_NAME);
        if (correlationId == null || correlationId.isBlank()) {
            correlationId = UUID.randomUUID().toString();
        }

        // 2. Put in MDC for log correlation
        MDC.put(MDC_KEY, correlationId);

        // 3. Echo back in response header
        response.setHeader(HEADER_NAME, correlationId);

        try {
            chain.doFilter(request, response);
        } finally {
            // 4. Cleanup MDC to avoid leak between threads
            MDC.remove(MDC_KEY);
        }
    }
}
```

### 🔄 Configuration Logback pour utiliser le MDC

`avicare-app/src/main/resources/logback-spring.xml` :

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>

    <appender name="CONSOLE" class="ch.qos.logback.core.ConsoleAppender">
        <encoder>
            <pattern>
                %d{HH:mm:ss.SSS} [%thread] %-5level [%X{correlationId:-}] %logger{36} - %msg%n
            </pattern>
        </encoder>
    </appender>

    <root level="INFO">
        <appender-ref ref="CONSOLE"/>
    </root>

    <logger name="com.avicare" level="DEBUG"/>
</configuration>
```

**Le `%X{correlationId:-}`** : récupère la valeur de MDC `correlationId`, vide si absent.

### 🧪 Test

```java
@WebMvcTest
class CorrelationIdFilterTest {

    @Test
    void shouldGenerateIdIfMissing() throws Exception {
        mockMvc.perform(get("/api/v1/health"))
            .andExpect(header().exists("X-Correlation-Id"));
    }

    @Test
    void shouldEchoExistingId() throws Exception {
        mockMvc.perform(get("/api/v1/health")
                .header("X-Correlation-Id", "test-123"))
            .andExpect(header().string("X-Correlation-Id", "test-123"));
    }
}
```

### ⚠️ Pièges fréquents

- **Toujours `MDC.remove()` en `finally`**. Sinon le ThreadLocal fuit entre requêtes (les threads sont recyclés par Tomcat).
- **`@Order(HIGHEST_PRECEDENCE)`** pour que ce filtre s'exécute AVANT tout (sécurité, etc.).
- **Propagation outbound** : quand on fait du WebClient (Sprint A4+), il faudra propager le header. On verra ça plus tard.

---

# Partie 3 — `common-security`

> Le cœur de la sécurité. C'est la partie la plus dense, prends ton temps.

## 3.1 — Génération des clés RSA

### 🎯 But en 1 phrase

On signe les JWT avec une clé RSA privée et on les vérifie avec la clé publique correspondante.

### 🧠 Pourquoi RSA 2048 (et pas 4096) ?

- **2048 bits** : suffisant pour 99% des cas, performance correcte
- **4096 bits** : plus sécurisé mais ~5× plus lent à signer
- **Notre cas** : 2048 amplement suffisant pour un SaaS B2B sénégalais en 2026

### 📝 Générer les clés

**En local (dev) :**

```bash
# Dans backend/avicare-app/src/main/resources/keys/
mkdir -p backend/avicare-app/src/main/resources/keys
cd backend/avicare-app/src/main/resources/keys

# Génère la clé privée (PKCS#8 format, sans password pour le dev)
openssl genpkey -algorithm RSA -out jwt-private-key.pem -pkeyopt rsa_keygen_bits:2048

# Extrait la clé publique
openssl rsa -pubout -in jwt-private-key.pem -out jwt-public-key.pem
```

**Ajouter au `.gitignore` :**

```
# Clés JWT (jamais committées)
backend/avicare-app/src/main/resources/keys/
```

**En prod :** les clés viennent de variables d'environnement (`JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`) ou d'un secret manager (Vault, AWS Secrets Manager). Pas de fichier sur disque.

### 📝 Configuration Spring

`application-dev.yml` :

```yaml
avicare:
  security:
    jwt:
      private-key-path: classpath:keys/jwt-private-key.pem
      public-key-path: classpath:keys/jwt-public-key.pem
      issuer: avicare-platform
      access-token-ttl: 15m
      refresh-token-ttl: 7d
```

`application-prod.yml` :

```yaml
avicare:
  security:
    jwt:
      private-key: ${JWT_PRIVATE_KEY}    # contenu PEM en env var
      public-key: ${JWT_PUBLIC_KEY}
      issuer: avicare-platform
      access-token-ttl: 15m
      refresh-token-ttl: 7d
```

### 📝 `JwtProperties.java`

```java
package com.avicare.common.security.jwt;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "avicare.security.jwt")
public record JwtProperties(
    String issuer,
    Duration accessTokenTtl,
    Duration refreshTokenTtl,
    String privateKeyPath,
    String publicKeyPath,
    String privateKey,        // contenu PEM direct (prod, depuis env vars)
    String publicKey
) {}
```

> En Spring Boot 3.x, le binding constructor sur un `record` est par défaut — pas besoin d'`@ConstructorBinding` (déprécié). Activer le binding via `@EnableConfigurationProperties(JwtProperties.class)` sur une classe `@Configuration` (chez nous : `config/JwtConfig.java`). L'immutabilité est désirable ici puisque les champs portent du matériel cryptographique.

### 📝 `KeyLoader.java`

```java
package com.avicare.common.security.jwt;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;

@Component
@RequiredArgsConstructor
@Slf4j
public class KeyLoader {

    private final ResourceLoader resourceLoader;
    private final JwtProperties props;

    public RSAPrivateKey loadPrivateKey() {
        try {
            String pem = props.getPrivateKey() != null
                ? props.getPrivateKey()
                : readFromPath(props.getPrivateKeyPath());

            String cleaned = pem
                .replace("-----BEGIN PRIVATE KEY-----", "")
                .replace("-----END PRIVATE KEY-----", "")
                .replaceAll("\\s", "");

            byte[] decoded = Base64.getDecoder().decode(cleaned);
            PKCS8EncodedKeySpec spec = new PKCS8EncodedKeySpec(decoded);
            return (RSAPrivateKey) KeyFactory.getInstance("RSA").generatePrivate(spec);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to load JWT private key", e);
        }
    }

    public RSAPublicKey loadPublicKey() {
        try {
            String pem = props.getPublicKey() != null
                ? props.getPublicKey()
                : readFromPath(props.getPublicKeyPath());

            String cleaned = pem
                .replace("-----BEGIN PUBLIC KEY-----", "")
                .replace("-----END PUBLIC KEY-----", "")
                .replaceAll("\\s", "");

            byte[] decoded = Base64.getDecoder().decode(cleaned);
            X509EncodedKeySpec spec = new X509EncodedKeySpec(decoded);
            return (RSAPublicKey) KeyFactory.getInstance("RSA").generatePublic(spec);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to load JWT public key", e);
        }
    }

    private String readFromPath(String path) throws IOException {
        Resource resource = resourceLoader.getResource(path);
        try (InputStream is = resource.getInputStream()) {
            return new String(is.readAllBytes(), StandardCharsets.UTF_8);
        }
    }
}
```

---

## 3.2 — `JwtService`

### 🎯 But en 1 phrase

Génère et valide des JWT signés RS256, en travaillant directement sur `AvicarePrincipal` (sérialisation/désérialisation des claims encapsulée).

### 📝 Code complet

```java
package com.avicare.common.security.jwt;

import com.avicare.common.security.exception.ExpiredTokenException;
import com.avicare.common.security.exception.InvalidTokenException;
import com.avicare.common.security.exception.WrongTokenTypeException;
import com.avicare.common.security.principal.AvicarePrincipal;
import com.avicare.common.security.principal.Membership;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import jakarta.annotation.PostConstruct;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class JwtService {

    private static final String CLAIM_EMAIL = "email";
    private static final String CLAIM_ROLE = "role";
    private static final String CLAIM_MEMBERSHIPS = "memberships";
    private static final String CLAIM_TYPE = "type";
    private static final String TYPE_ACCESS = "access";
    private static final String TYPE_REFRESH = "refresh";

    private final JwtProperties props;
    private final KeyLoader keyLoader;
    private final ObjectMapper objectMapper;

    private RSAPrivateKey privateKey;
    private RSAPublicKey publicKey;

    /**
     * Charge les clés une fois au démarrage. En cas d'échec on log un WARN
     * et le service reste inerte (toute opération throw IllegalStateException
     * plus tard via requireKeys()). Permet à l'app de booter avant que les
     * clés ne soient provisionnées (Sprint A3).
     */
    @PostConstruct
    void init() {
        try {
            this.privateKey = keyLoader.loadPrivateKey();
            this.publicKey = keyLoader.loadPublicKey();
            log.info("JWT keys loaded successfully (RSA 2048)");
        } catch (RuntimeException e) {
            log.warn(
                "JWT keys not configured; JwtService is inert until keys are provided. Cause: {}",
                e.getMessage());
        }
    }

    /** Génère un access token court depuis un AvicarePrincipal complet. */
    public String generateAccessToken(AvicarePrincipal principal) {
        requireKeys();
        Instant now = Instant.now();
        Instant exp = now.plus(props.accessTokenTtl());

        return Jwts.builder()
            .issuer(props.issuer())
            .subject(principal.userId().toString())
            .id(UUID.randomUUID().toString())
            .issuedAt(Date.from(now))
            .expiration(Date.from(exp))
            .claims(Map.of(
                CLAIM_EMAIL, principal.email(),
                CLAIM_ROLE, principal.role(),
                CLAIM_MEMBERSHIPS, principal.memberships(),
                CLAIM_TYPE, TYPE_ACCESS))
            .signWith(privateKey, Jwts.SIG.RS256)
            .compact();
    }

    /** Génère un refresh token long ne portant que le userId. */
    public String generateRefreshToken(Long userId) {
        requireKeys();
        Instant now = Instant.now();
        Instant exp = now.plus(props.refreshTokenTtl());

        return Jwts.builder()
            .issuer(props.issuer())
            .subject(userId.toString())
            .id(UUID.randomUUID().toString())
            .issuedAt(Date.from(now))
            .expiration(Date.from(exp))
            .claims(Map.of(CLAIM_TYPE, TYPE_REFRESH))
            .signWith(privateKey, Jwts.SIG.RS256)
            .compact();
    }

    /**
     * Vérifie signature + issuer + expiration + type=access, et reconstruit
     * le principal depuis les claims.
     */
    public AvicarePrincipal validateAccessToken(String token) {
        Claims claims = parseClaims(token);
        requireType(claims, TYPE_ACCESS);

        Long userId = Long.parseLong(claims.getSubject());
        String email = claims.get(CLAIM_EMAIL, String.class);
        String role = claims.get(CLAIM_ROLE, String.class);
        List<Membership> memberships = objectMapper.convertValue(
            claims.get(CLAIM_MEMBERSHIPS), new TypeReference<List<Membership>>() {});

        return new AvicarePrincipal(userId, email, role, memberships);
    }

    /** Vérifie un refresh token et retourne le userId. */
    public Long validateRefreshToken(String token) {
        Claims claims = parseClaims(token);
        requireType(claims, TYPE_REFRESH);
        return Long.parseLong(claims.getSubject());
    }

    private Claims parseClaims(String token) {
        requireKeys();
        try {
            return Jwts.parser()
                .verifyWith(publicKey)
                .requireIssuer(props.issuer())
                .build()
                .parseSignedClaims(token)
                .getPayload();
        } catch (ExpiredJwtException e) {
            throw new ExpiredTokenException(e);
        } catch (JwtException | IllegalArgumentException e) {
            throw new InvalidTokenException(e.getMessage(), e);
        }
    }

    private void requireType(Claims claims, String expected) {
        String actual = claims.get(CLAIM_TYPE, String.class);
        if (!expected.equals(actual)) {
            throw new WrongTokenTypeException(expected, String.valueOf(actual));
        }
    }

    private void requireKeys() {
        if (privateKey == null || publicKey == null) {
            throw new IllegalStateException(
                "JwtService is not initialized: configure 'avicare.security.jwt.*' RSA keys.");
        }
    }
}
```

### 🛡️ Exceptions levées

Toutes les exceptions levées par les méthodes `validate*` héritent de `TokenValidationException` (`extends org.springframework.security.core.AuthenticationException`), elle-même mappée automatiquement 401 par le `GlobalExceptionHandler` de `common-api`.

| Cas | Exception | HTTP via handler |
|---|---|---|
| Signature invalide / token malformé / parse error | `InvalidTokenException` | 401 |
| TTL expirée | `ExpiredTokenException` | 401 |
| Type incorrect (access présenté à `validateRefresh` ou inverse) | `WrongTokenTypeException` | 401 |
| Clés non configurées au runtime | `IllegalStateException` (catch-all) | 500 |

### ⚠️ Pièges fréquents

- **`@PostConstruct` (jakarta.annotation)**, pas `@Autowired` : on initialise les clés UNE FOIS après injection des dépendances. `@Autowired` sur une méthode sans paramètres est un no-op.
- **`requireIssuer`** : sécurité supplémentaire, refuse les tokens d'un autre émetteur.
- **`Jwts.SIG.RS256`** : algorithme déduit de la clé RSA ; doit matcher entre génération et validation.
- **Ne JAMAIS logger un token complet**. C'est aussi sensible qu'un mot de passe.
- **Pas de `extractUserIdUnsafe`** : la version initiale du draft proposait une méthode qui extrayait le subject SANS valider la signature, utilisée pour un lookup blacklist. C'est un anti-pattern (vulnérable à la forge de tokens). Si une blacklist Redis est nécessaire en Session 4b, exposer une API qui valide d'abord puis retourne aussi le `jti` (ex. `record(AvicarePrincipal principal, String jti)`).

---

## 3.3 — `JwtFilter`

### 🎯 But en 1 phrase

Filtre Spring Security qui extrait le JWT de chaque requête, le valide, et met le user dans le contexte de sécurité.

> ⚠️ **À aligner en Session 4b** — Le code ci-dessous reflète le draft initial qui appelait `jwtService.validateAndExtract(token) → Claims` puis reconstruisait l'`AvicarePrincipal` localement via `buildPrincipal(claims)`. La PR #10 (Session 4a) a livré une API plus encapsulée : `jwtService.validateAccessToken(token) → AvicarePrincipal` qui throw directement `InvalidTokenException` / `ExpiredTokenException` / `WrongTokenTypeException`. Session 4b adaptera le filter en conséquence. Le check blacklist Redis sur le `jti` reste à concevoir (probablement un wrapper `record(AvicarePrincipal principal, String jti)` ou une méthode `validateAccessTokenWithJti(...)` côté `JwtService`).

### 📝 Code complet

```java
package com.avicare.common.security.jwt;

import com.avicare.common.security.principal.AvicarePrincipal;
import com.avicare.common.security.principal.Membership;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

@Component
@RequiredArgsConstructor
@Slf4j
public class JwtFilter extends OncePerRequestFilter {

    public static final String COOKIE_NAME = "avicare_access_token";
    public static final String HEADER_NAME = "Authorization";
    public static final String BEARER_PREFIX = "Bearer ";
    public static final String BLACKLIST_KEY_PREFIX = "jwt:blacklist:";

    private final JwtService jwtService;
    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper;

    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain chain
    ) throws ServletException, IOException {

        Optional<String> tokenOpt = extractToken(request);

        if (tokenOpt.isEmpty()) {
            chain.doFilter(request, response);
            return;
        }

        String token = tokenOpt.get();

        try {
            Claims claims = jwtService.validateAndExtract(token);

            // Check token type (must be "access")
            String type = claims.get("type", String.class);
            if (!"access".equals(type)) {
                log.warn("Invalid token type: {}", type);
                chain.doFilter(request, response);
                return;
            }

            // Check blacklist
            String jti = claims.getId();
            if (Boolean.TRUE.equals(redis.hasKey(BLACKLIST_KEY_PREFIX + jti))) {
                log.warn("Blacklisted token used: {}", jti);
                chain.doFilter(request, response);
                return;
            }

            // Build principal
            AvicarePrincipal principal = buildPrincipal(claims);

            // Build authentication
            UsernamePasswordAuthenticationToken auth =
                new UsernamePasswordAuthenticationToken(
                    principal.userId(),       // principal = userId (Long)
                    null,                     // credentials non utilisés
                    List.of(new SimpleGrantedAuthority("ROLE_" + principal.role()))
                );
            auth.setDetails(principal);       // principal complet dans details

            SecurityContextHolder.getContext().setAuthentication(auth);

        } catch (JwtException ex) {
            log.warn("Invalid JWT: {}", ex.getMessage());
            // Ne pas bloquer la requête ici : le @PreAuthorize rejettera plus loin
        }

        chain.doFilter(request, response);
    }

    private Optional<String> extractToken(HttpServletRequest request) {
        // 1. Try Authorization header first (mobile)
        String header = request.getHeader(HEADER_NAME);
        if (header != null && header.startsWith(BEARER_PREFIX)) {
            return Optional.of(header.substring(BEARER_PREFIX.length()));
        }

        // 2. Try cookie (web)
        if (request.getCookies() != null) {
            for (Cookie cookie : request.getCookies()) {
                if (COOKIE_NAME.equals(cookie.getName())) {
                    return Optional.of(cookie.getValue());
                }
            }
        }

        return Optional.empty();
    }

    @SuppressWarnings("unchecked")
    private AvicarePrincipal buildPrincipal(Claims claims) {
        Long userId = Long.parseLong(claims.getSubject());
        String email = claims.get("email", String.class);
        String role = claims.get("role", String.class);

        // Memberships sérialisés comme List<Map>, on les remap
        List<?> rawMemberships = claims.get("memberships", List.class);
        List<Membership> memberships = rawMemberships.stream()
            .map(m -> objectMapper.convertValue(m, Membership.class))
            .toList();

        return new AvicarePrincipal(userId, email, role, memberships);
    }
}
```

### 🔄 Flux d'exécution

1. Requête arrive avec `Authorization: Bearer eyJ...` ou cookie `avicare_access_token`
2. `JwtFilter` extract le token
3. `JwtService.validateAndExtract()` vérifie signature + expiration
4. Check Redis blacklist (token révoqué ?)
5. Build `AvicarePrincipal` depuis les claims
6. Met dans `SecurityContextHolder`
7. Chain.doFilter() → la requête continue

Si quoi que ce soit échoue : on log et on continue **sans** mettre l'auth. Le `@PreAuthorize` rejettera plus tard avec `AccessDeniedException`.

---

## 3.4 — `UserRole`, `FarmRole`, `AvicarePrincipal` et `Membership`

> Le RBAC repose sur **deux enums typés** (cf. Décisions 11 et 12 du doc `00-vision-strategique`) :
> `UserRole` pour le rôle plateforme porté dans le JWT, `FarmRole` pour le rôle tenant porté par
> chaque `Membership`. On ne compare plus de strings magiques (`"SUPER_ADMIN"`, `"OWNER"`...).

### 📝 Code complet

`UserRole.java` — rôle plateforme à **2 niveaux** (YAGNI V1) :

```java
package com.avicare.common.security.principal;

/**
 * Platform-level role carried in the JWT.
 *
 * <p>Two-level system (YAGNI for V1): every actual user is a {@link #USER}; only AviCare platform
 * staff is {@link #ADMIN}. Tenant-level authority is handled separately by {@link FarmRole} via
 * the per-farm {@link Membership}s.
 */
public enum UserRole {

  /** AviCare platform staff. Bypasses every tenant-level access check. */
  ADMIN,

  /** Standard user. Access is scoped to their farm memberships. */
  USER
}
```

`FarmRole.java` — rôle tenant à **5 personas** + `defaultPermissions()` :

```java
package com.avicare.common.security.principal;

import java.util.List;

/**
 * Tenant-level role inside a single farm (OWNER, MANAGER, FARMER, VETERINARIAN, BUYER).
 *
 * <p>{@link #defaultPermissions()} returns the baseline {@code resource:verb} permissions granted
 * when the role is assigned. They are stored on each {@code Membership} and can be overridden per
 * row (JSONB column {@code user_farm.permissions}) without changing the role itself. The defaults
 * are deliberately conservative for V1 and will be enriched in Sprint B+.
 */
public enum FarmRole {
  OWNER,
  MANAGER,
  FARMER,
  VETERINARIAN,
  BUYER;

  /**
   * Baseline {@code resource:verb} permissions for this role. {@code "*"} = full access (OWNER),
   * {@code "resource:*"} = every verb on the resource, {@code "resource:verb"} = specific verb.
   * BUYER scoping ("sees only their own orders") is enforced at the service layer, not by RBAC.
   */
  public List<String> defaultPermissions() {
    return switch (this) {
      case OWNER -> List.of("*");
      case MANAGER ->
          List.of(
              "poultry:*",
              "health:*",
              "commercial:*",
              "inventory:*",
              "finance:read",
              "settings:read");
      case FARMER ->
          List.of("poultry:read", "poultry:write", "health:read", "health:write");
      case VETERINARIAN -> List.of("health:read", "health:write", "poultry:read");
      case BUYER -> List.of("commercial:read", "finance:read");
    };
  }
}
```

`AvicarePrincipal.java` — `role` est désormais un `UserRole`, le record est immutable (constructeur
compact défensif), `isSuperAdmin()` a disparu au profit de `isAdmin()`, et `membershipOf()` expose
le membership d'une ferme :

```java
package com.avicare.common.security.principal;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

/**
 * Authenticated user representation, built by the JWT layer and carried through the request.
 *
 * <p>The {@code role} field is the platform-wide role (see {@link UserRole}). Per-farm authority
 * lives in {@link Membership}s — one per (user, farm) couple. {@code memberships} is defensively
 * copied; the record is fully immutable.
 */
public record AvicarePrincipal(
    Long userId, String email, UserRole role, List<Membership> memberships) {

  public AvicarePrincipal {
    Objects.requireNonNull(userId, "userId must not be null");
    Objects.requireNonNull(role, "role must not be null");
    Objects.requireNonNull(memberships, "memberships must not be null");
    memberships = List.copyOf(memberships);
  }

  /** Whether the user is platform staff (bypasses every tenant-level check). */
  public boolean isAdmin() {
    return role == UserRole.ADMIN;
  }

  /** This user's membership on the given farm, if any. */
  public Optional<Membership> membershipOf(Long farmId) {
    return memberships.stream().filter(m -> m.farmId().equals(farmId)).findFirst();
  }

  /**
   * Whether the user can reach the given farm. Platform admins always return {@code true};
   * everyone else needs a membership on it.
   */
  public boolean hasFarmAccess(Long farmId) {
    return isAdmin() || membershipOf(farmId).isPresent();
  }

  /** Farm identifiers the user has any membership on. Empty for users with no memberships. */
  public List<Long> accessibleFarmIds() {
    return memberships.stream().map(Membership::farmId).toList();
  }
}
```

`Membership.java` — `farmRole` est désormais un `FarmRole`, le record est immutable, et `hasRole()`
teste l'appartenance à un ensemble de rôles candidats :

```java
package com.avicare.common.security.principal;

import java.util.List;
import java.util.Objects;

/**
 * One user-to-farm membership: the user's role on a single farm and the explicit permissions
 * granted on that farm.
 *
 * <p>Permission format is {@code "resource:verb"} (e.g. {@code "poultry:write"}); {@code "*"} grants
 * everything and {@code "<resource>:*"} grants every verb on a resource. {@code permissions} is
 * defensively copied. They are typically initialized from {@link FarmRole#defaultPermissions()} at
 * sign-up time and stored on {@code user_farm.permissions} (JSONB), overridable per row.
 */
public record Membership(Long farmId, FarmRole farmRole, List<String> permissions) {

  public Membership {
    Objects.requireNonNull(farmId, "farmId must not be null");
    Objects.requireNonNull(farmRole, "farmRole must not be null");
    Objects.requireNonNull(permissions, "permissions must not be null");
    permissions = List.copyOf(permissions);
  }

  /** Whether this membership grants the given permission, honoring {@code *} wildcards. */
  public boolean hasPermission(String permission) {
    Objects.requireNonNull(permission, "permission must not be null");
    if (permissions.contains("*")) {
      return true;
    }
    int colon = permission.indexOf(':');
    if (colon > 0) {
      String resourceWildcard = permission.substring(0, colon) + ":*";
      if (permissions.contains(resourceWildcard)) {
        return true;
      }
    }
    return permissions.contains(permission);
  }

  /**
   * Whether this membership's role is one of the given candidates.
   *
   * <p>Used by {@code FarmAccessChecker.hasRole(farmId, FarmRole...)} (Session 4b-1) for SpEL
   * expressions in {@code @PreAuthorize}.
   */
  public boolean hasRole(FarmRole... candidates) {
    for (FarmRole candidate : candidates) {
      if (this.farmRole == candidate) {
        return true;
      }
    }
    return false;
  }
}
```

### 🔄 Usage dans un controller

```java
@GetMapping("/me")
public ApiResponse<UserMeResponse> me(@AuthenticationPrincipal Long userId) {
    // Avec @AuthenticationPrincipal sur Long, on récupère juste l'userId
    return ApiResponse.of(userService.getMe(userId));
}

@GetMapping("/me/full")
public ApiResponse<?> meFull(Authentication auth) {
    // Pour récupérer le principal complet
    AvicarePrincipal principal = (AvicarePrincipal) auth.getDetails();
    return ApiResponse.of(principal);
}
```

---

## 3.5 — `FarmAccessChecker` (bean SpEL `@farmAccess`)

### 🎯 But en 1 phrase

C'est LE bean appelé depuis toutes les annotations `@PreAuthorize` pour vérifier les permissions tenant.

### 📝 Code complet

```java
package com.avicare.common.security.access;

import com.avicare.common.security.principal.AvicarePrincipal;
import com.avicare.common.security.principal.FarmRole;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/**
 * Bean SpEL pour la vérification des permissions tenant.
 *
 * Usage : @PreAuthorize("@farmAccess.hasPermission(#farmId, 'poultry:write')")
 *
 * Le principal courant est lu depuis Authentication.getDetails() (alimenté par
 * le JwtFilter — Session 4b-2). Les admins plateforme (isAdmin()) bypassent
 * tout ; sinon l'accès est borné au Membership de la ferme. Sans principal
 * authentifié, toutes les méthodes refusent (fail-closed).
 */
@Component("farmAccess")
@Slf4j
public class FarmAccessChecker {

    /** Vrai si l'utilisateur courant détient la permission "resource:verb" sur la ferme. */
    public boolean hasPermission(Long farmId, String permission) {
        AvicarePrincipal principal = currentPrincipal();
        if (principal == null) return false;

        // Admin plateforme : bypass complet
        if (principal.isAdmin()) {
            log.debug("Access granted via platform ADMIN for user {}", principal.userId());
            return true;
        }

        return principal.membershipOf(farmId)
            .map(m -> m.hasPermission(permission))
            .orElse(false);
    }

    /** Vrai si l'utilisateur a AU MOINS UNE des permissions listées. */
    public boolean hasAnyPermission(Long farmId, String... permissions) {
        for (String perm : permissions) {
            if (hasPermission(farmId, perm)) return true;
        }
        return false;
    }

    /** Vrai si l'utilisateur a TOUTES les permissions listées. */
    public boolean hasAllPermissions(Long farmId, String... permissions) {
        for (String perm : permissions) {
            if (!hasPermission(farmId, perm)) return false;
        }
        return true;
    }

    /** Vrai si l'utilisateur peut simplement atteindre la ferme (membership, ou admin). */
    public boolean hasAccess(Long farmId) {
        AvicarePrincipal principal = currentPrincipal();
        return principal != null && principal.hasFarmAccess(farmId);
    }

    /** Vrai si le rôle de l'utilisateur sur la ferme est l'un des candidats (admins bypassent). */
    public boolean hasRole(Long farmId, FarmRole... candidates) {
        AvicarePrincipal principal = currentPrincipal();
        if (principal == null) return false;
        if (principal.isAdmin()) return true;
        return principal.membershipOf(farmId)
            .map(m -> m.hasRole(candidates))
            .orElse(false);
    }

    private AvicarePrincipal currentPrincipal() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) return null;
        return auth.getDetails() instanceof AvicarePrincipal p ? p : null;
    }
}
```

### 📝 `PermissionConstants.java` (organisation)

```java
package com.avicare.common.security.access;

/**
 * Constantes des permissions disponibles.
 * Format : "resource:verb"
 */
public final class PermissionConstants {

    private PermissionConstants() {}

    // Poultry
    public static final String POULTRY_READ = "poultry:read";
    public static final String POULTRY_WRITE = "poultry:write";
    public static final String POULTRY_DELETE = "poultry:delete";

    // Health
    public static final String HEALTH_READ = "health:read";
    public static final String HEALTH_WRITE = "health:write";

    // Commercial
    public static final String COMMERCIAL_READ = "commercial:read";
    public static final String COMMERCIAL_WRITE = "commercial:write";

    // Inventory
    public static final String INVENTORY_READ = "inventory:read";
    public static final String INVENTORY_WRITE = "inventory:write";

    // Finance
    public static final String FINANCE_READ = "finance:read";
    public static final String FINANCE_WRITE = "finance:write";

    // Settings
    public static final String SETTINGS_READ = "settings:read";
    public static final String SETTINGS_WRITE = "settings:write";

    // Wildcards
    public static final String ALL = "*";
}
```

### 🧪 Tests unitaires complets

```java
package com.avicare.common.security.access;

import com.avicare.common.security.principal.AvicarePrincipal;
import com.avicare.common.security.principal.FarmRole;
import com.avicare.common.security.principal.Membership;
import com.avicare.common.security.principal.UserRole;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class FarmAccessCheckerTest {

    private final FarmAccessChecker checker = new FarmAccessChecker();

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void platformAdminBypassesEveryCheck() {
        setPrincipal(new AvicarePrincipal(1L, "admin@avicare.com", UserRole.ADMIN, List.of()));

        assertThat(checker.hasPermission(99L, "poultry:write")).isTrue();
        assertThat(checker.hasAccess(99L)).isTrue();
        assertThat(checker.hasRole(99L, FarmRole.BUYER)).isTrue();
    }

    @Test
    void userWithExactPermissionGetsAccess() {
        setPrincipal(new AvicarePrincipal(
            2L, "user@avicare.com", UserRole.USER,
            List.of(new Membership(42L, FarmRole.FARMER, List.of("poultry:write")))
        ));

        assertThat(checker.hasPermission(42L, "poultry:write")).isTrue();
        assertThat(checker.hasPermission(42L, "poultry:read")).isFalse();
        assertThat(checker.hasPermission(99L, "poultry:write")).isFalse();
    }

    @Test
    void userWithWildcardResourceGetsAccess() {
        setPrincipal(new AvicarePrincipal(
            3L, "manager@avicare.com", UserRole.USER,
            List.of(new Membership(42L, FarmRole.MANAGER, List.of("poultry:*")))
        ));

        assertThat(checker.hasPermission(42L, "poultry:read")).isTrue();
        assertThat(checker.hasPermission(42L, "poultry:delete")).isTrue();
        assertThat(checker.hasPermission(42L, "health:write")).isFalse();
    }

    @Test
    void userWithStarPermissionGetsEverything() {
        setPrincipal(new AvicarePrincipal(
            4L, "owner@avicare.com", UserRole.USER,
            List.of(new Membership(42L, FarmRole.OWNER, List.of("*")))
        ));

        assertThat(checker.hasPermission(42L, "poultry:write")).isTrue();
        assertThat(checker.hasPermission(42L, "anything:anything")).isTrue();
    }

    @Test
    void hasRoleMatchesMembershipRoleOnTargetFarm() {
        setPrincipal(new AvicarePrincipal(
            5L, "vet@avicare.com", UserRole.USER,
            List.of(new Membership(42L, FarmRole.VETERINARIAN, List.of("health:read")))
        ));

        assertThat(checker.hasRole(42L, FarmRole.VETERINARIAN)).isTrue();
        assertThat(checker.hasRole(42L, FarmRole.OWNER, FarmRole.MANAGER)).isFalse();
        assertThat(checker.hasRole(99L, FarmRole.VETERINARIAN)).isFalse();
    }

    @Test
    void noAuthenticationDeniesAccess() {
        assertThat(checker.hasPermission(42L, "poultry:write")).isFalse();
        assertThat(checker.hasAccess(42L)).isFalse();
        assertThat(checker.hasRole(42L, FarmRole.OWNER)).isFalse();
    }

    private void setPrincipal(AvicarePrincipal principal) {
        var auth = new UsernamePasswordAuthenticationToken(
            principal.userId(), null, List.of()
        );
        auth.setDetails(principal);
        SecurityContextHolder.getContext().setAuthentication(auth);
    }
}
```

---

## 3.6 — `@RequireServiceAuth` (squelette s2s)

### 🎯 But en 1 phrase

Annotation pour les endpoints internes service-to-service (futur). En Sprint A2, on crée juste le squelette.

### 📝 Code minimal

`RequireServiceAuth.java` :

```java
package com.avicare.common.security.s2s;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
public @interface RequireServiceAuth {
    String[] allowedAudiences() default {};
}
```

`ServiceAuthInterceptor.java` (squelette) :

```java
package com.avicare.common.security.s2s;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Interceptor pour les endpoints @RequireServiceAuth.
 * SQUELETTE Sprint A2 — l'implémentation complète arrive plus tard.
 */
@Component
public class ServiceAuthInterceptor implements HandlerInterceptor {

    @Override
    public boolean preHandle(
        HttpServletRequest request,
        HttpServletResponse response,
        Object handler
    ) {
        if (!(handler instanceof HandlerMethod handlerMethod)) {
            return true;
        }

        RequireServiceAuth annotation = handlerMethod.getMethodAnnotation(RequireServiceAuth.class);
        if (annotation == null) {
            return true;  // pas concerné
        }

        // TODO Sprint suivant : valider JWT HS256 scoped, nonce store, audience strict
        // Pour l'instant, on bloque par défaut pour ne pas exposer en sécurité par défaut
        response.setStatus(501);  // Not Implemented
        return false;
    }
}
```

---

## 3.7 — `SecurityConfig`

### 🎯 But en 1 phrase

Configuration centrale de Spring Security : chaîne de filtres, routes publiques/protégées, CORS, intégration du `JwtFilter`.

### 📝 Code complet

```java
package com.avicare.common.security.config;

import com.avicare.common.security.jwt.JwtFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity  // active @PreAuthorize
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtFilter jwtFilter;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(csrf -> csrf.disable())   // stateless, pas besoin CSRF
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                .requestMatchers(
                    "/api/v1/auth/signup",
                    "/api/v1/auth/login",
                    "/api/v1/auth/refresh"
                ).permitAll()
                .requestMatchers("/api/public/**").permitAll()
                .requestMatchers("/actuator/health", "/actuator/info").permitAll()
                .requestMatchers("/swagger-ui/**", "/v3/api-docs/**").permitAll()
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);  // strong work factor
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        // En dev, accepte localhost. En prod, sera surchargé par env vars.
        config.setAllowedOrigins(List.of(
            "http://localhost:3000",   // Next.js dev
            "http://localhost:19006"   // Expo dev
        ));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setExposedHeaders(List.of("X-Correlation-Id"));
        config.setAllowCredentials(true);  // pour les cookies httpOnly
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
```

### ⚠️ Action requise : retirer l'exclude au démarrage Sprint A2

Dans `AvicareApplication.java`, retirer :

```java
// AVANT (Sprint A1)
@SpringBootApplication(exclude = {SecurityAutoConfiguration.class})

// APRÈS (Sprint A2)
@SpringBootApplication
```

Avec la `SecurityConfig` qu'on vient de créer, l'auto-config Spring Security est désormais **utile** : elle pré-configure plein de choses qu'on personnalise.

---

## 3.8 — Cookies httpOnly vs Authorization header

### 🧠 Stratégie hybride

| Client | Méthode auth | Pourquoi |
|---|---|---|
| **Web Next.js** | Cookie httpOnly `avicare_access_token` | Protection XSS (JS ne peut pas lire le token) |
| **Mobile React Native** | Header `Authorization: Bearer ...` | Pas de notion de cookie sur mobile, stocké en secure storage |
| **Postman/curl tests** | Header `Authorization: Bearer ...` | Plus simple à utiliser |

### 📝 Configuration des cookies (côté auth controller)

À implémenter au Sprint A3 (auth), pour info :

```java
// Login response sets cookie
Cookie cookie = new Cookie(JwtFilter.COOKIE_NAME, accessToken);
cookie.setHttpOnly(true);
cookie.setSecure(true);          // HTTPS only (en prod)
cookie.setPath("/api/");
cookie.setMaxAge(900);           // 15 min en secondes
response.addCookie(cookie);

// Pour SameSite (pas exposé par Cookie API standard), utiliser l'header
response.setHeader("Set-Cookie",
    "avicare_access_token=" + accessToken +
    "; HttpOnly; Secure; SameSite=Lax; Path=/api/; Max-Age=900");
```

---

## Annexe — Évolutions du doc 05 après implémentation

Plusieurs décisions d'implémentation ont divergé du draft initial. Cette annexe en garde la trace pour qu'un lecteur revenant sur le doc n'ait pas à recroiser code et historique Git.

| Section | Décision initiale | Décision actuelle | Justification | Trace |
|---|---|---|---|---|
| §3.1 `JwtProperties` | `@Data class` mutable | `record` immutable | Convention Spring Boot 3.x (constructor binding), cohérence codebase (`TenantData`, `AvicarePrincipal`, `Membership`, etc.), immutabilité pour un objet portant du matériel crypto | PR #10 |
| §3.2 `JwtService` — API jjwt | 0.11 (`.setX(...)`, `parserBuilder`, `parseClaimsJws`) | 0.12 (`.X(...)`, `Jwts.parser()`, `verifyWith`, `parseSignedClaims`) | Le parent pom gère `jjwt-bom 0.12.6` ; l'API 0.11 ne compile pas | PR #10 |
| §3.2 `JwtService.init()` | `@Autowired` | `@PostConstruct` + try/catch graceful | `@Autowired` sur méthode sans paramètres est un no-op (bug du draft). Le try/catch permet à l'app de booter sans clés configurées (Sprint A3 les provisionnera) | PR #10 |
| §3.2 `JwtService` surface API | `(Long, String, String, List<Membership>)` + `Claims` | `(AvicarePrincipal)` + `AvicarePrincipal` | Encapsule la sérialisation/désérialisation des memberships dans `JwtService`, supprime la plomberie `buildPrincipal(claims)` côté `JwtFilter` | PR #10 |
| §3.2 `extractUserIdUnsafe` | Présent | Supprimé | Anti-pattern (extraction sans validation de signature). Si une blacklist Redis a besoin du `jti`, exposer une API qui valide d'abord et retourne aussi le `jti` | PR #10 |
| §4.1 `TenancyContext` | Thin facade sur `SecurityContextHolder` + import `AvicarePrincipal` | Store ThreadLocal autonome + record `TenantData` neutre | Le draft créait un cycle d'imports `common-tenancy → common-security → common-tenancy` qui contredit §0.4 | PR #8 + PR #9 |
| §3.4 `AvicarePrincipal` / `Membership` | `role: String`, `farmRole: String`, `isSuperAdmin()` | `role: UserRole`, `farmRole: FarmRole`, enums `UserRole`/`FarmRole` (+ `defaultPermissions()`), `membershipOf()`, `hasRole(FarmRole...)`, constructeurs compacts immutables | Refactor RBAC en enums typés (Décisions 11-12 du doc 00), supprime les strings magiques, prépare `FarmAccessChecker` (Session 4b-1) | PR #12 + cette PR |
| §3.5 `FarmAccessChecker` | `isSuperAdmin()`, stream sur `memberships()`, rôles String dans les tests | `isAdmin()`, `membershipOf(farmId)`, ajout `hasRole(Long, FarmRole...)`, tests sur enums | Alignement sur le refactor RBAC (PR #12) ; `hasRole` honore le contrat annoncé dans le javadoc de `Membership.hasRole` | Session 4b-1 |

> §3.4 et §3.5 sont alignés. §3.3 (`JwtFilter`) sera aligné après Session 4b-2.

*Cette annexe est à mettre à jour par chaque PR qui ré-aligne la spec sur l'implémentation.*

---

# Partie 4 — `common-tenancy`

## 4.1 — `TenancyContext`

### 🎯 But en 1 phrase

Helper static qui expose le user courant et ses fermes accessibles depuis n'importe où dans le code, alimenté par le `JwtFilter` à chaque requête.

### 🧠 Choix d'implémentation

Le module `common-tenancy` possède **son propre `ThreadLocal`** plutôt que de déléguer à `SecurityContextHolder` de Spring Security. Raison : `SecurityContextHolder` n'est peuplé qu'avec un `Authentication` Spring, et lire le `principal` complet (`AvicarePrincipal`) depuis `common-tenancy` exigerait d'importer du `common-security` — ce qui contredit l'ordre des dépendances établi en §0.4 (`common-security → common-tenancy`). En gardant un store neutre (record `TenantData`), `common-tenancy` reste indépendant et `common-security` (Sprint A2 Session 4b) sera le seul à `set()` et `clear()`.

### 📝 Code complet

`common-tenancy/src/main/java/com/avicare/common/tenancy/context/TenantData.java` :

```java
package com.avicare.common.tenancy.context;

import java.util.List;
import java.util.Objects;

/**
 * Immutable per-request tenancy data, stored in {@link TenancyContext}.
 *
 * @param userId            identifier of the authenticated user
 * @param accessibleFarmIds farms the user has access to (empty list = none)
 * @param isSuperAdmin      true when the user bypasses farm-scoping
 */
public record TenantData(Long userId, List<Long> accessibleFarmIds, boolean isSuperAdmin) {

    public TenantData {
        Objects.requireNonNull(userId, "userId must not be null");
        Objects.requireNonNull(accessibleFarmIds, "accessibleFarmIds must not be null");
        accessibleFarmIds = List.copyOf(accessibleFarmIds);
    }
}
```

`common-tenancy/src/main/java/com/avicare/common/tenancy/context/TenancyContext.java` :

```java
package com.avicare.common.tenancy.context;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

/**
 * ThreadLocal store for the current request's tenancy data.
 * Populated by the JwtFilter (common-security) and read by services.
 *
 * Producers MUST clear the context in a finally block — recycled Tomcat
 * threads will otherwise leak tenancy between requests.
 */
public final class TenancyContext {

    private static final ThreadLocal<TenantData> CONTEXT = new ThreadLocal<>();

    private TenancyContext() {}

    public static void set(TenantData data) {
        Objects.requireNonNull(data, "TenantData must not be null");
        CONTEXT.set(data);
    }

    public static TenantData get() {
        TenantData data = CONTEXT.get();
        if (data == null) {
            throw new IllegalStateException(
                "No tenancy context bound to the current thread. " +
                "Did the authentication filter run, and did it call TenancyContext.set(...)?");
        }
        return data;
    }

    public static Optional<TenantData> tryGet() {
        return Optional.ofNullable(CONTEXT.get());
    }

    public static boolean isSet() {
        return CONTEXT.get() != null;
    }

    public static void clear() {
        CONTEXT.remove();
    }

    public static Long currentUserId()       { return get().userId(); }
    public static List<Long> accessibleFarmIds() { return get().accessibleFarmIds(); }
    public static boolean isSuperAdmin()     { return get().isSuperAdmin(); }
}
```

### 🔄 Producer pattern obligatoire (JwtFilter, Session 4b)

Tout code qui peuple `TenancyContext` DOIT le faire dans un `try/finally`. `clear()` appelle `ThreadLocal.remove()` (jamais `set(null)`, qui laisserait une entrée dangling dans le map des thread-locals).

```java
try {
    TenancyContext.set(tenantData);
    chain.doFilter(request, response);
} finally {
    TenancyContext.clear();
}
```

Oublier le `clear()` est un **bug multi-tenant** : la requête suivante servie par le même thread voit la tenancy précédente. Le test `TenancyContextTest.isolatesBetweenThreads` couvre cette garantie.

### 🔄 Usage dans un service

```java
@Service
@RequiredArgsConstructor
public class BatchService {

    private final BatchRepository batchRepo;

    @Transactional(readOnly = true)
    public List<BatchResponse> findAccessible() {
        if (TenancyContext.isSuperAdmin()) {
            return batchRepo.findAll().stream().map(mapper::toResponse).toList();
        }

        List<Long> farmIds = TenancyContext.accessibleFarmIds();
        return batchRepo.findByFarmIdIn(farmIds).stream()
            .map(mapper::toResponse)
            .toList();
    }
}
```

### ℹ️ Note d'évolution

Le draft initial de cette section codait `TenancyContext` comme un thin facade au-dessus de `SecurityContextHolder`, lisant un `AvicarePrincipal` depuis `Authentication.getDetails()`. Cette forme importait `com.avicare.common.security.principal.AvicarePrincipal` depuis `common-tenancy`, ce qui inversait l'ordre des dépendances de §0.4 (cycle `common-tenancy → common-security → common-tenancy`) et bloquait l'implémentation tant que `common-security` n'existait pas.

L'implémentation actuelle — décidée et livrée en Sprint A2 Session 3 (commit `134d8ac`, PR #8) — résout le cycle en donnant à `common-tenancy` son propre store. `common-security` (Session 4b) viendra peupler le contexte depuis `JwtFilter` via le pattern `try/finally` ci-dessus.

---

## 4.2 — `NoAccessibleFarmException`

```java
package com.avicare.common.tenancy.exception;

import com.avicare.common.api.exception.ForbiddenException;

public class NoAccessibleFarmException extends ForbiddenException {

    public NoAccessibleFarmException() {
        super("NO_ACCESSIBLE_FARM", "User has no accessible farm");
    }
}
```

---

# Partie 5 — `common-i18n`

## 5.1 — Messages properties

`common-i18n/src/main/resources/messages.properties` (défaut, FR) :

```properties
# Validation
validation.notblank=Ce champ est obligatoire
validation.notnull=Ce champ ne peut pas être null
validation.size=La taille doit être entre {min} et {max} caractères
validation.email=Format email invalide
validation.positive=La valeur doit être positive

# Errors
error.batch.notfound=Le lot {0} est introuvable
error.farm.notfound=La ferme {0} est introuvable
error.access.denied=Accès refusé
error.feature.forbidden=Cette fonctionnalité n'est pas incluse dans votre abonnement
```

`messages_en.properties` :

```properties
validation.notblank=This field is required
validation.notnull=This field cannot be null
validation.size=Size must be between {min} and {max} characters
validation.email=Invalid email format
validation.positive=Value must be positive

error.batch.notfound=Batch {0} not found
error.farm.notfound=Farm {0} not found
error.access.denied=Access denied
error.feature.forbidden=This feature is not included in your subscription
```

`messages_wo.properties` (vide pour V2) :

```properties
# Placeholder pour Wolof - à traduire en V2
```

## 5.2 — `I18nConfig`

```java
package com.avicare.common.i18n.config;

import org.springframework.context.MessageSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.support.ResourceBundleMessageSource;
import org.springframework.web.servlet.LocaleResolver;
import org.springframework.web.servlet.i18n.AcceptHeaderLocaleResolver;

import java.util.List;
import java.util.Locale;

@Configuration
public class I18nConfig {

    @Bean
    public MessageSource messageSource() {
        ResourceBundleMessageSource ms = new ResourceBundleMessageSource();
        ms.setBasenames("messages");
        ms.setDefaultEncoding("UTF-8");
        ms.setUseCodeAsDefaultMessage(true);  // fallback : retourne le code si absent
        return ms;
    }

    @Bean
    public LocaleResolver localeResolver() {
        AcceptHeaderLocaleResolver resolver = new AcceptHeaderLocaleResolver();
        resolver.setDefaultLocale(Locale.FRENCH);
        resolver.setSupportedLocales(List.of(
            Locale.FRENCH,
            Locale.ENGLISH,
            new Locale("wo")  // wolof
        ));
        return resolver;
    }
}
```

## 5.3 — `MessageService`

```java
package com.avicare.common.i18n.service;

import lombok.RequiredArgsConstructor;
import org.springframework.context.MessageSource;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.stereotype.Service;

import java.util.Locale;

@Service
@RequiredArgsConstructor
public class MessageService {

    private final MessageSource messageSource;

    public String get(String key) {
        return get(key, new Object[0]);
    }

    public String get(String key, Object... args) {
        Locale locale = LocaleContextHolder.getLocale();
        return messageSource.getMessage(key, args, key, locale);
    }
}
```

---

# Partie 6 — Feature gating

## 6.1 — Concept

Rappel doc 00 : on a une table `entitlements` avec :
- `subscription_id`
- `feature_key` (ex: `module.poultry.broiler`)
- `feature_kind` (BOOLEAN ou QUOTA)
- `enforcement_mode` (OFF, SHADOW, SOFT, HARD)
- `enabled`, `quota_value`

## 6.2 — `FeatureChecker` (bean SpEL `@features`)

### 📝 Squelette pour Sprint A2

L'implémentation complète arrive au Sprint A4 (quand `subscription` bounded context sera prêt). En A2, on crée juste le contrat.

```java
package com.avicare.common.security.access;

import com.avicare.common.api.exception.FeatureForbiddenException;
import org.springframework.stereotype.Component;

@Component("features")
public class FeatureChecker {

    /**
     * Vérifie si une feature est activée pour une ferme.
     *
     * Sprint A2 : tout retourne true (pas de check).
     * Sprint A4 : implémentation réelle avec lookup entitlements.
     */
    public boolean isEnabled(Long farmId, String featureKey) {
        // TODO Sprint A4 : lookup entitlements + appliquer enforcement mode
        return true;
    }

    /**
     * Vérifie ou throw.
     */
    public void requireEnabled(Long farmId, String featureKey) {
        if (!isEnabled(farmId, featureKey)) {
            throw new FeatureForbiddenException(featureKey);
        }
    }
}
```

### 🔄 Usage dans un controller (Sprint A2+)

```java
@PostMapping
@PreAuthorize(
    "@farmAccess.hasPermission(#req.farmId(), 'poultry:write') and " +
    "@features.isEnabled(#req.farmId(), 'module.poultry.broiler')"
)
public ApiResponse<BatchResponse> create(@RequestBody @Valid CreateBatchRequest req) {
    return ApiResponse.of(batchService.create(req));
}
```

---

# Partie 7 — Récap & Sprint A2

## 7.1 — Checklist d'implémentation Sprint A2 (ordre)

L'ordre suit les dépendances entre modules :

1. **common-i18n** (1-2 jours)
   - [ ] Messages properties FR/EN/WO
   - [ ] `I18nConfig` + `MessageService`
   - [ ] Test simple

2. **common-api** (2-3 jours)
   - [ ] `ApiResponse<T>`, `PageResponse<T>`
   - [ ] Hiérarchie d'exceptions (8 classes)
   - [ ] `ProblemDetailResponse` record
   - [ ] `GlobalExceptionHandler` (`@RestControllerAdvice`)
   - [ ] `CorrelationIdFilter`
   - [ ] Logback config avec MDC
   - [ ] Tests unitaires

3. **common-tenancy** (1 jour)
   - [ ] `TenancyContext` static helper
   - [ ] `NoAccessibleFarmException`
   - [ ] Tests

4. **common-security** (3-5 jours — gros morceau)
   - [ ] Générer clés RSA 2048
   - [ ] `JwtProperties` + `KeyLoader`
   - [ ] `Membership` + `AvicarePrincipal` records
   - [ ] `JwtService` (génération + validation)
   - [ ] `JwtFilter` (Spring Security filter)
   - [ ] `FarmAccessChecker` (bean SpEL `@farmAccess`)
   - [ ] `PermissionConstants`
   - [ ] `FeatureChecker` (squelette `@features`)
   - [ ] `@RequireServiceAuth` annotation + interceptor (squelette)
   - [ ] `SecurityConfig` (SecurityFilterChain, CORS, PasswordEncoder)
   - [ ] Retirer `SecurityAutoConfiguration.exclude` de `AvicareApplication.java`
   - [ ] Tests complets

5. **Validation end-to-end** (1 jour)
   - [ ] L'app démarre avec Spring Security activé
   - [ ] `/actuator/health` toujours 200
   - [ ] Un endpoint protégé renvoie 401 sans token
   - [ ] Un endpoint protégé renvoie 403 si pas la permission
   - [ ] Toutes les erreurs sont en Problem Details
   - [ ] `X-Correlation-Id` présent dans toutes les réponses

**Estimation totale Sprint A2 : 8-12 jours en solo avec Claude Code.**

## 7.2 — Pièges à anticiper

| Piège | Symptôme | Mitigation |
|---|---|---|
| Self-invocation AOP | `@PreAuthorize` ou `@Transactional` semble ne pas fonctionner | Toujours appeler via un bean injecté, jamais `this.method()` |
| MDC fuit entre threads | Logs avec mauvais correlationId | `MDC.remove()` en `finally` dans `CorrelationIdFilter` |
| Cookies pas envoyés | Frontend reçoit 401 sur les calls suivants | `withCredentials: true` côté frontend, CORS `allowCredentials(true)` côté backend |
| Token leak dans les logs | `log.info("Token: " + token)` | NE JAMAIS logger un token. Logger juste le `jti` |
| Sérialisation memberships JWT | `ClassCastException` au runtime | Le `JwtFilter` utilise `objectMapper.convertValue(...)` pour mapper |
| Clés RSA non chargées | Boot échoue avec `Failed to load JWT private key` | Vérifier `application-dev.yml` et présence physique des fichiers `.pem` |
| `@PreAuthorize` ignoré | Méthode publique appelée par n'importe qui | Vérifier `@EnableMethodSecurity` sur la `SecurityConfig` |
| Tests qui plantent | `SecurityContextHolder` non setup | Utiliser `@WithMockUser` ou setup manuellement |

## 7.3 — Prompt type Claude Code Sprint A2

À adapter pour chaque sous-module :

```
Sprint A2 — Implémentation de [common-api / common-security / etc.]

Avant de coder, lis OBLIGATOIREMENT :
1. docs/00-vision-strategique.md
2. docs/03-architecture-spring-boot.md (sections sur ce module)
3. docs/05-securite-rbac.md (partie correspondante)

Objectif du jour : implémenter [partie X] selon le doc 05 partie Y.

Périmètre :
- [Liste des fichiers à créer selon le doc]
- Tests unitaires associés
- Conformité aux conventions du doc 03

Règles strictes :
- Aucune valeur métier en dur (config externalisée)
- Tous les services ont @Service + @RequiredArgsConstructor
- Toutes les exceptions héritent de BusinessException
- Tous les DTOs sont des records Java 21
- Commits Conventional Commits

À la fin :
- ./mvnw clean install passe
- Les tests passent
- L'app démarre toujours
- Commit + push

Propose-moi le plan détaillé puis exécute après ma validation. 
À chaque étape importante, prends 30s pour m'expliquer le concept Spring sous-jacent (je suis encore en apprentissage).
```

## 7.4 — Critères d'acceptation Sprint A2

Sprint A2 est terminé quand TOUS ces critères sont ✅ :

### Critères fonctionnels
- [ ] L'app démarre avec `make backend-run` sans erreur
- [ ] `/actuator/health` retourne `{"status":"UP"}` (sans auth)
- [ ] `/api/v1/auth/login` reste accessible sans auth
- [ ] Un endpoint test protégé renvoie 401 si pas de token
- [ ] Tous les codes d'erreur respectent RFC 7807
- [ ] `X-Correlation-Id` présent dans toutes les réponses

### Critères techniques
- [ ] Les 4 modules `common-*` buildent indépendamment
- [ ] `common-security` dépend de `common-api`, `common-tenancy`, `common-i18n`
- [ ] Pas de dépendance circulaire entre les `common-*`
- [ ] Couverture tests `common-api` ≥ 70%
- [ ] Couverture tests `common-security` ≥ 80%
- [ ] Couverture tests `FarmAccessChecker` ≥ 90% (critique)
- [ ] `./mvnw clean install` passe sans warning
- [ ] CI verte

### Critères documentaires
- [ ] Le code est commenté sur les parties sensibles (JwtFilter, FarmAccess, GlobalExceptionHandler)
- [ ] CHANGELOG.md à jour avec section v0.2.0-common
- [ ] Tag `v0.2.0-common` créé après Sprint A2

---

## 🎯 Pour aller plus loin

Une fois Sprint A2 terminé, tu auras :

- ✅ Le **squelette** de sécurité fonctionnel
- ✅ La **structure** de gestion d'erreurs RFC 7807
- ✅ Le **tracing** via Correlation ID
- ✅ L'**i18n** prêt à servir
- ⏳ Mais **pas encore** d'utilisateurs réels en DB (Sprint A3)
- ⏳ Mais **pas encore** de fermes ni de memberships (Sprint A3)

Le **Sprint A3** (Identity + Tenancy) viendra mettre tout ça en action avec des vrais users qui se loggent et des vraies fermes.

---

_Document créé en démarrage du projet. À mettre à jour si l'architecture sécurité évolue._
