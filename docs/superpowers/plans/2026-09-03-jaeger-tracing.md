# Traçage distribué avec Jaeger — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** voir où passe le temps dans une requête — décomposée en spans (contrôleur, service, SQL) — et pouvoir sauter d'une trace de support vers cette décomposition.

**Architecture:** l'agent OpenTelemetry s'attache au démarrage de la JVM (aucune dépendance dans le `pom.xml`), exporte vers un conteneur Jaeger sur le réseau Docker interne, dont l'interface est publiée sur `jaeger.jawdi.app` derrière une authentification Caddy. Le lien avec l'existant est une colonne `otel_trace_id` sur `request_traces`, captée **dans le filtre** et non dans le recorder `@Async`.

**Tech Stack:** OpenTelemetry Java agent 2.x, Jaeger all-in-one 1.62 (stockage Badger), Caddy 2, Spring Boot 3.4 / Java 21, Flyway, Next.js 16 + MUI v9.

**Spec:** `docs/superpowers/specs/2026-09-03-jaeger-tracing-design.md`

## Global Constraints

- **Commits sans aucune signature Claude** — pas de `Co-Authored-By`, pas de mention d'IA, pas d'emoji robot. Conventional Commits, scope par bounded context.
- **Branche** : `feat/jaeger-tracing`. Aucun push direct sur `main`. PR puis `gh pr merge --rebase --delete-branch`.
- **Aucune dépendance ajoutée au `pom.xml`** (décision D1) — l'agent est un fichier dans l'image, pas une dépendance de compilation.
- **Migration `V53__request_trace_otel.sql`** — numéro à revalider juste avant merge : il vaut pour l'ordre de merge, pas l'ordre du plan.
- **Une migration mergée ne se modifie jamais.**
- **Spotless** : `./mvnw spotless:apply -pl avicare-app` puis `spotless:check` **après** la dernière édition.
- **Aucun secret en clair dans le dépôt** — le mot de passe de l'interface est un hachage bcrypt injecté par variable d'environnement.
- **Le port OTLP 4317 n'est jamais publié** (décision D5) : `expose`, jamais `ports`.
- **Testcontainers ne tourne pas sur ce Mac** (Docker 29 contre docker-java) : les IT sont validés en CI.
- **Le déploiement est bloqué** par la vérification mémoire du §7 de la spec. Le code se merge sans ; le déploiement non.

---

## Structure des fichiers

**Backend — créés**

| Fichier | Responsabilité |
|---|---|
| `db/migration/V53__request_trace_otel.sql` | la colonne et son index partiel |

**Backend — modifiés**

| Fichier | Changement |
|---|---|
| `admin/trace/RequestTraceDraft.java` | champ `otelTraceId` |
| `admin/trace/RequestTraceFilter.java` | lire le MDC sur le thread de la requête |
| `admin/trace/RequestTraceRecorder.java` | recopier le champ vers l'entité |
| `admin/domain/RequestTrace.java` | champ `otelTraceId` |
| `admin/dto/response/RequestTraceDetail.java` | exposer `otelTraceId` |
| `admin/service/AdminTraceReadService.java` | passer le champ au DTO |

**Infrastructure — modifiés** : `backend/Dockerfile`, `infra/docker-compose.prod.yml`, `infra/Caddyfile`, `infra/.env.prod.example`, `infra/DEPLOY.md`.

**Web — modifiés** : `web/src/types/index.ts`, `web/src/components/admin/TraceExplorer.tsx`.

---

## Task 1 : la colonne qui relie les deux systèmes

**Files:**
- Create: `backend/avicare-app/src/main/resources/db/migration/V53__request_trace_otel.sql`
- Modify: `backend/avicare-app/src/main/java/com/avicare/admin/domain/RequestTrace.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/admin/trace/RequestTraceDraft.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/admin/trace/RequestTraceFilter.java:100-116`
- Modify: `backend/avicare-app/src/main/java/com/avicare/admin/trace/RequestTraceRecorder.java:77-100`
- Test: `backend/avicare-app/src/test/java/com/avicare/admin/trace/RequestTraceRecorderTest.java`

