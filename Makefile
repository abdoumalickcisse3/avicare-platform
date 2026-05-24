.PHONY: help up down restart logs backend-run backend-test backend-package web-dev web-build web-lint mobile-android mobile-ios reset-db

help:
	@echo "Available commands:"
	@echo "  make up               - Démarre l'environnement Docker (Postgres + Redis + MailHog)"
	@echo "  make down             - Arrête l'environnement Docker"
	@echo "  make restart          - Redémarre l'environnement Docker"
	@echo "  make logs             - Affiche les logs Docker"
	@echo "  make backend-run      - Lance le backend Spring Boot en mode dev (dispo dès Jour 4)"
	@echo "  make backend-test     - Lance les tests backend (dispo dès Jour 4)"
	@echo "  make backend-package  - Package le backend sans tests (dispo dès Jour 4)"
	@echo "  make web-dev          - Lance le frontend Next.js en mode dev (dispo dès Jour 5)"
	@echo "  make web-build        - Build le frontend Next.js (dispo dès Jour 5)"
	@echo "  make web-lint         - Lint le frontend Next.js (dispo dès Jour 5)"
	@echo "  make mobile-android   - Lance l'app mobile sur Android (dispo dès Jour 6)"
	@echo "  make mobile-ios       - Lance l'app mobile sur iOS (dispo dès Jour 6)"
	@echo "  make reset-db         - Réinitialise la DB locale (DANGEREUX)"

up:
	docker-compose -f infra/docker-compose.yml up -d
	@echo "PostgreSQL : localhost:5434  (mapping 5434->5432, voir infra/docker-compose.yml)"
	@echo "Redis      : localhost:6380  (mapping 6380->6379, voir infra/docker-compose.yml)"
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
