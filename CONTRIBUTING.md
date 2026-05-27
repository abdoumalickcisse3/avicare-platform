# Contributing — AviCare Platform

> Conventions de travail. À respecter même en solo (et surtout en solo).

## Workflow Git

### Branches

- `main` — branche stable, protégée. Tout ce qui est sur `main` doit builder et passer les tests.
- `develop` — (optionnel pour l'instant) branche d'intégration.
- `feature/<sprint>-<short-desc>` — nouvelle fonctionnalité. Ex: `feature/a3-auth-jwt`
- `fix/<short-desc>` — correction de bug. Ex: `fix/login-redirect-loop`
- `chore/<short-desc>` — tâches techniques. Ex: `chore/upgrade-spring-boot`
- `docs/<short-desc>` — documentation seule. Ex: `docs/update-roadmap`

### Conventional Commits

Format : `<type>(<scope>): <short description>`

**Types** : `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `style`, `ci`

**Scopes principaux** :
- `backend` (général)
- `backend:<bounded-context>` (ex: `backend:identity`, `backend:poultry`)
- `web`
- `mobile`
- `infra`
- `docs`

**Exemples** :
```
feat(backend:identity): add JWT refresh endpoint
fix(web): correct sidebar collapse on mobile screens
chore(backend): upgrade Spring Boot to 3.4.1
docs(roadmap): update sprint B3 acceptance criteria
test(backend:identity): add tests for FarmAccess SpEL bean
```

### Pull Requests

Même en solo, on travaille en PR (jamais de commit direct sur `main`).

- 1 PR = 1 sujet (pas de "fourre-tout")
- Titre = titre du dernier commit ou résumé du sprint
- Description : checklist de ce qui est fait + screenshots si UI
- **CI verte avant merge** — vérifier `gh pr checks <n>` (Backend, Web, Mobile / lint-and-test tous `pass`) avant `gh pr merge`
- Rebase merge par défaut (historique linéaire propre sur `main`)

### Pre-PR local validation (recommandée)

Lancer la checklist suivante avant de pusher une PR reste un bon réflexe — c'est plus rapide que d'attendre le retour CI, et ça réduit le nombre de pushs correctifs sur la branche. **Optionnel** dans le cas nominal, mais **obligatoire** si jamais GitHub Actions retombe en incident (cf. [`docs/decisions/003-github-actions-incident.md`](docs/decisions/003-github-actions-incident.md) — l'ADR contient l'historique et la procédure de bascule en cas de récidive).

1. `cd backend && ./mvnw clean verify` — build complet, tous les tests doivent passer, **et** Jacoco doit générer son rapport sans warning bloquant
2. `make backend-run` — l'app doit démarrer sans erreur de boot
3. `curl http://localhost:8080/actuator/health` — doit retourner `{"status":"UP"}` HTTP 200
4. Tous les tests unitaires des modules touchés sont verts (`Tests run: N, Failures: 0, Errors: 0`)
5. Couverture Jacoco du module modifié ≥ seuil défini dans [`docs/05-securite-rbac.md`](docs/05-securite-rbac.md) §7.4 (70% par défaut, 80% pour `common-security`, 90% pour `FarmAccessChecker`)

## Conventions de code

### Backend (Java)

- **Style** : Google Java Style Guide via Spotless (auto-format en build)
- **Naming** : `camelCase` pour méthodes, `PascalCase` pour classes, `UPPER_SNAKE_CASE` pour constantes
- **Packages** : `com.avicare.<bounded-context>.<sub-package>`
- **DTOs** : suffixe `Request` / `Response` (ex: `CreateBatchRequest`, `BatchResponse`)
- **Exceptions** : hériter de `BusinessException` (jamais de `RuntimeException` nu)
- **Tests** : nom de test = `methodName_condition_expectedResult`. Ex: `createBatch_whenFarmIdInvalid_throwsForbidden`

### Web (TypeScript / React)

- **Style** : Prettier + ESLint (auto-format en pre-commit ou save)
- **Composants** : `PascalCase` (`BatchList.tsx`)
- **Hooks** : `camelCase` préfixé `use` (`useSelectedFarm.ts`)
- **Types** : préférer `interface` pour les objets, `type` pour les unions/intersections
- **Imports** : ordre — react → libs externes → @/components → @/hooks → @/lib → relatifs

### Mobile (React Native / TypeScript)

- Mêmes règles que Web pour TypeScript
- **Screens** : `<Name>Screen.tsx` dans `src/screens/`
- **Navigation** : nommer les routes en `UPPER_SNAKE_CASE` dans les types

## Tests

- **Backend** : couverture cible 60 % global, 80 % sur services critiques (security, paramétrage)
- **Web** : tests sur les hooks custom et les composants critiques (forms, auth)
- **Mobile** : tests sur la logique de sync offline + state management

## Variables d'environnement

- Jamais commit de `.env` réel
- Toujours un `.env.example` à jour à côté
- Variables `NEXT_PUBLIC_*` pour ce qui doit être exposé au navigateur
- Variables `EXPO_PUBLIC_*` ou via `.env` Babel pour mobile

## Documentation

- Tout choix d'architecture important → ADR dans `docs/decisions/`
- Le `CHANGELOG.md` est mis à jour à chaque fin de sprint
- Les docs `01-09-*.md` sont la **source de vérité** — si tu changes l'architecture, tu mets à jour le doc

## Travailler avec Claude Code

### Routine recommandée

1. Au démarrage d'une session : donne à Claude Code `docs/00-vision-strategique.md` + la doc de la section en cours
2. Pour un sprint : donne aussi `docs/01-roadmap-v1.md` (section du sprint)
3. Ne demande pas à Claude Code de prendre des décisions d'architecture — demande à Claude (dans le chat)
4. Commits progressifs : ne laisse pas Claude Code commit 50 fichiers en un coup
5. Review chaque PR à toi-même avant merge

## Pitfalls connus

### Piège M2 stale lors du runtime local

**Symptôme**

- `./mvnw verify` passe (tests verts via classpath reactor)
- Mais `make backend-run` boot une app qui utilise un JAR `common-*` **stale** depuis `~/.m2`
- Conséquence : un `@Component` / `@RestControllerAdvice` / Filter fraîchement ajouté n'est **jamais instancié** au runtime
- Bug silencieux : aucune erreur, juste le comportement attendu absent (header manquant, exception non interceptée, etc.)

**Diagnostic**

```bash
jar tf ~/.m2/repository/com/avicare/common-<module>/0.1.0-SNAPSHOT/common-<module>-0.1.0-SNAPSHOT.jar | grep <ClassName>
```

Si la classe ajoutée n'apparaît pas → JAR stale.

**Solution rapide (ponctuelle)**

```bash
cd backend && ./mvnw install -DskipTests
make backend-run
```

**Fix permanent (déjà en place)**

Le `Makefile` préfixe désormais la cible `backend-run` par `./mvnw install -DskipTests -pl avicare-app -am`, ce qui pousse les JARs `common-*` frais dans `~/.m2` avant chaque `spring-boot:run`. Coût : ~2-3s d'install au démarrage local — négligeable face au temps de debug économisé. Le piège ne se manifeste plus si on passe toujours par `make backend-run`. Il peut encore mordre si on appelle `./mvnw spring-boot:run -pl avicare-app ...` directement sans installer d'abord.

Découvert en Sprint A2 Session 2b (cf. [ADR-003](docs/decisions/003-github-actions-incident.md) §Action items).
