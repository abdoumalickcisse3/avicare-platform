# Jawdi Platform

> Plateforme SaaS multi-tenant de gestion d'élevage en Afrique de l'Ouest.
> Volaille en V1 → multi-espèces (ovins, bovins, caprins) en V2+.

## Stack technique

- **Backend** : Spring Boot 3.4 + PostgreSQL 16 + Redis + Flyway
- **Web** : Next.js 16 + React 19 + TypeScript + MUI v7 + Redux Toolkit
- **Mobile** : React Native (offline-first, multi-rôles)

## Statut

🚧 **En cours de reconstruction** depuis l'ancien projet [`avicare-pro`](https://github.com/abdoumalickcisse3/avicare-pro).
Voir [`docs/legacy-reference/ARCHITECTURE.md`](./docs/legacy-reference/ARCHITECTURE.md) pour la référence métier de l'ancienne version (à venir).

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

# 2. Démarrer l'environnement (disponible à partir du Jour 3 du Sprint A1)
make up

# 3. Lancer le backend (disponible à partir du Jour 4)
make backend-run

# 4. Lancer le web (disponible à partir du Jour 5)
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

- [Index des documents](./docs/INDEX.md)
- [Vision stratégique](./docs/00-vision-strategique.md)
- [Roadmap V1](./docs/01-roadmap-v1.md)
- [Setup mono-repo](./docs/02-setup-monorepo.md)
- [Architecture Spring Boot](./docs/03-architecture-spring-boot.md)
- [Schéma DB initial](./docs/04-schema-db-initial.md)
- [Runbooks opérationnels](./docs/runbooks/README.md) — que faire quand un client appelle
- [Conventions de contribution](./CONTRIBUTING.md)
- [Changelog](./CHANGELOG.md)

## Licence

Propriétaire — © 2026 Abdou Malick Cisse. Tous droits réservés.
Voir [`LICENSE`](./LICENSE).

## Contact

Pour toute question, contacter l'auteur via le repository GitHub.