**Interfaces:**
- Produces: `RequestTraceDraft.otelTraceId()` → `String` (nullable), dernier champ du record
- Produces: `RequestTrace.getOtelTraceId()` → `String` (nullable)

**Contexte pour l'implémenteur.** C'est le cœur de la spec (décision D2). `RequestTraceRecorder` est annoté `@Async` : il tourne **hors du thread de la requête**, où le MDC ne se propage pas. Lire `MDC.get("trace_id")` dedans renverrait `null` à chaque requête — tout compilerait, les tests du recorder passeraient, et le lien serait vide en production. L'identifiant se lit donc dans `RequestTraceFilter`, à la ligne où `MDC.get(CorrelationIdFilter.MDC_KEY)` est déjà lu.

L'agent OpenTelemetry publie `trace_id` dans le MDC via son instrumentation Logback, activée par défaut. Sans agent, la clé est absente et `MDC.get` rend `null` — c'est un état normal, pas une anomalie.

- [ ] **Step 1: écrire la migration**

`V53__request_trace_otel.sql` :

```sql
-- V53 — Lien entre la traçabilité applicative (V48) et le traçage distribué.
-- L'identifiant de trace OpenTelemetry permet à /console/traces d'ouvrir la
-- décomposition en spans correspondante dans Jaeger.
--
-- Nullable par construction : une requête enregistrée alors que l'agent est
-- désactivé (OTEL_SDK_DISABLED=true) n'a pas d'identifiant. Index partiel, car
-- on ne cherche jamais les lignes sans identifiant.

ALTER TABLE request_traces ADD COLUMN otel_trace_id VARCHAR(32);

CREATE INDEX idx_request_traces_otel ON request_traces(otel_trace_id)
    WHERE otel_trace_id IS NOT NULL;
```

- [ ] **Step 2: valider la migration sur une base réelle, sans la garder**

```bash
docker exec -i avicare-postgres psql -U avicare -d avicare <<'SQL'
BEGIN;
ALTER TABLE request_traces ADD COLUMN otel_trace_id VARCHAR(32);
CREATE INDEX idx_request_traces_otel ON request_traces(otel_trace_id)
    WHERE otel_trace_id IS NOT NULL;
ROLLBACK;
SQL
```

Attendu : `ALTER TABLE`, `CREATE INDEX`, puis `ROLLBACK`. Postgres local sur le **port 5434**.

Si Docker n'est pas démarré sur le poste, noter que la validation n'a **pas** eu lieu et s'appuyer sur la CI — ne pas prétendre l'avoir faite.

- [ ] **Step 3: écrire le test qui échoue**

Dans `RequestTraceRecorderTest`, ajouter :

```java
  @Test
  void keepsTheOtelTraceId_soTheConsoleCanLinkToJaeger() {
    RequestTraceDraft draft = draftBuilder().otelTraceId("4bf92f3577b34da6a3ce929d0e0e4736").build();

    RequestTrace entity = recorder.toEntity(draft);

    assertThat(entity.getOtelTraceId()).isEqualTo("4bf92f3577b34da6a3ce929d0e0e4736");
  }

  @Test
  void toleratesAMissingOtelTraceId_whenTheAgentIsOff() {
    RequestTraceDraft draft = draftBuilder().otelTraceId(null).build();

    RequestTrace entity = recorder.toEntity(draft);

    assertThat(entity.getOtelTraceId()).isNull();
  }
```

> `RequestTraceDraft` est un `record`, pas un builder. Lire le fichier de test existant : s'il construit ses drafts par un helper, ajouter `otelTraceId` à ce helper ; sinon, construire le record en entier avec `null` pour les champs non éprouvés et l'identifiant en dernier argument. **Ne pas inventer de builder qui n'existe pas.**

- [ ] **Step 4: lancer le test, vérifier qu'il échoue**

```bash
cd backend && ./mvnw test -pl avicare-app -Dtest=RequestTraceRecorderTest
```

Attendu : échec de compilation — `otelTraceId` n'existe ni sur le draft ni sur l'entité.

- [ ] **Step 5: ajouter le champ à l'entité**

Dans `RequestTrace.java`, à côté de `requestId` :

