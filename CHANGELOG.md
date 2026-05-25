# Changelog

Toutes les modifications notables de ce projet seront documentées dans ce fichier.

Le format est basé sur [Keep a Changelog 1.1.0](https://keepachangelog.com/fr/1.1.0/),
et ce projet adhère au [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

_Rien encore. Le sprint A2 (common-*) démarre ici._

## [0.1.0-setup] — 2026-05-25

Sprint A1 complete. Mono-repo en place avec backend Spring Boot, web Next.js, mobile Expo, infrastructure Docker locale et CI/CD GitHub Actions. Aucun code applicatif encore — uniquement le squelette technique.

### Added — Repository & documentation

- Structure mono-repo : `backend/`, `web/`, `mobile/`, `shared/`, `infra/`, `docs/`, `.github/`
- Fichiers racine : `.gitignore`, `.editorconfig`, `.gitattributes`, `README.md`, `LICENSE` (propriétaire), `CONTRIBUTING.md`, `Makefile`, `CHANGELOG.md`, `avicare-platform.code-workspace`
- Documents fondateurs dans `docs/` : `INDEX.md`, `00-vision-strategique.md`, `01-roadmap-v1.md`, `02-setup-monorepo.md`, `03-architecture-spring-boot.md`, `04-schema-db-initial.md`
- `docs/legacy-reference/ARCHITECTURE.md` : référence métier GINAARTECH (V0 AdonisJS), importée depuis le repo `avicare-pro`
- `docs/decisions/001-monolithe-modulaire.md` : premier ADR validant l'architecture monolithe modulaire Spring Boot

### Added — Infrastructure locale

- `infra/docker-compose.yml` : Postgres 16 + Redis 7 + MailHog (healthchecks, volumes nommés)
- `infra/scripts/reset-db.sh` : helper pour réinitialiser les volumes locaux
- `Makefile` : raccourcis `up`/`down`/`restart`/`logs`/`reset-db` + placeholders backend/web/mobile

### Added — Backend (Spring Boot 3.4 + Java 21)

- `backend/pom.xml` : parent Maven multi-module (BOM Spring Boot 3.4.1, versions centralisées Spring Cloud / JJWT / MapStruct / Lombok / SpringDoc / Testcontainers / Spotless)
- 4 modules `common-*` (api, security, tenancy, i18n) avec POM minimal et classes placeholders — le code réel arrive au sprint A2
- `backend/avicare-app/` : module principal avec `AvicareApplication`, `application.yml`, `application-dev.yml`
- Backend démarre, expose `/actuator/health` → `{"status":"UP"}`, `/v3/api-docs` opérationnel, Flyway baseline sur DB vide
- Maven Wrapper Takari (distribuant Maven 3.9.9) — `./mvnw` versionné, pas besoin de Maven local pour build

### Added — Web (Next.js 16 + React 19 + TypeScript)

- `web/` scaffold via `create-next-app` : App Router, ESLint flat config, src/ layout, alias `@/*`, Turbopack par défaut
- Dépendances additionnelles : MUI v9, Emotion, Redux Toolkit, react-redux, Axios
- `web/.prettierrc` : style maison (singleQuote, trailingComma all, printWidth 100, tabWidth 2, semi true)
- Build, lint, dev server testés OK

### Added — Mobile (Expo SDK 56 + React Native 0.85 + TypeScript 6)

- `mobile/` scaffold via `create-expo-app --template blank-typescript`
- `mobile/.prettierrc` : même style maison que web
- `mobile/.gitignore` complété (`.expo-shared/`)
- Metro démarre OK sur le port configuré

### Added — CI/CD

- `.github/workflows/backend.yml` : build Maven + tests avec service Postgres 16, upload des surefire-reports
- `.github/workflows/web.yml` : `npm ci` + lint + `tsc --noEmit` + build
- `.github/workflows/mobile.yml` : `npm ci` + lint (soft) + `tsc --noEmit`
- Les 3 workflows verts au push de clôture A1

### Notes — Écarts documentés vs doc 02 (cohabitation locale)

Cinq services tournent déjà sur les ports standards (postgresql@18 Homebrew, ginaartech_postgres, ginaartech_redis, autre next-server, UVDistribution.Mobile expo). Plutôt que les stopper, le dev local utilise des ports décalés :

| Service | Doc | Local (host) | Container |
|---|---|---|---|
| Postgres | 5432 | **5434** | 5432 |
| Redis | 6379 | **6380** | 6379 |
| Next.js dev | 3000 | **3001** | — |
| Expo Metro | 8081 | **8082** | — |

La CI utilise les ports standards (5432) — pas de conflit dans un environnement isolé.

### Notes — Spring Security

`AvicareApplication` exclut temporairement `SecurityAutoConfiguration` ET `ManagementWebSecurityAutoConfiguration` pour que `/actuator/health` ne soit pas verrouillé derrière HTTP Basic au démarrage. **À retirer au Sprint A2/A3** quand `common-security` fournira le vrai `SecurityFilterChain` + `JwtFilter`.

### Notes — Versions installées

- Backend : Spring Boot **3.4.1**, Java **21.0.9** (Temurin / JBR), Maven **3.9.9** via wrapper
- Web : Next.js **16.2.6**, React **19.2.4**, TypeScript **5.x**, MUI **9.0.1** (doc disait v7 — flexibilité prévue par doc 00)
- Mobile : Expo **56.0.4**, React Native **0.85.3**, TypeScript **6.0.3**

### Outils installés via Homebrew (pré-requis dev locaux)

- Maven 3.9.16 (pour générer le wrapper initial)
- Watchman 2026.05.18.00 (recommandé Expo/Metro)

---

[Unreleased]: https://github.com/abdoumalickcisse3/avicare-platform/compare/v0.1.0-setup...main
[0.1.0-setup]: https://github.com/abdoumalickcisse3/avicare-platform/releases/tag/v0.1.0-setup
