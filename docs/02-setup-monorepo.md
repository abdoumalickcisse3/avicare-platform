# 02 — Setup mono-repo `avicare-platform`

> Document opérationnel du Sprint A1 (semaine 1 de la Phase A).
> À donner en contexte à Claude Code pour générer le squelette initial du repo.

---

## 1. Objectif du Sprint A1

À la fin de cette semaine, tu dois avoir :

- Un repo GitHub `avicare-platform` initialisé et mono-repo
- L'environnement de dev local qui tourne en une commande
- La CI verte sur la branche `main` après le premier commit
- Les conventions de travail définies et appliquées

**Ce sprint ne contient AUCUN code métier.** C'est de l'infrastructure pure. Résiste à la tentation d'ajouter "juste un petit endpoint pour voir" — ça vient en Sprint A2.

---

## 2. Structure complète du repo

```
avicare-platform/
│
├── .github/
│   └── workflows/
│       ├── backend.yml              # CI backend (build + tests Java)
│       ├── web.yml                  # CI web (build + lint Next.js)
│       ├── mobile.yml               # CI mobile (lint + tests RN)
│       └── docs.yml                 # Vérifie que les .md sont valides
│
├── backend/
│   ├── pom.xml                      # Parent POM (Spring Boot BOM)
│   ├── common/
│   │   ├── common-api/
│   │   │   ├── pom.xml
│   │   │   └── src/main/java/com/avicare/common/api/...
│   │   ├── common-security/
│   │   │   ├── pom.xml
│   │   │   └── src/main/java/com/avicare/common/security/...
│   │   ├── common-tenancy/
│   │   │   ├── pom.xml
│   │   │   └── src/main/java/com/avicare/common/tenancy/...
│   │   └── common-i18n/
│   │       ├── pom.xml
│   │       └── src/main/java/com/avicare/common/i18n/...
│   └── avicare-app/
│       ├── pom.xml
│       ├── src/main/java/com/avicare/AvicareApplication.java
│       ├── src/main/resources/
│       │   ├── application.yml
│       │   ├── application-dev.yml
│       │   ├── application-prod.yml
│       │   └── db/migration/        # Migrations Flyway
│       └── src/test/java/com/avicare/...
│
├── web/
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.mjs
│   ├── .eslintrc.json
│   ├── .prettierrc
│   └── src/
│       ├── app/                     # App Router Next.js 16
│       ├── components/
│       ├── store/                   # Redux Toolkit + RTK Query
│       ├── hooks/
│       ├── lib/
│       ├── types/
│       └── theme/
│
├── mobile/
│   ├── package.json
│   ├── tsconfig.json
│   ├── babel.config.js
│   ├── metro.config.js
│   ├── .eslintrc.json
│   └── src/
│       ├── screens/
│       ├── navigation/
│       ├── components/
│       ├── store/
│       ├── sync/                    # Logique offline-first
│       ├── db/                      # Base locale (WatermelonDB)
│       ├── hooks/
│       └── lib/
│
├── shared/
│   ├── package.json                 # Optionnel, pour types générés
│   └── types/                       # Types TS générés depuis OpenAPI
│
├── docs/
│   ├── 00-vision-strategique.md
│   ├── 01-roadmap-v1.md
│   ├── 02-setup-monorepo.md         # CE DOCUMENT
│   ├── 03-architecture-spring-boot.md
│   ├── 04-schema-db-initial.md
│   ├── 05-securite-rbac.md
│   ├── 06-cross-cutting.md
│   ├── 07-frontend-nextjs.md
│   ├── 08-mobile-react-native.md
│   ├── 09-plan-j1-j30.md
│   ├── decisions/                   # ADRs
│   │   └── 001-monolithe-modulaire.md
│   └── legacy-reference/
│       └── ARCHITECTURE.md          # Bible GINAARTECH
│
├── infra/
│   ├── docker-compose.yml           # Dev local (Postgres + Redis + mailhog)
│   ├── docker-compose.prod.yml      # Production (à compléter en Phase C)
│   ├── Dockerfile.backend           # À créer en Phase C
│   ├── Dockerfile.web               # À créer en Phase C
│   └── scripts/
│       ├── reset-db.sh
│       ├── seed-dev.sh
│       └── backup-db.sh
│
├── .gitignore
├── .editorconfig
├── .gitattributes
├── Makefile                         # Commandes raccourcies
├── README.md
├── LICENSE
├── CHANGELOG.md
├── CONTRIBUTING.md                  # Conventions
└── avicare-platform.code-workspace  # VS Code multi-root
```