```java
  /**
   * Identifiant de trace OpenTelemetry, quand l'agent tourne. Permet à la console d'ouvrir la
   * décomposition en spans correspondante. Nul quand le traçage est désactivé.
   */
  @Column(name = "otel_trace_id")
  private String otelTraceId;
```

- [ ] **Step 6: ajouter le champ au draft, en dernière position**

Dans `RequestTraceDraft.java`, après `endedAt` :

```java
    LocalDateTime endedAt,
    String otelTraceId) {}
```

Et compléter la javadoc du record :

```java
 * @param otelTraceId identifiant de trace OpenTelemetry lu dans le MDC — sur le thread de la
 *     requête, car le recorder est {@code @Async} et le MDC ne s'y propage pas
```

- [ ] **Step 7: le lire dans le filtre**

Dans `RequestTraceFilter.java`, l'appel `new RequestTraceDraft(...)` se termine par `LocalDateTime.now()`. Ajouter l'argument :

```java
                startedAt,
                LocalDateTime.now(),
                // Lu ici, sur le thread de la requête : le recorder est @Async et le MDC ne s'y
                // propage pas. L'agent OTel publie cette clé ; sans agent, elle est absente.
                MDC.get("trace_id")));
```

- [ ] **Step 8: le recopier dans le recorder**

Dans `toEntity`, après `.endedAt(draft.endedAt())` :

```java
        .otelTraceId(draft.otelTraceId())
```

- [ ] **Step 9: lancer le test, vérifier qu'il passe**

```bash
cd backend && ./mvnw test -pl avicare-app -Dtest=RequestTraceRecorderTest
```

Attendu : tous verts.

- [ ] **Step 10: vérifier que rien d'autre ne casse**

```bash
cd backend && ./mvnw clean test -pl avicare-app
```

`RequestTraceFilterTest` construit peut-être des drafts : ajouter l'argument manquant. Attendu : 0 échec (les 2 erreurs Docker/Testcontainers de ce poste sont connues et pré-existantes).

- [ ] **Step 11: formater puis commiter**

```bash
cd backend && ./mvnw spotless:apply -pl avicare-app && ./mvnw spotless:check -pl avicare-app
cd .. && git add -A && git commit -F - <<'EOF'
feat(backend:admin): carry the OpenTelemetry trace id on a request trace

V53 adds otel_trace_id to request_traces, so the support console can open the
matching span breakdown instead of stopping at a total duration.

Read in the filter, not in the recorder: RequestTraceRecorder is @Async, the
MDC does not propagate to that thread, and MDC.get there would have returned
null on every request — compiling cleanly, passing its unit tests, and leaving
the link empty in production.

Nullable by construction: a request recorded while the agent is off has no id.
EOF
```

---

## Task 2 : l'agent dans l'image, sans toucher au pom

**Files:**
- Modify: `backend/Dockerfile`

**Interfaces:**
- Produces: `/opt/otel/opentelemetry-javaagent.jar` dans l'image d'exécution

**Contexte.** Décision D1 : aucune dépendance de compilation. L'agent est un fichier téléchargé dans l'image, activé par `JAVA_OPTS` — que l'`ENTRYPOINT` évalue déjà. Sans variable d'environnement, l'agent est présent mais inerte.

- [ ] **Step 1: ajouter l'agent à l'étape d'exécution**

Dans `backend/Dockerfile`, dans l'étape `FROM eclipse-temurin:21-jre-jammy`, **avant** `COPY --from=build /app.jar app.jar` :

```dockerfile
# Agent OpenTelemetry : instrumente HTTP, JDBC et Redis sans une ligne de code ni une
# dépendance au pom (ADR/spec Jaeger, décision D1). Inerte tant que JAVA_OPTS ne le
# charge pas — l'image est donc identique, traçage activé ou non.
# Version épinglée : un agent qui change tout seul est un agent qu'on ne peut pas déboguer.
ARG OTEL_AGENT_VERSION=2.10.0
ADD https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/download/v${OTEL_AGENT_VERSION}/opentelemetry-javaagent.jar /opt/otel/opentelemetry-javaagent.jar
RUN chmod 644 /opt/otel/opentelemetry-javaagent.jar
```

