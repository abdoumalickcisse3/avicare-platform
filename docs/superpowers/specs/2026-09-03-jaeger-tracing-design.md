# Design — Traçage distribué avec Jaeger

> Spec de cadrage. Rédigée après lecture du dépôt et de l'existant, pas après lecture du
> catalogue de Jaeger.
>
> **Statut : validé le 2026-09-03.** Les huit décisions du §3 sont verrouillées.

---

## 1. Le point de départ, mesuré

### 1.1 Ce qui existe déjà, et à quoi ça sert

Le chantier P1 (ADR-010, migration V48) a livré une traçabilité **applicative** : la table
`request_traces` conserve, pour chaque requête retenue, sa méthode, son chemin, l'utilisateur, la
ferme, le code HTTP, la durée totale, le corps de la requête et de la réponse (secrets masqués),
le message d'erreur et la pile d'appel. Rétention 30 jours, écran `/console/traces`.

Sa raison d'être, citée de l'ADR :

> « Le premier appel de support sera : "j'ai eu une erreur ce matin à 10h37". »

Elle répond donc à **« qu'est-il arrivé à cet éleveur »**.

### 1.2 Ce qu'elle ne dit pas

`duration_ms` donne une durée **totale**, jamais sa répartition. Quand une page met quatre
secondes, rien ne dit si le temps est parti dans une requête SQL, dans trente requêtes SQL
(N+1), dans Redis, ou dans le contrôleur. C'est exactement le trou que le traçage par spans
comble.

### 1.3 Une décision antérieure, contraire

`infra/DEPLOY.md` porte :

> « Observability (Prometheus/OTel from doc 00) is **intentionally left out to save RAM** »

Cette spec **révoque** cette décision pour la partie traçage, sur demande explicite du
propriétaire du produit le 2026-09-03. La raison invoquée à l'époque — la RAM — reste valable et
gouverne les décisions D6 et D7 ci-dessous. `DEPLOY.md` sera corrigé : une décision qu'on change
se documente, elle ne se contredit pas en silence.

### 1.4 La contrainte matérielle

Le VPS fait tourner Postgres, Redis, le backend (`mem_limit: 3g`), le web, le landing et Caddy.
`DEPLOY.md` recommande une machine de 8 Go ; **la capacité réelle de la machine de production
n'a pas pu être vérifiée** (pas d'accès SSH depuis le poste de développement). C'est la machine
qui est tombée le 2026-09-03 au matin.

**Vérification obligatoire avant le déploiement** (§7).

---

## 2. Périmètre

### 2.1 Dans le périmètre

- Instrumentation automatique du backend (HTTP, JDBC, Redis) via l'agent OpenTelemetry.
- Un conteneur Jaeger, stockage sur disque, rétention bornée.
- Interface sur `jaeger.jawdi.app`, derrière authentification.
- **Le lien entre les deux systèmes** : l'identifiant de trace OTel stocké dans
  `request_traces`, et un lien depuis `/console/traces`.

### 2.2 Hors périmètre, et pourquoi

- **Les métriques** (Prometheus, Grafana). Le traçage répond à « pourquoi cette requête-là »,
  les métriques à « est-ce que ça va en ce moment ». Les deux sont utiles ; les ajouter ensemble
  doublerait le coût mémoire sur une machine dont on ne connaît pas encore la marge.
- **Le traçage du web et du mobile.** Jawdi est un monolithe : l'essentiel du temps se passe
  dans la JVM. Instrumenter les clients ajouterait du bruit avant d'ajouter de la valeur.
- **Remplacer `/console/traces`.** Jaeger ne stocke pas les corps de requête masqués, ne se
  cherche pas par référence courte et sa rétention se compte en jours. Les deux coexistent.

---

## 3. Décisions

### D1 — L'agent Java, pas de dépendance applicative

L'agent OpenTelemetry s'attache au démarrage via `-javaagent`. `backend/Dockerfile` expose déjà
`ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]` : il suffit d'ajouter l'agent à
l'image et de l'activer par `JAVA_OPTS`.

*Pourquoi* : aucune ligne de `pom.xml`, aucun code applicatif touché, donc rien à défaire si on
abandonne. Désactivable en vidant une variable d'environnement, **sans reconstruire l'image**.

*Coût assumé* : ~50 Mo dans l'image et quelques secondes au démarrage.

### D2 — Le lien avec l'existant : une colonne, pas un pont

`request_traces` gagne `otel_trace_id VARCHAR(32)` (migration **V53**, purement additive).
`RequestTraceFilter` capte l'identifiant courant sur le thread de la requête (voir §4.2 pour
pourquoi ce n'est pas le recorder) et le recorder le persiste. `/console/traces` affiche un lien
« Voir la décomposition » vers Jaeger quand la colonne est renseignée.

*Pourquoi c'est le cœur de la spec* : sans ce lien, on aurait deux outils qui s'ignorent, et une
référence donnée au téléphone n'ouvrirait qu'une des deux vues. Avec, le support part du récit de
l'éleveur et arrive à la décomposition technique en un clic.

