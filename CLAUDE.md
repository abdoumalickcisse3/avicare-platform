# Instructions pour Claude Code — Jawdi Platform

> Fichier lu automatiquement par Claude Code et Cursor à chaque session.
> Il définit les règles non-négociables et la routine de travail attendue.

---

## 🎯 Contexte stratégique obligatoire

**AVANT toute action significative** (modification de fichier, création de code,
commit, PR), Claude Code DOIT relire ces 2 documents :

1. **`docs/INDEX.md`**
   - Vue d'ensemble des documents fondateurs
   - État d'avancement des sprints (A1 → C5)
   - Routine de travail Claude (chat) / Claude Code

2. **`docs/00-vision-strategique.md`**
   - 14 décisions stratégiques verrouillées
   - Architecture multi-tenant, ProductionUnit héritage JPA
   - Monolithe modulaire DDD, paramétrage 3 couches
   - Vagues V1-V4 (V1 = volaille only)
   - Modules commerciaux, feature gating

En début de chaque session, Claude Code doit confirmer la lecture de ces
documents avant de proposer un plan d'exécution.

---

## 📚 Documents de référence par sprint

Selon le sprint en cours, Claude Code doit ÉGALEMENT relire le doc pertinent :

| Sprint | Documents à lire en plus |
|---|---|
| A1 — Setup | `docs/02-setup-monorepo.md` |
| A2 — common-* | `docs/03-architecture-spring-boot.md` + `docs/05-securite-rbac.md` |
| A3 — Identity + Tenancy | `docs/03` + `docs/04-schema-db-initial.md` (V1) + `docs/05` |
| A4 — Subscription + Parameters | `docs/03` + `docs/04` (V2, V3) |
| A5 — Livestock socle | `docs/03` + `docs/04` (V4) |
| B1+ — Métier volaille | `docs/03` + `docs/04` (V5+) + `docs/legacy-reference/ARCHITECTURE.md` |

Si le sprint en cours n'est pas clair, demander à l'utilisateur.

---

## 🚫 Règles non-négociables

### Commits

- **AUCUNE signature ou référence à Claude** dans les messages de commit
- Pas de "🤖 Generated with Claude Code"
- Pas de "Co-Authored-By: Claude <noreply@anthropic.com>"
- Pas d'emoji robot, pas de mention "AI", "assistant", "Claude", "Anthropic"
- Conventional Commits respectés : `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `ci:`, `build:`, `refactor:`
- Scope par bounded-context : `feat(common-i18n):`, `feat(backend:identity):`, etc.
- Message clair et professionnel, comme écrit par un humain solo dev

Exemple correct :

```
feat(common-api): add response records and business exception hierarchy

ApiResponse<T> and PageResponse<T> response records
BusinessException abstract base + 7 concrete exceptions
ExceptionHierarchyTest covers 5 scenarios
Per docs/05 §2.1 and §2.2
```

### Workflow PR

- Branch protection active sur `main` → AUCUN push direct sur main
- Workflow : `git checkout -b <branch>` → code → commit → push → PR → merge
- Toujours `gh pr merge --rebase --delete-branch` (historique linéaire propre)
- 1 PR = 1 sujet (pas de fourre-tout)

### Pendant l'incident GitHub Actions (cf. ADR-003)

Si les CI ne se déclenchent pas sur les branches feature, suivre la checklist
de `CONTRIBUTING.md` "Local validation checklist" :

1. `cd backend && ./mvnw clean verify` (full reactor) → SUCCESS
2. `make backend-run` → app démarre sans erreur
3. `curl http://localhost:8080/actuator/health` → `{"status":"UP"}`
4. Tous les tests verts
5. Couverture Jacoco du module modifié vérifiée

Valider en local AVANT merge tant que ADR-003 est actif.

### Architecture

- **Pas de cross-import entre bounded contexts** — passer par les facades publiques
- **Référencement par ID** dans les entités (pas `@ManyToOne` cross-context)
- **Paramétrage 3 couches** : `catalog_items` (plateforme) / `farm_settings` (ferme) / `user_settings` (user)
- **Aucune valeur métier en dur** — tout passe par `parameters`
- **Migrations Flyway** : versionnées immutables (jamais modifier une migration mergée)

### Code

- Tous les services métier : `@Service` + `@RequiredArgsConstructor` (Lombok)
- Tous les DTOs : records Java 21
- Toutes les exceptions métier : héritent de `BusinessException`
- Messages techniques en anglais (i18n via `common-i18n` pour les messages user-facing)
- Soft delete par défaut sur les entités métier
- Tests : AssertJ pour les assertions (fluent)
- Spotless Google Java Format appliqué (indentation 2 espaces)

---

## 🧯 Runbooks opérationnels

`docs/runbooks/` documente **quoi faire quand un client appelle** : éleveur bloqué, erreur à
retrouver, donnée incohérente, sauvegarde manquée, restauration. À lire avant de diagnostiquer un
incident, et **à mettre à jour après chaque incident réel** — un runbook qui ne bouge jamais est un
runbook que personne n'utilise.

Chaque runbook porte une ligne « Vérifié » disant où ses étapes ont été rejouées. Ne jamais la
gonfler : « rejoué en local » n'est pas « rejoué en production ».

---

## 🗃️ Base de données & Flyway (Sprint A3+)

### Migrations

- **Immuabilité absolue** : une migration mergée ne se modifie JAMAIS → créer une migration corrective.
- Naming doc 04 : `V<n>__snake_case.sql` (double underscore), une migration = un sujet.
- Location : `backend/avicare-app/src/main/resources/db/migration/`
- Toute migration doit tourner sans erreur sous Testcontainers avant merge.

### Conventions SQL (cf. doc 04 §1 — verrouillées)