- [ ] **Step 2: vérifier que l'image se construit et que l'agent est là**

```bash
cd backend && docker build -t jawdi-backend-otel-test .
docker run --rm --entrypoint sh jawdi-backend-otel-test -c 'ls -l /opt/otel/'
```

Attendu : le fichier, une vingtaine de Mo.

Si Docker n'est pas démarré sur le poste, **noter que l'étape n'a pas pu être vérifiée localement** et s'appuyer sur la CI, qui construit l'image.

- [ ] **Step 3: commiter**

```bash
git add backend/Dockerfile && git commit -F - <<'EOF'
build(backend): ship the OpenTelemetry agent in the image

A file in the image, not a dependency in the pom: the agent instruments HTTP,
JDBC and Redis without a line of application code, and the entrypoint already
evaluates JAVA_OPTS. Present but inert until an environment variable loads it,
so the image is the same whether tracing is on or off.

Version pinned — an agent that updates itself is one nobody can debug.
EOF
```

---

## Task 3 : Jaeger en production, borné et fermé

**Files:**
- Modify: `infra/docker-compose.prod.yml`
- Modify: `infra/.env.prod.example`

**Interfaces:**
- Produces: service `jaeger`, joignable en interne sur `jaeger:4317` (OTLP) et `jaeger:16686` (interface)

**Contexte.** Trois décisions se matérialisent ici : **D5** le port de collecte n'est jamais publié (`expose`, jamais `ports`), **D6** stockage Badger sur disque avec rétention 7 jours, **D7** limite mémoire explicite. La machine est celle qui est tombée le 2026-09-03 ; un conteneur sans limite peut affamer Postgres.

- [ ] **Step 1: ajouter le service**

Dans `infra/docker-compose.prod.yml`, à côté des autres services :

```yaml
  # Traçage distribué. L'interface n'a aucune authentification native : elle n'est jamais
  # publiée directement, seulement à travers Caddy qui exige un mot de passe (spec D4).
  jaeger:
    image: jaegertracing/all-in-one:1.62
    restart: unless-stopped
    environment:
      # Stockage sur disque plutôt qu'en mémoire : la mémoire perd tout au redémarrage et
      # grossit sans limite, ce qui sur cette machine ne se discute pas (D6).
      SPAN_STORAGE_TYPE: badger
      BADGER_EPHEMERAL: "false"
      BADGER_DIRECTORY_VALUE: /badger/data
      BADGER_DIRECTORY_KEY: /badger/key
      # Sept jours : une trace de performance sert à diagnostiquer un problème présent, pas à
      # répondre à un appel de support sur la semaine passée (request_traces garde 30 jours).
      BADGER_SPAN_STORE_TTL: 168h
      COLLECTOR_OTLP_ENABLED: "true"
    volumes:
      - jaeger_data:/badger
    # Aucun `ports:` — le collecteur OTLP et l'interface restent sur le réseau interne.
    # Un collecteur ouvert sur Internet accepte les traces de n'importe qui (D5).
    expose:
      - "4317"
      - "16686"
    networks:
      - internal
    # Sans limite, un conteneur qui dérape affame Postgres (D7).
    mem_limit: ${JAEGER_MEM:-512m}
```

Déclarer le volume à côté des autres :

```yaml
  jaeger_data:
```

- [ ] **Step 2: brancher le backend dessus**

Dans le service `backend`, ajouter aux variables d'environnement :

```yaml
      # Traçage : l'agent n'est chargé que si JAVA_OPTS le demande. Vider TRACING_JAVA_OPTS
      # dans .env suffit à revenir au comportement d'avant, sans reconstruire (D8).
      JAVA_OPTS: ${TRACING_JAVA_OPTS:--javaagent:/opt/otel/opentelemetry-javaagent.jar}
      OTEL_SERVICE_NAME: jawdi-backend
      OTEL_EXPORTER_OTLP_ENDPOINT: http://jaeger:4317
      OTEL_EXPORTER_OTLP_PROTOCOL: grpc
      OTEL_METRICS_EXPORTER: none
      OTEL_LOGS_EXPORTER: none
      # 5 % du trafic normal : le mobile interroge l'API en boucle, et tracer 100 %
      # remplirait Jaeger de GET à 40 ms (D3).
      OTEL_TRACES_SAMPLER: parentbased_traceidratio
      OTEL_TRACES_SAMPLER_ARG: ${OTEL_SAMPLE_RATIO:-0.05}
      OTEL_SDK_DISABLED: ${OTEL_SDK_DISABLED:-false}
```