---

## 3. Fichiers à créer un par un

### 3.1 — `.gitignore` (racine)

```gitignore
# IDEs
.idea/
.vscode/*
!.vscode/extensions.json
!.vscode/settings.json
*.iml
*.swp
.DS_Store
Thumbs.db

# Java / Maven
backend/**/target/
backend/**/.mvn/
backend/**/*.log
backend/**/HELP.md
*.class

# Node / Next.js
web/node_modules/
web/.next/
web/out/
web/build/
web/.env.local
web/.env.*.local

# React Native
mobile/node_modules/
mobile/android/build/
mobile/android/app/build/
mobile/android/.gradle/
mobile/ios/build/
mobile/ios/Pods/
mobile/ios/DerivedData/
mobile/.expo/
mobile/dist/
mobile/web-build/
mobile/.env.local

# Logs
*.log
logs/

# Env files (jamais commit)
.env
.env.local
.env.*.local
!.env.example

# Secrets
**/secrets.yml
**/secrets.json
**/*.key
**/*.pem

# OS
*.tmp
*.bak

# Docker volumes locaux
infra/data/

# Coverage reports
**/coverage/
**/.nyc_output/

# OpenAPI generated
shared/types/generated/
```

### 3.2 — `.editorconfig` (racine)

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
indent_style = space
indent_size = 2

[*.{java,xml}]
indent_size = 4

[*.{md,yml,yaml}]
indent_size = 2

[Makefile]
indent_style = tab
```

### 3.3 — `Makefile` (racine)

```makefile
.PHONY: help up down restart logs backend-run backend-test web-dev web-build mobile-android mobile-ios reset-db

help:
	@echo "Available commands:"
	@echo "  make up               - Démarre l'environnement Docker (Postgres + Redis)"
	@echo "  make down             - Arrête l'environnement Docker"
	@echo "  make restart          - Redémarre l'environnement Docker"
	@echo "  make logs             - Affiche les logs Docker"
	@echo "  make backend-run      - Lance le backend Spring Boot en mode dev"
	@echo "  make backend-test     - Lance les tests backend"
	@echo "  make web-dev          - Lance le frontend Next.js en mode dev"
	@echo "  make web-build        - Build le frontend Next.js"
	@echo "  make mobile-android   - Lance l'app mobile sur Android"
	@echo "  make mobile-ios       - Lance l'app mobile sur iOS"
	@echo "  make reset-db         - Réinitialise la DB locale (DANGEREUX)"

up:
	docker-compose -f infra/docker-compose.yml up -d
	@echo "PostgreSQL : localhost:5432"
	@echo "Redis      : localhost:6379"
	@echo "MailHog UI : http://localhost:8025"

down:
	docker-compose -f infra/docker-compose.yml down

restart: down up

logs:
	docker-compose -f infra/docker-compose.yml logs -f

backend-run:
	cd backend && ./mvnw spring-boot:run -pl avicare-app -Dspring-boot.run.profiles=dev

backend-test:
	cd backend && ./mvnw test

backend-package:
	cd backend && ./mvnw clean package -DskipTests

web-dev:
	cd web && npm run dev

web-build:
	cd web && npm run build

web-lint:
	cd web && npm run lint

mobile-android:
	cd mobile && npm run android

mobile-ios:
	cd mobile && npm run ios

reset-db:
	@echo "⚠️  Cette action va SUPPRIMER toutes les données locales !"
	@read -p "Confirmer (yes/no) : " confirm; \
	if [ "$$confirm" = "yes" ]; then \
		bash infra/scripts/reset-db.sh; \
	else \
		echo "Annulé."; \
	fi
```

### 3.4 — `infra/docker-compose.yml`

```yaml
name: avicare-platform-dev

services:
  postgres:
    image: postgres:16-alpine
    container_name: avicare-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: avicare
      POSTGRES_USER: avicare
      POSTGRES_PASSWORD: avicare_dev_pwd
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U avicare"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: avicare-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  mailhog:
    image: mailhog/mailhog:latest
    container_name: avicare-mailhog
    restart: unless-stopped
    ports:
      - "1025:1025"  # SMTP
      - "8025:8025"  # Web UI

volumes:
  postgres_data:
  redis_data:
```

### 3.5 — `infra/scripts/reset-db.sh`

```bash
#!/usr/bin/env bash
set -e
echo "Suppression des volumes Docker..."
docker-compose -f infra/docker-compose.yml down -v
echo "Redémarrage..."
docker-compose -f infra/docker-compose.yml up -d
echo "✅ DB réinitialisée. Lance le backend pour appliquer les migrations Flyway."
```

### 3.6 — `README.md` (racine)

```markdown
# AviCare Platform

> Plateforme SaaS multi-tenant de gestion d'élevage en Afrique de l'Ouest.
> Volaille en V1 → multi-espèces (ovins, bovins, caprins) en V2+.

## Stack technique

- **Backend** : Spring Boot 3.4 + PostgreSQL 16 + Redis + Flyway
- **Web** : Next.js 16 + React 19 + TypeScript + MUI v7 + Redux Toolkit
- **Mobile** : React Native (offline-first, multi-rôles)

## Statut

🚧 **En cours de reconstruction** depuis l'ancien projet [`avicare-pro`](https://github.com/abdoumalickcisse3/avicare-pro).
Voir [`docs/legacy-reference/ARCHITECTURE.md`](./docs/legacy-reference/ARCHITECTURE.md) pour la référence métier de l'ancienne version.

## Prérequis

- Java 21 LTS
- Maven 3.9+
- Node.js 20+ et npm 10+
- Docker & Docker Compose
- (Mobile) Android Studio + Xcode (pour iOS sur macOS)

## Démarrage rapide

```bash
# 1. Cloner le repo
git clone https://github.com/abdoumalickcisse3/avicare-platform.git
cd avicare-platform

# 2. Démarrer l'environnement
make up

# 3. Lancer le backend (dans un terminal)
make backend-run

# 4. Lancer le web (dans un autre terminal)
cd web && npm install && cd ..
make web-dev

# 5. (Plus tard) Lancer le mobile
cd mobile && npm install && cd ..
make mobile-android
```

Ouvrez : http://localhost:3000

## Structure du projet

- `backend/` — Spring Boot, monolithe modulaire (Maven multi-module)
- `web/` — Next.js 16 App Router
- `mobile/` — React Native (offline-first)
- `shared/` — Types TypeScript générés depuis OpenAPI
- `docs/` — Documentation du projet
- `infra/` — Docker, scripts, déploiement

## Documentation

- [Vision stratégique](./docs/00-vision-strategique.md)
- [Roadmap V1](./docs/01-roadmap-v1.md)
- [Setup mono-repo](./docs/02-setup-monorepo.md)
- [Conventions](./CONTRIBUTING.md)

## Licence

Propriétaire — © Abdou Malick Cisse, 2025-2026. Tous droits réservés.

## Contact