*Nullable* : une trace enregistrée alors que l'agent est désactivé n'a pas d'identifiant OTel.
La colonne vide est un état normal, pas une anomalie.

### D3 — Échantillonnage bas, erreurs toujours

`parentbased_traceidratio` à **5 %** sur le trafic normal.

*Pourquoi* : le mobile interroge l'API en boucle. Tracer 100 % remplirait Jaeger de `GET` à 40 ms
et consommerait de la RAM pour rien. C'est la philosophie **déjà actée dans l'ADR-010** pour
`request_traces` (`ERRORS_AND_MUTATIONS`), appliquée ici.

*Limite connue et assumée* : contrairement à `request_traces`, l'échantillonnage OTel se décide
**au début** de la requête, avant de savoir si elle échouera. Une erreur non échantillonnée
n'aura donc pas de trace Jaeger — mais elle aura toujours sa ligne dans `request_traces`, qui,
elle, capture toutes les erreurs. Les deux systèmes se couvrent mutuellement.

### D4 — Jaeger n'est jamais exposé nu

L'interface Jaeger **n'a aucune authentification native**. Publiée telle quelle sur un
sous-domaine, elle exposerait les chemins d'API, les identifiants de ferme et la structure de la
base à quiconque devine le nom.

`jaeger.jawdi.app` est donc servi par Caddy derrière une **authentification basique**, mot de
passe **haché** (`bcrypt`), injecté par variable d'environnement — jamais en clair dans le dépôt.

### D5 — Le port de collecte reste interne

Le port OTLP (4317) est joignable **uniquement sur le réseau Docker interne**, jamais publié.

*Pourquoi* : un collecteur ouvert sur Internet accepte les traces de n'importe qui. On y
injecterait de fausses données, ou on le saturerait jusqu'à faire tomber la machine.

### D6 — Stockage sur disque, rétention 7 jours

Badger (stockage local de Jaeger), pas le stockage en mémoire.

*Pourquoi* : le stockage mémoire perd tout au redémarrage — et il **grossit sans limite**, ce qui
sur cette machine ne se discute pas. Badger survit à un redémarrage et applique une rétention.

Sept jours, et non trente comme `request_traces` : une trace de performance sert à diagnostiquer
un problème présent, pas à répondre à un appel de support sur la semaine passée.

### D7 — Limite mémoire explicite

`mem_limit: 512m` sur le conteneur Jaeger.

*Pourquoi* : sans limite, un conteneur qui dérape affame Postgres. Sur la machine qui est tombée
ce matin, c'est le genre de détail qui décide d'un incident.

### D8 — Tout est désactivable sans reconstruire

`OTEL_SDK_DISABLED=true` coupe l'instrumentation ; arrêter le conteneur Jaeger coupe le reste. Le
backend continue de fonctionner : l'exportateur OTLP échoue en silence si personne n'écoute, il
ne fait pas échouer les requêtes.

*Pourquoi* : un outil d'observabilité qui peut faire tomber ce qu'il observe est un piège. Il doit
se retirer plus vite qu'il ne s'installe.

---

## 4. Architecture

### 4.1 Ce qui change, fichier par fichier

| Fichier | Changement |
|---|---|
| `backend/Dockerfile` | télécharger l'agent OTel dans l'image (couche dédiée) |
| `infra/docker-compose.prod.yml` | service `jaeger` + variables `OTEL_*` sur `backend` |
| `infra/Caddyfile` | bloc `jaeger.{$DOMAIN}` avec `basic_auth` |
| `infra/.env.prod.example` | `JAEGER_UI_USER`, `JAEGER_UI_PASSWORD_HASH`, `OTEL_SAMPLE_RATIO` |
| `db/migration/V53__request_trace_otel.sql` | colonne `otel_trace_id` |
| `admin/domain/RequestTrace.java` | champ `otelTraceId` |
| `admin/trace/RequestTraceDraft.java` | nouveau champ `otelTraceId` |
| `admin/trace/RequestTraceFilter.java` | lire le MDC **sur le thread de la requête** |
| `admin/trace/RequestTraceRecorder.java` | recopier le champ du draft vers l'entité |
| `admin/controller/…` + DTO | exposer `otelTraceId` |
| `web/…/TraceExplorer` | lien « Voir la décomposition » |
| `infra/DEPLOY.md` | corriger la ligne 149 et documenter l'exploitation |

### 4.2 Comment le backend lit l'identifiant de trace

**Sans dépendance OTel dans le `pom.xml`.** L'agent injecte `trace_id` dans le MDC de SLF4J.

**Où le lire, et pourquoi ce n'est pas indifférent.** `RequestTraceRecorder` est annoté
`@Async` : il s'exécute **hors du thread de la requête**, et le MDC ne s'y propage pas.
`MDC.get("trace_id")` y renverrait toujours `null` — le lien serait vide en production alors que
tout compilerait et que les tests unitaires du recorder passeraient.