> **Vérifier d'abord** si `backend` déclare déjà `JAVA_OPTS`. Si oui, **ne pas dupliquer la clé** — concaténer l'agent à la valeur existante. Une clé YAML en double est silencieusement écrasée.

- [ ] **Step 3: documenter les variables**

Dans `infra/.env.prod.example` :

```bash
# --- Traçage distribué (Jaeger) ---
# Vider TRACING_JAVA_OPTS désactive l'agent sans reconstruire l'image.
TRACING_JAVA_OPTS=-javaagent:/opt/otel/opentelemetry-javaagent.jar
# Part du trafic normal tracée. Les erreurs restent capturées par request_traces.
OTEL_SAMPLE_RATIO=0.05
OTEL_SDK_DISABLED=false
JAEGER_MEM=512m
# Interface Jaeger : identifiant et mot de passe HACHÉ (jamais en clair).
# Générer le hachage :  docker run --rm caddy:2-alpine caddy hash-password --plaintext 'votre-mot-de-passe'
JAEGER_UI_USER=admin
JAEGER_UI_PASSWORD_HASH=
```

- [ ] **Step 4: valider la syntaxe du compose**

```bash
cd infra && docker compose -f docker-compose.prod.yml config >/dev/null && echo "compose valide"
```

Sans Docker, au minimum vérifier l'indentation à la lecture et noter que la validation n'a pas eu lieu.

- [ ] **Step 5: commiter**

```bash
git add infra/docker-compose.prod.yml infra/.env.prod.example && git commit -F - <<'EOF'
feat(infra): run Jaeger, bounded and closed

Disk storage rather than memory, with a seven-day retention: memory loses
everything on restart and grows without a ceiling, which on this box is not up
for discussion. An explicit memory limit, because a container that runs away
starves Postgres — and this is the machine that fell over on 2026-09-03.

Neither the OTLP collector nor the UI is published. A collector open to the
internet accepts anyone's spans, and Jaeger's UI has no authentication of its
own; Caddy fronts it in the next commit.

Emptying TRACING_JAVA_OPTS turns the agent off without rebuilding anything.
EOF
```

---

## Task 4 : la porte devant l'interface

**Files:**
- Modify: `infra/Caddyfile`

**Contexte.** Décision **D4**, la plus importante du chantier pour la sécurité. L'interface Jaeger n'a aucune authentification. Publiée nue sur un sous-domaine, elle exposerait les chemins d'API, les identifiants de ferme et la structure de la base à quiconque devine le nom.

Caddy 2.7+ nomme la directive `basic_auth` (`basicauth` est déprécié). Le mot de passe est un **hachage bcrypt**, jamais un mot de passe en clair.

- [ ] **Step 1: ajouter le bloc**

À la fin de `infra/Caddyfile` :

```
# --- Traçage (Jaeger), sous-domaine dédié ---
# L'interface Jaeger n'a AUCUNE authentification native : publiée nue, elle exposerait les
# chemins d'API, les identifiants de ferme et la structure de la base à qui devine le nom.
# Le mot de passe est un hachage bcrypt injecté par l'environnement, jamais en clair ici.
#   docker run --rm caddy:2-alpine caddy hash-password --plaintext 'mot-de-passe'
jaeger.{$DOMAIN} {
	encode zstd gzip

	basic_auth {
		{$JAEGER_UI_USER} {$JAEGER_UI_PASSWORD_HASH}
	}

	reverse_proxy jaeger:16686
}
```

- [ ] **Step 2: mettre à jour l'en-tête du fichier**

Le commentaire en tête énumère les hôtes. Ajouter la ligne, et corriger le décompte s'il mentionne « five names » :

```
#   jaeger.{$DOMAIN}         -> Jaeger UI (traçage), derrière mot de passe
```

- [ ] **Step 3: passer les variables à Caddy**