- Tables : `snake_case` **pluriel** (`users`, `farms`, `user_farms`).
- IDs : `BIGSERIAL PRIMARY KEY`. Enums : `VARCHAR` + `CHECK (... IN (...))`.
- Horodatages : **`TIMESTAMP`** (sans TZ, UTC). Financier : `NUMERIC(12,2)`. JSON : `JSONB`.
- Audit : `created_at`/`updated_at` (via **trigger** `trg_<table>_updated_at`).
  `deleted_at TIMESTAMP NULL` **uniquement** sur tables à soft delete (pas `users`, qui utilise `is_active`).
- FK explicites `REFERENCES ... ON DELETE ...` ; index sur FK et colonnes filtrées.
- Index partiel `WHERE deleted_at IS NULL` (et unique partiel) seulement si la table porte `deleted_at`.

## 🗄️ JPA / Hibernate 6.4 (Sprint A3+)

- `@Entity` sur classes mutables (jamais sur records) ; `@Table(name=...)` explicite.
- `@Id @GeneratedValue(strategy = IDENTITY)` (BIGSERIAL). `@Enumerated(EnumType.STRING)` (jamais ORDINAL).
- `created_at`/`updated_at` : **gérés par le trigger DB** → mapper en lecture seule
  (`@Column(insertable=false, updatable=false)`), **pas** de `@UpdateTimestamp` (évite le double writer).
- Soft delete : `@SQLDelete` + **`@SQLRestriction("deleted_at IS NULL")`** (`@Where` déprécié en HB6).
- Relations `@ManyToOne(fetch = LAZY)` ; éviter N+1 via `@EntityGraph` / `JOIN FETCH`. Pas de bidirectionnel sans raison.
- Repositories : `JpaRepository<E, Long>`, dérivation de méthodes, `@Query` JPQL si complexe.
- Services : `@Service` + `@RequiredArgsConstructor` ; `@Transactional` sur écriture, `(readOnly=true)` sur lecture ; `@Valid` sur DTOs entrants.

## 🧪 Tests DB (Sprint A3+)

- `@DataJpaTest` + Testcontainers (`PostgreSQLContainer`) pour les slices repository.
- `@SpringBootTest` + `@AutoConfigureMockMvc` + Testcontainers pour l'E2E auth.
  (Le profil `test` DB-less existant reste pour les tests web/sécurité sans DB.)
- `@DynamicPropertySource` pour la datasource ; `withReuse(true)` en local.
- Préférer le slice rapide ; éviter `@DirtiesContext`. Si build CI > 5 min, alerter.

## 🔐 Auth (Sprint A3+) — détails dans doc 05

- Hash mots de passe : `BCryptPasswordEncoder(strength=12)`. Jamais de mot de passe en clair / dans un `toString()`.
- Refresh token : source de vérité = table `refresh_tokens` (colonne `token`, révocation via `revoked_at`),
  cache révocations Redis. **Rotation + logout/logout-all : voir doc 05.**
- Endpoints publics (déjà actés dans `common-security` `SecurityConfig`) :
  `/actuator/health/**`, `/actuator/info`, `/api/v1/auth/**`, `/swagger-ui/**`, `/v3/api-docs/**` ; tout le reste authentifié.
- Access token en header `Bearer` ; refresh token en cookie `httpOnly SameSite=Lax Secure` (prod).

## ✅ Checklist pré-merge (Sprint A3+, complète A2)

1. `cd backend && ./mvnw clean verify` vert (cf. ADR-003 : valider en local).
2. App démarre (`make backend-run`) + `/actuator/health` → UP.
3. Migration Flyway ajoutée : a tourné sur DB clean en test ; **aucune migration mergée modifiée**.
4. Couverture du module ≥ 80 % pour le code sécurité-critique.
5. Commit sans signature Claude ; CI vertes avant merge.

---

## 🤝 Style d'interaction attendu

### Mode "demande avant d'agir"

Claude Code doit demander à l'utilisateur AVANT :
- Toute décision d'architecture non documentée
- Toute déviation des conventions du projet
- Tout ajout de dépendance non listée dans les docs
- Toute modification de fichier en dehors du périmètre du sprint en cours
- Toute hésitation entre 2 approches techniques

### Mode "plan + validation + exécution"

Pour chaque session de travail :
1. Lire les documents de contexte (cf. ci-dessus)
2. Faire un diagnostic de l'état actuel (git status, fichiers existants)
3. Proposer un plan d'exécution détaillé
4. **Attendre la validation explicite** de l'utilisateur
5. Exécuter étape par étape
6. À la fin : bilan structuré

### Si une erreur survient

- STOP immédiatement
- NE PAS tenter de fix au hasard
- Montrer l'erreur à l'utilisateur
- Attendre les instructions

---

## 📊 Bilans de session attendus

À la fin de chaque session, fournir un bilan structuré :

- ✅ **Livré** : fichiers créés/modifiés, commits, PRs
- 📊 **Métriques** : couverture tests, temps build, etc.
- ⚠️ **Questions / points soulevés** : décisions implicites, doutes
- 🎯 **Prochaine étape** : ce qui vient après
- 💡 **Apprentissages** : concepts/patterns nouveaux exercés

---

## 🔄 Routine en début de session

À chaque démarrage de session, Claude Code doit :

1. `git status` + `git log --oneline -5` (état Git)
2. Lire `docs/INDEX.md` et `docs/00-vision-strategique.md`
3. Lire les documents spécifiques au sprint en cours
4. Vérifier `https://www.githubstatus.com` (incident en cours ?)
5. Confirmer le contexte à l'utilisateur avant d'agir

---

_Ce fichier évoluera avec le projet. À jour pour Sprint A3._
