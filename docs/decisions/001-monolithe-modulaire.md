# ADR 001 — Monolithe modulaire Spring Boot

**Date** : 2026-05-24
**Statut** : Accepté
**Auteur** : Abdou Malick Cisse

## Contexte

Le projet Jawdi Platform est une reconstruction de GINAARTECH avec :
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