Dans `infra/docker-compose.prod.yml`, service `caddy`, ajouter à `environment` :

```yaml
      JAEGER_UI_USER: ${JAEGER_UI_USER:-admin}
      JAEGER_UI_PASSWORD_HASH: ${JAEGER_UI_PASSWORD_HASH}
```

- [ ] **Step 4: valider la syntaxe Caddy**

```bash
docker run --rm -v "$PWD/infra/Caddyfile:/etc/caddy/Caddyfile:ro" \
  -e DOMAIN=jawdi.app -e JAEGER_UI_USER=admin \
  -e JAEGER_UI_PASSWORD_HASH='$2a$14$aaaaaaaaaaaaaaaaaaaaaa' \
  caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile
```

Attendu : `Valid configuration`. Sans Docker, le noter comme non vérifié.

- [ ] **Step 5: commiter**

```bash
git add infra/Caddyfile infra/docker-compose.prod.yml && git commit -F - <<'EOF'
feat(infra): put a password in front of the Jaeger UI

Jaeger's interface has no authentication of its own. On a public subdomain it
would hand anyone who guesses the name the API surface, the farm ids and the
shape of the database.

Caddy fronts it with basic auth, the password stored as a bcrypt hash injected
from the environment — never in the repository. The subdomain is an address,
not a lock.
EOF
```

---

## Task 5 : le lien depuis la console

**Files:**
- Modify: `backend/avicare-app/src/main/java/com/avicare/admin/dto/response/RequestTraceDetail.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/admin/service/AdminTraceReadService.java:83-101`
- Modify: `web/src/types/index.ts`
- Modify: `web/src/components/admin/TraceExplorer.tsx`
- Test: `web/src/components/admin/TraceExplorer.test.tsx`

**Interfaces:**
- Consumes: `RequestTrace.getOtelTraceId()` (Task 1)
- Produces: champ `otelTraceId?: string | null` sur le type `RequestTraceDetail` du web

**Contexte.** Sans ce lien, on a deux outils qui s'ignorent. Le lien doit **disparaître** quand l'identifiant est absent : un lien mort vers Jaeger est pire que pas de lien.

L'URL est `https://jaeger.<domaine>/trace/<id>`. Le domaine vient d'une variable publique, car il diffère entre environnements.

- [ ] **Step 1: exposer le champ dans le DTO**

Dans `RequestTraceDetail.java`, ajouter après `endedAt` :

```java
    LocalDateTime endedAt,
    /** Identifiant de trace OpenTelemetry, nul quand l'agent ne tournait pas. */
    String otelTraceId,
    List<String> auditActions) {}
```

Dans `AdminTraceReadService.java`, passer la valeur dans l'ordre du record :

```java
        trace.getEndedAt(),
        trace.getOtelTraceId(),
        auditActions);
```

- [ ] **Step 2: compiler le backend**

```bash
cd backend && ./mvnw -q clean test-compile -pl avicare-app
```

Attendu : aucune erreur.

- [ ] **Step 3: déclarer le champ côté web**

Dans `web/src/types/index.ts`, sur l'interface qui décrit le détail d'une trace :

```ts
  /**
   * Identifiant de trace OpenTelemetry. Absent quand l'agent ne tournait pas — ne jamais
   * construire un lien Jaeger sans lui, un lien mort est pire que pas de lien.
   */
  otelTraceId?: string | null;
```

- [ ] **Step 4: écrire le test qui échoue**

Dans `TraceExplorer.test.tsx` :

```tsx
  it("offre la décomposition Jaeger quand la trace en a une", async () => {
    // Le composant charge un détail contenant otelTraceId — suivre la façon dont les autres
    // tests de ce fichier fournissent leurs données (mock du hook RTK Query).
    const link = await screen.findByRole("link", { name: /décomposition/i });
    expect(link).toHaveAttribute(
      "href",
      expect.stringContaining("4bf92f3577b34da6a3ce929d0e0e4736"),
    );
  });

  it("n'affiche aucun lien mort quand l'agent ne tournait pas", async () => {
    // Même détail, otelTraceId à null.
    expect(screen.queryByRole("link", { name: /décomposition/i })).not.toBeInTheDocument();
  });
```

