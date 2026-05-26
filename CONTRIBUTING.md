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
- CI verte avant merge — **sauf pendant l'incident GitHub Actions en cours**, où on bascule sur la checklist "Local validation" ci-dessous (voir [`docs/decisions/003-github-actions-incident.md`](docs/decisions/003-github-actions-incident.md))
- Rebase merge par défaut (historique linéaire propre sur `main`)

### Local validation checklist (pendant l'incident GitHub Actions)

Tant que les workflows GitHub Actions ne se déclenchent plus (incident officiel, cf. ADR-003), exécuter **toutes** ces étapes localement avant chaque merge sur `main` :

1. `cd backend && ./mvnw clean verify` — build complet, tous les tests doivent passer, **et** Jacoco doit générer son rapport sans warning bloquant
2. `make backend-run` — l'app doit démarrer sans erreur de boot
3. `curl http://localhost:8080/actuator/health` — doit retourner `{"status":"UP"}` HTTP 200
4. Tous les tests unitaires des modules touchés sont verts (`Tests run: N, Failures: 0, Errors: 0`)
5. Couverture Jacoco du module modifié ≥ seuil défini dans [`docs/05-securite-rbac.md`](docs/05-securite-rbac.md) §7.4 (70% par défaut, 80% pour `common-security`, 90% pour `FarmAccessChecker`)

Si l'une de ces étapes échoue : **ne pas merger**. Fixer d'abord.

**Vérification quotidienne** : un coup d'œil à https://www.githubstatus.com en début de session. Dès que GitHub Actions repasse au vert, repousser un commit vide pour confirmer que les workflows triggent à nouveau, puis revenir à la routine "CI verte avant merge" et clore ADR-003.

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