[À compléter]
```

### 3.7 — `CONTRIBUTING.md`

```markdown
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
- CI verte avant merge
- Squash & merge par défaut (un seul commit propre sur `main`)

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
3. Ne demande pas à Claude Code de prendre des décisions d'architecture — demande à Claude (dans le chat ici)
4. Commits progressifs : ne laisse pas Claude Code commit 50 fichiers en un coup
5. Review chaque PR à toi-même avant merge
```

### 3.8 — `avicare-platform.code-workspace` (VS Code multi-root)

```json
{
  "folders": [
    { "name": "📚 Root", "path": "." },
    { "name": "☕ Backend", "path": "backend" },
    { "name": "🌐 Web", "path": "web" },
    { "name": "📱 Mobile", "path": "mobile" },
    { "name": "📖 Docs", "path": "docs" },
    { "name": "🏗️ Infra", "path": "infra" }
  ],
  "settings": {
    "editor.formatOnSave": true,
    "editor.codeActionsOnSave": {
      "source.fixAll.eslint": "explicit"
    },
    "java.configuration.updateBuildConfiguration": "automatic",
    "java.format.settings.url": "https://raw.githubusercontent.com/google/styleguide/gh-pages/eclipse-java-google-style.xml",
    "[java]": {
      "editor.defaultFormatter": "redhat.java",
      "editor.tabSize": 4
    },
    "[typescript]": {
      "editor.defaultFormatter": "esbenp.prettier-vscode"
    },
    "[typescriptreact]": {
      "editor.defaultFormatter": "esbenp.prettier-vscode"
    },
    "files.exclude": {
      "**/.git": true,
      "**/.DS_Store": true,
      "**/node_modules": true,
      "**/target": true,
      "**/.next": true
    }
  },
  "extensions": {
    "recommendations": [
      "vscjava.vscode-java-pack",
      "vmware.vscode-spring-boot",
      "redhat.java",
      "esbenp.prettier-vscode",
      "dbaeumer.vscode-eslint",
      "bradlc.vscode-tailwindcss",
      "GitHub.copilot",
      "ms-azuretools.vscode-docker",
      "yzhang.markdown-all-in-one"
    ]
  }
}
```

### 3.9 — Backend `backend/pom.xml` (parent BOM)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>com.avicare</groupId>
    <artifactId>avicare-platform-parent</artifactId>
    <version>0.1.0-SNAPSHOT</version>
    <packaging>pom</packaging>

    <name>AviCare Platform — Parent</name>

    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.4.1</version>
        <relativePath/>
    </parent>

    <properties>
        <java.version>21</java.version>
        <maven.compiler.source>21</maven.compiler.source>
        <maven.compiler.target>21</maven.compiler.target>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>

        <spring-cloud.version>2024.0.0</spring-cloud.version>
        <jjwt.version>0.12.6</jjwt.version>
        <mapstruct.version>1.6.3</mapstruct.version>
        <lombok.version>1.18.36</lombok.version>
        <springdoc.version>2.7.0</springdoc.version>
        <testcontainers.version>1.20.4</testcontainers.version>
        <spotless.version>2.44.0</spotless.version>
    </properties>

    <modules>
        <module>common/common-api</module>
        <module>common/common-security</module>
        <module>common/common-tenancy</module>
        <module>common/common-i18n</module>
        <module>avicare-app</module>
    </modules>

    <dependencyManagement>
        <dependencies>
            <dependency>
                <groupId>org.springframework.cloud</groupId>
                <artifactId>spring-cloud-dependencies</artifactId>
                <version>${spring-cloud.version}</version>
                <type>pom</type>
                <scope>import</scope>
            </dependency>
            <dependency>
                <groupId>io.jsonwebtoken</groupId>
                <artifactId>jjwt-api</artifactId>
                <version>${jjwt.version}</version>
            </dependency>
            <dependency>
                <groupId>io.jsonwebtoken</groupId>
                <artifactId>jjwt-impl</artifactId>
                <version>${jjwt.version}</version>
                <scope>runtime</scope>
            </dependency>
            <dependency>
                <groupId>io.jsonwebtoken</groupId>
                <artifactId>jjwt-jackson</artifactId>
                <version>${jjwt.version}</version>
                <scope>runtime</scope>
            </dependency>
            <dependency>
                <groupId>org.mapstruct</groupId>
                <artifactId>mapstruct</artifactId>
                <version>${mapstruct.version}</version>
            </dependency>
            <dependency>
                <groupId>org.springdoc</groupId>
                <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
                <version>${springdoc.version}</version>
            </dependency>
        </dependencies>
    </dependencyManagement>

    <build>
        <pluginManagement>
            <plugins>
                <plugin>
                    <groupId>com.diffplug.spotless</groupId>
                    <artifactId>spotless-maven-plugin</artifactId>
                    <version>${spotless.version}</version>
                    <configuration>
                        <java>
                            <googleJavaFormat>
                                <version>1.24.0</version>
                                <style>GOOGLE</style>
                            </googleJavaFormat>
                            <removeUnusedImports/>
                            <trimTrailingWhitespace/>
                            <endWithNewline/>
                        </java>
                    </configuration>
                </plugin>
            </plugins>
        </pluginManagement>

        <plugins>
            <plugin>
                <groupId>com.diffplug.spotless</groupId>
                <artifactId>spotless-maven-plugin</artifactId>
            </plugin>
        </plugins>
    </build>
</project>
```

### 3.10 — Backend modules `common/*/pom.xml` (squelette minimal)

Pour chaque module `common-api`, `common-security`, `common-tenancy`, `common-i18n`, crée un `pom.xml` minimal :

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>

    <parent>
        <groupId>com.avicare</groupId>
        <artifactId>avicare-platform-parent</artifactId>
        <version>0.1.0-SNAPSHOT</version>
        <relativePath>../../pom.xml</relativePath>
    </parent>

    <artifactId>common-api</artifactId>
    <name>AviCare Common — API</name>
    <description>Shared API contracts: ApiResponse, RFC 7807, exceptions, CorrelationIdFilter</description>

    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-validation</artifactId>
        </dependency>
        <dependency>
            <groupId>org.projectlombok</groupId>
            <artifactId>lombok</artifactId>
            <optional>true</optional>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
    </dependencies>