> **Lire le fichier de test existant avant d'écrire** : reprendre sa façon de fournir les données (mock du module d'API) plutôt que d'en inventer une seconde. Si `TraceExplorer.test.tsx` n'existe pas, le créer sur le modèle de `web/src/components/admin/AdminShell.test.tsx`.

- [ ] **Step 5: lancer le test, vérifier qu'il échoue**

```bash
cd web && npx vitest run src/components/admin/TraceExplorer.test.tsx
```

Attendu : échec — aucun lien trouvé.

- [ ] **Step 6: afficher le lien**

Dans `TraceExplorer.tsx`, à côté du champ « Identifiant » :

```tsx
{data.otelTraceId && (
  <Button
    component="a"
    href={`https://jaeger.${process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "jawdi.app"}/trace/${data.otelTraceId}`}
    target="_blank"
    rel="noopener noreferrer"
    size="small"
    startIcon={<Activity size={15} />}
  >
    Voir la décomposition
  </Button>
)}
```

> Vérifier que `Activity` est importé de `lucide-react` dans ce fichier ; sinon l'ajouter. Vérifier aussi le nom réel de la variable de domaine dans `web/` — s'il n'en existe pas, utiliser `window.location.hostname.replace(/^admin\./, "jaeger.")`, qui suit l'hôte courant sans nouvelle variable.

- [ ] **Step 7: lancer le test, vérifier qu'il passe**

```bash
cd web && npx vitest run src/components/admin/TraceExplorer.test.tsx && npx tsc --noEmit
```

Attendu : verts, et `tsc` propre.

- [ ] **Step 8: suite complète des deux côtés**

```bash
cd web && npx vitest run
cd ../backend && ./mvnw clean test -pl avicare-app
```

- [ ] **Step 9: formater puis commiter**

```bash
cd backend && ./mvnw spotless:apply -pl avicare-app && ./mvnw spotless:check -pl avicare-app
cd .. && git add -A && git commit -F - <<'EOF'
feat(web): jump from a support trace to its span breakdown

The console answers "what happened to this farmer", Jaeger answers "where did
the time go". Without this link they are two tools that ignore each other, and
a reference read out over the phone opens only one of them.

The button is absent, not disabled, when the trace carries no OpenTelemetry id:
a dead link to Jaeger is worse than no link.
EOF
```

---

## Task 6 : dire la vérité dans la documentation

**Files:**
- Modify: `infra/DEPLOY.md`

**Contexte.** `DEPLOY.md` porte encore : *« Observability (Prometheus/OTel from doc 00) is intentionally left out to save RAM »*. C'est maintenant faux pour le traçage. Une décision qu'on change se documente ; elle ne se contredit pas en silence.

- [ ] **Step 1: corriger la ligne et documenter l'exploitation**

Remplacer la ligne par :

```markdown
- Metrics (Prometheus/Grafana) are still left out to save RAM. **Tracing is not**: Jaeger runs
  on `jaeger.{DOMAIN}` behind Caddy basic auth since 2026-09-03. See
  `docs/superpowers/specs/2026-09-03-jaeger-tracing-design.md`.
```

Et ajouter une section :

```markdown
### Tracing (Jaeger)

- **UI**: `https://jaeger.{DOMAIN}` — basic auth. Set `JAEGER_UI_USER` and
  `JAEGER_UI_PASSWORD_HASH` in `.env`; generate the hash with
  `docker run --rm caddy:2-alpine caddy hash-password --plaintext '<password>'`.
- **DNS**: needs a public A record `jaeger.{DOMAIN}` -> this VPS, like the other names.
- **Turn it off** without rebuilding: empty `TRACING_JAVA_OPTS` in `.env`, or set
  `OTEL_SDK_DISABLED=true`, then `./deploy.sh`. The backend keeps running either way — the OTLP
  exporter fails silently when nothing listens.
- **Sampling**: `OTEL_SAMPLE_RATIO` (default 0.05). Raise it briefly to chase a specific problem,
  then put it back — the mobile app polls, and 100 % fills the store with 40 ms GETs.
- **Retention**: 7 days, on disk (`jaeger_data` volume). `request_traces` keeps 30 days and is the
  one to search for a support call.
