#!/usr/bin/env bash
set -e
echo "Suppression des volumes Docker..."
docker-compose -f infra/docker-compose.yml down -v
echo "Redémarrage..."
docker-compose -f infra/docker-compose.yml up -d
echo "✅ DB réinitialisée. Lance le backend pour appliquer les migrations Flyway."