</project>
```

Le contenu Java de chaque module sera créé en Sprint A2 — pour A1, **vide ou avec une seule classe placeholder**.

### 3.11 — Backend `avicare-app/pom.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>

    <parent>
        <groupId>com.avicare</groupId>
        <artifactId>avicare-platform-parent</artifactId>
        <version>0.1.0-SNAPSHOT</version>
        <relativePath>../pom.xml</relativePath>
    </parent>

    <artifactId>avicare-app</artifactId>
    <name>AviCare Platform — Application</name>
    <description>Main Spring Boot application (modular monolith)</description>

    <dependencies>
        <dependency>
            <groupId>com.avicare</groupId>
            <artifactId>common-api</artifactId>
            <version>${project.version}</version>
        </dependency>
        <dependency>
            <groupId>com.avicare</groupId>
            <artifactId>common-security</artifactId>
            <version>${project.version}</version>
        </dependency>
        <dependency>
            <groupId>com.avicare</groupId>
            <artifactId>common-tenancy</artifactId>
            <version>${project.version}</version>
        </dependency>
        <dependency>
            <groupId>com.avicare</groupId>
            <artifactId>common-i18n</artifactId>
            <version>${project.version}</version>
        </dependency>

        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-data-jpa</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-data-redis</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-security</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-validation</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-actuator</artifactId>
        </dependency>

        <dependency>
            <groupId>org.flywaydb</groupId>
            <artifactId>flyway-core</artifactId>
        </dependency>
        <dependency>
            <groupId>org.flywaydb</groupId>
            <artifactId>flyway-database-postgresql</artifactId>
        </dependency>
        <dependency>
            <groupId>org.postgresql</groupId>
            <artifactId>postgresql</artifactId>
            <scope>runtime</scope>
        </dependency>

        <dependency>
            <groupId>org.springdoc</groupId>
            <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
        </dependency>

        <dependency>
            <groupId>org.projectlombok</groupId>
            <artifactId>lombok</artifactId>
            <optional>true</optional>
        </dependency>
        <dependency>
            <groupId>org.mapstruct</groupId>
            <artifactId>mapstruct</artifactId>
        </dependency>

        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>org.testcontainers</groupId>
            <artifactId>postgresql</artifactId>
            <scope>test</scope>
            <version>${testcontainers.version}</version>
        </dependency>
        <dependency>
            <groupId>org.testcontainers</groupId>
            <artifactId>junit-jupiter</artifactId>
            <scope>test</scope>
            <version>${testcontainers.version}</version>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
            </plugin>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-compiler-plugin</artifactId>
                <configuration>
                    <annotationProcessorPaths>
                        <path>
                            <groupId>org.projectlombok</groupId>
                            <artifactId>lombok</artifactId>
                            <version>${lombok.version}</version>
                        </path>
                        <path>
                            <groupId>org.mapstruct</groupId>
                            <artifactId>mapstruct-processor</artifactId>
                            <version>${mapstruct.version}</version>
                        </path>
                    </annotationProcessorPaths>
                </configuration>
            </plugin>
        </plugins>
    </build>
</project>
```

### 3.12 — `backend/avicare-app/src/main/java/com/avicare/AvicareApplication.java`

```java
package com.avicare;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class AvicareApplication {

    public static void main(String[] args) {
        SpringApplication.run(AvicareApplication.class, args);
    }
}
```

### 3.13 — `backend/avicare-app/src/main/resources/application.yml`

```yaml
spring:
  application:
    name: avicare-app
  profiles:
    active: ${SPRING_PROFILES_ACTIVE:dev}

server:
  port: ${SERVER_PORT:8080}
  shutdown: graceful

management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics
  endpoint:
    health:
      show-details: when-authorized

springdoc:
  api-docs:
    path: /v3/api-docs
  swagger-ui:
    path: /swagger-ui.html
```

### 3.14 — `backend/avicare-app/src/main/resources/application-dev.yml`

```yaml
spring:
  datasource:
    url: jdbc:postgresql://${DB_HOST:localhost}:${DB_PORT:5432}/${DB_NAME:avicare}
    username: ${DB_USER:avicare}
    password: ${DB_PASSWORD:avicare_dev_pwd}
    hikari:
      maximum-pool-size: 10

  jpa:
    hibernate:
      ddl-auto: validate
    properties:
      hibernate:
        format_sql: true
    show-sql: false

  flyway:
    enabled: true
    locations: classpath:db/migration
    baseline-on-migrate: true

  data:
    redis:
      host: ${REDIS_HOST:localhost}
      port: ${REDIS_PORT:6379}