L'identifiant se lit donc dans `RequestTraceFilter`, au même endroit et de la même manière que
l'identifiant de corrélation aujourd'hui (`RequestTraceFilter:102`,
`MDC.get(CorrelationIdFilter.MDC_KEY)`), puis voyage dans `RequestTraceDraft` jusqu'au recorder.

*Pourquoi pas l'API OTel* : ajouter `opentelemetry-api` au `pom.xml` pour lire une chaîne de
caractères créerait une dépendance de compilation à un outil que D8 promet de pouvoir retirer.

### 4.3 Migration V53

> Le numéro vaut pour l'**ordre de merge**, pas l'ordre du plan. À revalider avant merge.

```sql
ALTER TABLE request_traces ADD COLUMN otel_trace_id VARCHAR(32);
CREATE INDEX idx_request_traces_otel ON request_traces(otel_trace_id)
    WHERE otel_trace_id IS NOT NULL;
```

Additive, nullable, index partiel — aucune donnée existante touchée.

### 4.4 Ce qu'on ne touche pas

- La politique de capture de `request_traces` et sa rétention à 30 jours.
- `CorrelationIdFilter` et le contrat d'erreur RFC 7807.
- Le `pom.xml` du backend.

---

## 5. Tests

**Ce qui se teste en CI** :
- `RequestTraceFilter` capte l'identifiant du MDC et le place dans le draft ; le recorder le
  persiste. **Un test couvre son absence** (agent coupé) : la colonne reste nulle, rien ne casse.
- Un test verrouille que la lecture se fait bien dans le filtre : le piège `@Async` décrit en
  §4.2 produirait un lien vide en production sans qu'aucun test ne l'attrape.
- Le DTO expose le champ ; l'écran affiche le lien **seulement** quand il est renseigné.
- La migration V53 tourne sur base propre (Testcontainers).

**Ce qui ne se teste qu'à la main**, et doit être fait avant de déclarer le chantier terminé :
- l'agent produit bien des spans une fois déployé ;
- `jaeger.jawdi.app` demande le mot de passe et refuse sans ;
- le port 4317 n'est **pas** joignable depuis Internet.

*Pourquoi c'est explicite* : une configuration d'infrastructure qui n'a pas été éprouvée en
conditions réelles n'est pas vérifiée, elle est supposée. La règle « Vérifié » des runbooks
s'applique ici.

---

## 6. Risques

| Risque | Traitement |
|---|---|
| Mémoire insuffisante → nouvel incident | `mem_limit` explicite (D7) + vérification obligatoire §7 avant déploiement |
| Interface Jaeger exposée sans mot de passe | `basic_auth` Caddy (D4), et test manuel de refus |
| Collecteur OTLP ouvert sur Internet | jamais publié (D5) |
| Mot de passe en clair dans le dépôt | hachage bcrypt via variable d'environnement |
| L'agent ralentit ou casse le backend | `OTEL_SDK_DISABLED=true`, sans reconstruction (D8) |
| Identifiant lu hors du thread de requête → lien toujours vide | capté dans le filtre, pas dans le recorder `@Async` (§4.2), avec test dédié |
| Jaeger tombe et entraîne le backend | l'exportateur échoue en silence ; à vérifier à la main |
| Traces bruyantes, disque saturé | échantillonnage 5 % (D3) + rétention 7 jours (D6) |
| Numéro de migration pris par un autre merge | renumérotation avant merge |

---

## 7. Préalable au déploiement — bloquant

La capacité mémoire réelle de la machine n'est pas connue depuis le poste de développement. Avant
tout déploiement de ce chantier :

```bash
ssh <vps> 'free -h; docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}"'
```

**Règle** : s'il reste moins de **1 Go** libre une fois la pile actuelle en marche, on ne déploie
pas Jaeger — on redimensionne la machine d'abord, ou on abaisse `BACKEND_MEM`. Ajouter 512 Mo à
une machine déjà tendue reviendrait à provoquer le second incident de la journée.

Le code peut être écrit, testé et mergé sans cette vérification ; **seul le déploiement en
dépend**.

---

## 8. Critères d'acceptation

- [ ] Une requête lente apparaît dans Jaeger, décomposée en spans (contrôleur, service, SQL).
- [ ] `/console/traces` affiche un lien vers la trace Jaeger correspondante quand elle existe.
- [ ] Une trace sans identifiant OTel s'affiche normalement, sans lien mort.
- [ ] `jaeger.jawdi.app` refuse l'accès sans mot de passe.
- [ ] Le port 4317 est injoignable depuis Internet.
- [ ] `OTEL_SDK_DISABLED=true` puis redémarrage : le backend fonctionne, sans nouvelle trace.
- [ ] Jaeger arrêté : le backend répond toujours normalement.
- [ ] `./mvnw clean verify` vert, CI verte, `tsc --noEmit` propre.
- [ ] `DEPLOY.md` corrigé (ligne 149) et exploitation documentée.
- [ ] Vérification mémoire du §7 effectuée et **consignée**.
