# Instructions pour Claude Code — AviCare Platform

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

_Ce fichier évoluera avec le projet. À jour pour Sprint A2._