logging:
  level:
    root: INFO
    com.avicare: DEBUG
    org.springframework.web: INFO
    org.hibernate.SQL: DEBUG
```

### 3.15 — `web/` setup minimal

À créer après initialisation Next.js (`npx create-next-app@latest web --typescript --tailwind=false --app --import-alias "@/*"`).

Compléter avec :

**`web/package.json`** (extrait des dépendances importantes à ajouter) :

```json
{
  "dependencies": {
    "@reduxjs/toolkit": "^2.5.0",
    "react-redux": "^9.2.0",
    "@mui/material": "^7.0.0",
    "@mui/icons-material": "^7.0.0",
    "@emotion/react": "^11.14.0",
    "@emotion/styled": "^11.14.0",
    "axios": "^1.7.9"
  }
}
```

### 3.16 — `mobile/` setup minimal

À créer via Expo (recommandé pour démarrer) : `npx create-expo-app@latest mobile --template`.

Ou React Native CLI bare si tu préfères : `npx @react-native-community/cli init mobile`.

**Recommandation** : démarrer avec **Expo** (config zero, gestion des permissions plus simple, OTA updates), puis "eject" plus tard si besoin de natif custom (peu probable pour ton cas).

### 3.17 — `.github/workflows/backend.yml`

```yaml
name: Backend CI

on:
  push:
    branches: [main, develop]
    paths:
      - 'backend/**'
      - '.github/workflows/backend.yml'
  pull_request:
    paths:
      - 'backend/**'

jobs:
  build:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: avicare_test
          POSTGRES_USER: avicare
          POSTGRES_PASSWORD: test_pwd
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - name: Set up JDK 21
        uses: actions/setup-java@v4
        with:
          java-version: '21'
          distribution: 'temurin'
          cache: maven

      - name: Build with Maven
        working-directory: ./backend
        run: ./mvnw -B clean package

      - name: Run tests
        working-directory: ./backend
        env:
          DB_HOST: localhost
          DB_PORT: 5432
          DB_NAME: avicare_test
          DB_USER: avicare
          DB_PASSWORD: test_pwd
        run: ./mvnw -B test

      - name: Upload test reports
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: surefire-reports
          path: backend/**/target/surefire-reports/
```

### 3.18 — `.github/workflows/web.yml`

```yaml
name: Web CI

on:
  push:
    branches: [main, develop]
    paths:
      - 'web/**'
      - '.github/workflows/web.yml'
  pull_request:
    paths:
      - 'web/**'

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: web/package-lock.json

      - name: Install dependencies
        working-directory: ./web
        run: npm ci

      - name: Lint
        working-directory: ./web
        run: npm run lint

      - name: Type check
        working-directory: ./web
        run: npx tsc --noEmit

      - name: Build
        working-directory: ./web
        run: npm run build
```

### 3.19 — `.github/workflows/mobile.yml`

```yaml
name: Mobile CI

on:
  push:
    branches: [main, develop]
    paths:
      - 'mobile/**'
      - '.github/workflows/mobile.yml'
  pull_request:
    paths:
      - 'mobile/**'

jobs:
  lint-and-test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: mobile/package-lock.json

      - name: Install dependencies
        working-directory: ./mobile
        run: npm ci

      - name: Lint
        working-directory: ./mobile
        run: npm run lint || true

      - name: Type check
        working-directory: ./mobile
        run: npx tsc --noEmit
```

### 3.20 — `docs/decisions/001-monolithe-modulaire.md` (premier ADR)

```markdown
# ADR 001 — Monolithe modulaire Spring Boot

**Date** : 2025-XX-XX
**Statut** : Accepté
**Auteur** : Abdou Malick Cisse

## Contexte

Le projet AviCare Platform est une reconstruction de GINAARTECH avec :
- Élargissement multi-espèces (volaille → ovins → bovins...)
- Changement de stack (AdonisJS → Spring Boot)
- Ajout d'un mobile React Native
- Construction en solo

La question est : choisir une architecture **monolithe modulaire** ou **micro-services** dès le départ ?

## Décision

Nous adoptons une architecture **monolithe modulaire** : un seul service Spring Boot (`avicare-app`) avec des bounded contexts DDD organisés en packages, et des libs communes (`common-*`) extraites en modules Maven.

## Conséquences

### Positives