- **Memory**: `JAEGER_MEM` (default 512m). Check `free -h` before raising it.
```

- [ ] **Step 2: commiter**

```bash
git add infra/DEPLOY.md && git commit -F - <<'EOF'
docs(infra): tracing is no longer left out to save RAM

DEPLOY.md said observability was intentionally dropped for memory reasons.
That is now false for tracing and stays true for metrics, so the line says
exactly that instead of quietly contradicting the running stack.

Adds how to turn it off, where the sampling ratio lives and why raising it is
temporary — the operational facts someone needs at 2 a.m., not the ones that
sound impressive.
EOF
```

---

## Task 7 : la porte, ouverte puis fermée pour de vrai

**Files:** aucun — vérification en conditions réelles.

**Contexte.** Le §5 de la spec est explicite : *« une configuration d'infrastructure qui n'a pas été éprouvée en conditions réelles n'est pas vérifiée, elle est supposée »*. Cette tâche n'écrit pas de code ; elle empêche de déclarer terminé ce qui ne l'est pas.

**Elle ne peut être faite qu'après déploiement, et le déploiement est bloqué par le §7 de la spec.**

- [ ] **Step 1: la vérification mémoire, bloquante**

```bash
ssh <vps> 'free -h; docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}"'
```

**Règle : s'il reste moins de 1 Go libre, ne pas déployer Jaeger.** Redimensionner la machine ou abaisser `BACKEND_MEM` d'abord. Ajouter 512 Mo à une machine tendue, c'est provoquer le second incident.

- [ ] **Step 2: DNS et mot de passe (actions du propriétaire)**

- Enregistrement A `jaeger.jawdi.app` → l'IP du VPS.
- `JAEGER_UI_USER` et `JAEGER_UI_PASSWORD_HASH` renseignés dans le `.env` **du serveur**.

- [ ] **Step 3: déployer**

```bash
gh workflow run deploy.yml --ref main
```

- [ ] **Step 4: éprouver les trois promesses de sécurité**

```bash
# 1. L'interface refuse sans mot de passe.
curl -s -o /dev/null -w "sans identifiants: %{http_code} (attendu 401)\n" https://jaeger.jawdi.app

# 2. Elle accepte avec.
curl -s -o /dev/null -u "$JAEGER_UI_USER:$MOT_DE_PASSE" \
  -w "avec identifiants: %{http_code} (attendu 200)\n" https://jaeger.jawdi.app

# 3. Le collecteur n'est PAS joignable depuis Internet.
nc -z -w 5 <IP_DU_VPS> 4317 && echo "ÉCHEC: port 4317 ouvert" || echo "OK: 4317 fermé"
```

- [ ] **Step 5: éprouver que le traçage fonctionne, et qu'il se retire**

- Ouvrir une page de l'application, puis chercher le service `jawdi-backend` dans Jaeger : une trace décomposée en spans doit apparaître.
- Ouvrir `/console/traces`, ouvrir une trace récente : le bouton « Voir la décomposition » doit mener à la bonne trace.
- Arrêter Jaeger (`docker compose stop jaeger`) et recharger l'application : **elle doit continuer de répondre normalement**. C'est la décision D8 ; un outil d'observabilité qui fait tomber ce qu'il observe est un piège.

- [ ] **Step 6: consigner**

Cocher les critères du §8 de la spec **seulement pour ce qui a réellement été observé**, et écrire le résultat de la vérification mémoire dans la PR. La règle « Vérifié » des runbooks s'applique : « rejoué en local » n'est pas « rejoué en production ».

---

## Vérification finale

- [ ] `cd backend && ./mvnw clean verify` vert
- [ ] `cd web && npx tsc --noEmit && npx vitest run` vert
- [ ] V53 a tourné sur base propre en CI
- [ ] Aucun secret en clair dans le diff (`git diff main --stat` puis relecture du `.env.prod.example`)
- [ ] Le port 4317 n'apparaît dans aucun `ports:` du compose
- [ ] Aucun commit ne porte de signature Claude
- [ ] `gh pr checks` vert **avant** `gh pr merge --rebase --delete-branch`