- Vélocité de développement maximale en solo (un seul process, un seul déploiement)
- Transactions ACID natives entre bounded contexts
- Refactoring inter-contexte facile
- Coût d'infra minimal (1 instance vs N services)
- Apprentissage Spring Boot focalisé sur l'essentiel

### Négatives

- Scaling vertical seulement (pas de scaling indépendant d'un module)
- Risque de couplage si la discipline DDD n'est pas respectée
- Tous les modules redéployés ensemble

### Mitigations

- Respect strict de la séparation par bounded context (1 package = 1 contexte)
- Communication inter-contexte par interfaces de service publiques uniquement
- Extraction en service séparé possible plus tard si un module justifie le découplage (ex: notifications async, IA)

## Alternatives écartées

- **Micro-services from day one** : sur-engineering pour un projet solo, complexité réseau/déploiement inutile, transactions distribuées coûteuses.
- **Monolithe non-modulaire** : risque de spaghetti code à 6 mois, difficulté à extraire des modules plus tard.

## Référence

- Template d'architecture fourni au projet (`ARCHITECTURE_TEMPLATE.md`)
- Vision stratégique : `docs/00-vision-strategique.md` règle 1
```

---

## 4. Checklist Sprint A1 — étape par étape

À cocher au fur et à mesure :

### Jour 1 — Setup repo

- [ ] Créer le repo `avicare-platform` sur GitHub (privé d'abord)
- [ ] Cloner localement
- [ ] Créer la structure de dossiers vide (voir §2)
- [ ] Créer `.gitignore`, `.editorconfig`, `.gitattributes`
- [ ] Créer `README.md`, `LICENSE`, `CHANGELOG.md`, `CONTRIBUTING.md`
- [ ] Commit initial : `chore: initial repository structure`
- [ ] Push sur `main`

### Jour 2 — Documentation fondatrice

- [ ] Copier `00-vision-strategique.md` dans `docs/`
- [ ] Copier `01-roadmap-v1.md` dans `docs/`
- [ ] Copier `02-setup-monorepo.md` dans `docs/` (ce document)
- [ ] Copier `ARCHITECTURE.md` de GINAARTECH dans `docs/legacy-reference/`
- [ ] Créer `docs/decisions/001-monolithe-modulaire.md`
- [ ] Commit : `docs: add founding documents`

### Jour 3 — Infrastructure locale

- [ ] Créer `infra/docker-compose.yml`
- [ ] Créer `infra/scripts/reset-db.sh` (rendre exécutable : `chmod +x`)
- [ ] Créer `Makefile` à la racine
- [ ] Tester `make up` : Postgres + Redis + MailHog démarrent
- [ ] Tester `make down`
- [ ] Commit : `chore(infra): add docker-compose for local dev`

### Jour 4 — Backend Maven multi-module

- [ ] Créer `backend/pom.xml` (parent BOM)
- [ ] Créer le dossier `backend/.mvn/wrapper/` et installer Maven Wrapper : depuis le dossier `backend/`, lancer `mvn -N io.takari:maven:wrapper`
- [ ] Créer `backend/common/common-api/pom.xml` + une classe placeholder
- [ ] Créer `backend/common/common-security/pom.xml` + une classe placeholder
- [ ] Créer `backend/common/common-tenancy/pom.xml` + une classe placeholder
- [ ] Créer `backend/common/common-i18n/pom.xml` + une classe placeholder
- [ ] Créer `backend/avicare-app/pom.xml`
- [ ] Créer `backend/avicare-app/src/main/java/com/avicare/AvicareApplication.java`
- [ ] Créer `backend/avicare-app/src/main/resources/application.yml`
- [ ] Créer `backend/avicare-app/src/main/resources/application-dev.yml`
- [ ] Lancer `./mvnw clean install` depuis `backend/` — doit builder sans erreur
- [ ] Lancer `make backend-run` — le backend doit démarrer (même si vide)
- [ ] Tester `http://localhost:8080/actuator/health` → 200 OK
- [ ] Commit : `feat(backend): scaffold maven multi-module structure`

### Jour 5 — Frontend web

- [ ] `cd web && npx create-next-app@latest . --typescript --app --import-alias "@/*"` (Tailwind: NON ; ESLint: OUI)
- [ ] Installer les dépendances additionnelles : `npm install @reduxjs/toolkit react-redux @mui/material @emotion/react @emotion/styled @mui/icons-material axios`
- [ ] Vérifier `npm run dev` → http://localhost:3000 affiche la page Next.js par défaut
- [ ] Configurer `.prettierrc` minimaliste
- [ ] Commit : `feat(web): scaffold next.js 16 with mui and redux`

### Jour 6 — Mobile

- [ ] `cd mobile && npx create-expo-app@latest . --template blank-typescript` (si Expo)
- [ ] Vérifier `npm run start` → QR code Expo lisible
- [ ] Tester `npm run android` ou `npm run ios` selon l'OS
- [ ] Commit : `feat(mobile): scaffold expo react native typescript`

### Jour 7 — CI/CD et finitions

- [ ] Créer `.github/workflows/backend.yml`
- [ ] Créer `.github/workflows/web.yml`
- [ ] Créer `.github/workflows/mobile.yml`
- [ ] Créer `avicare-platform.code-workspace`
- [ ] Push, vérifier que toutes les CI passent au vert sur `main`
- [ ] Configurer la protection de branche `main` sur GitHub (require PR + CI verte)
- [ ] Tag `v0.1.0-setup` : `git tag v0.1.0-setup && git push --tags`
- [ ] Mise à jour `CHANGELOG.md` avec un changelog initial
- [ ] Commit final : `chore: complete sprint A1 — repository setup`

---

## 5. Critères d'acceptation finaux du Sprint A1

À la fin de la semaine 1, **tous** ces points doivent être cochés :

- [ ] `git clone` → `make up` → `make backend-run` → `make web-dev` → l'environnement complet est utilisable
- [ ] `./mvnw clean install` sur `backend/` build sans erreur
- [ ] `npm run build` sur `web/` build sans erreur
- [ ] `npm run start` sur `mobile/` démarre l'app Expo
- [ ] La CI GitHub Actions est verte sur `main`
- [ ] `main` est protégée (require PR + status checks)
- [ ] La structure de dossier finale correspond à §2
- [ ] Tous les fichiers de §3 existent et sont versionnés
- [ ] Les 3 docs fondateurs sont présents dans `docs/` (`00`, `01`, `02`)
- [ ] L'ADR 001 est dans `docs/decisions/`
- [ ] L'ARCHITECTURE.md de GINAARTECH est dans `docs/legacy-reference/`
- [ ] Le workspace VS Code ouvre proprement les 6 racines
- [ ] Premier tag `v0.1.0-setup` poussé

---

## 6. Pièges fréquents à éviter

| Piège | Mitigation |
|---|---|
| Vouloir "ajouter juste un endpoint" en A1 | Non. A1 = infra pure. Le métier vient en A3+. |
| Setup compliqué avec Turborepo / Nx dès le début | Non. On reste simple. Outils mono-repo si vraiment nécessaire en V2. |
| Skip la CI au début ("on verra plus tard") | Non. La CI doit être en place avant le premier code métier. |
| Mauvais `.gitignore` qui commit des secrets | Vérifier 2× le `.gitignore` avant le premier push. |
| Versions Java/Node incohérentes entre dev et CI | Fixer Java 21 et Node 20 partout, dans `pom.xml` et workflows. |
| Tester le mobile en dernier alors qu'Expo a des prérequis | Faire le jour 6 même si pas confortable, pour valider tôt. |
| Conventions de commit non respectées dès le J1 | Discipline. Utiliser `git commit -m "feat(scope): ..."` toujours. |

---

## 7. Que faire après le Sprint A1 ?

Une fois ce sprint terminé :

1. Mise à jour du `CHANGELOG.md` avec la version `0.1.0-setup`
2. Lire le document `03-architecture-spring-boot.md` (à venir)
3. Démarrer le **Sprint A2** : implémentation des `common-*` (api, security, tenancy, i18n)

---

## 8. Prompt type pour Claude Code

Quand tu démarres une session avec Claude Code pour ce sprint, voici un prompt type :

```
Lis attentivement les documents suivants dans l'ordre :
1. docs/00-vision-strategique.md — la vision globale du projet
2. docs/01-roadmap-v1.md — la roadmap V1, particulièrement le Sprint A1
3. docs/02-setup-monorepo.md — ce document, qui détaille le Sprint A1

Mon objectif aujourd'hui : avancer sur la checklist du Sprint A1, jour [X].
Mes contraintes :
- Suivre exactement la structure du document
- Respecter les conventions de commit (Conventional Commits)
- Ne pas ajouter de code métier (réservé pour les sprints suivants)
- Me demander avant toute décision d'architecture qui n'est pas dans le doc

Question/tâche du jour : [ta question concrète]
```

---

_Document créé en démarrage du projet. À mettre à jour si l'outillage change._
