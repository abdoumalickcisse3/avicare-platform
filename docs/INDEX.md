# 📚 Index des documents Jawdi Platform

> Document récapitulatif. À placer dans `docs/INDEX.md` du repo pour servir d'accueil.

---

## Documents livrés (vous êtes ici)

| # | Document | Rôle | Quand le lire |
|---|---|---|---|
| 00 | `00-vision-strategique.md` | Vision globale, décisions stratégiques | **Maintenant** (avant tout le reste) |
| 01 | `01-roadmap-v1.md` | Phases, sprints, jalons V1 | **Maintenant**, et à chaque début de sprint |
| 02 | `02-setup-monorepo.md` | Setup repo, infra, conventions | **Sprint A1** (cette semaine) |
| 03 | `03-architecture-spring-boot.md` | Structure backend, bounded contexts, patterns | **Sprint A2** et tous les sprints backend ensuite |
| 04 | `04-schema-db-initial.md` | Migrations Flyway, modèle DB universel | **À chaque sprint où on ajoute des tables** |
| 05 | `05-securite-rbac.md` | Avant Sprint A2 (semaine prochaine) — JWT, @FarmAccess, features |
| 06 | `06-cross-cutting.md` | Pendant Phase A — RFC 7807, i18n, logs, observabilité |
| 07 | `07-frontend-nextjs.md` | Avant le frontend Sprint A3 — App Router, RTK Query, MUI |
| 08 | `08-mobile-react-native.md` | **Sprint B7** — offline-first, file de sync, idempotence, mode terrain |
| 10 | `10-design-system.md` | Avant tout écran — tokens, typo, couleurs (référence UI) |
| 11 | `11-go-to-market.md` | Plan commercial V1 — phases –1→3, critères de passage, métriques |
| 12 | `12-assistant-ia-strategie.md` | Stratégie « IA au centre » (cible ouvrier de terrain) — vision, archi, garde-fous, phasage |

---

## Documents ajoutés en cours de route

| Document | Rôle | Quand le lire |
|---|---|---|
| `roadmap-pre-first-client.md` | Feuille de route P1–P6 avant le premier client (traçage, kill switch, intégrité, menaces, runbooks, continuité) — **terminée côté code** | Pour comprendre les garde-fous de la plateforme |
| `decisions/` | ADR (001–016) : choix d'architecture et d'exploitation verrouillés | Avant de remettre une décision en question |
| `runbooks/` | Quoi faire quand un client appelle : incident, sauvegarde, restauration, plateforme injoignable | Avant de diagnostiquer un incident ; à mettre à jour après chacun |
| `continuity/` | Briefing de la personne de secours | Avant de renseigner `ADMIN_EMERGENCY_PHONE` |
| `../infra/DEPLOY.md` | Déploiement VPS, health check, rollback, sauvegardes | Avant tout déploiement |

> Le document **09** (`09-plan-j1-j30.md`, plan opérationnel des 30 premiers jours) n'a **jamais été
> rédigé** : les 30 premiers jours sont passés, et `01-roadmap-v1.md` puis
> `roadmap-pre-first-client.md` en tiennent lieu. Ne pas le chercher.

---

## Routine de travail recommandée

### Au démarrage d'une session avec Claude Code

Prompt système recommandé :

```
Tu es Claude Code travaillant sur Jawdi Platform.

Lis OBLIGATOIREMENT ces documents dans cet ordre AVANT toute action :
1. docs/00-vision-strategique.md
2. docs/01-roadmap-v1.md (focus sur le sprint en cours)
3. docs/02-setup-monorepo.md (Sprint A1)
4. docs/03-architecture-spring-boot.md (sprints A2+)
5. docs/04-schema-db-initial.md (sprints A3+)

Sprint en cours : <X>
Tâche du jour : <Y>

Règles non-négociables :
- Respecter strictement les conventions de naming des docs
- Aucun cross-import entre bounded contexts (utiliser facades)
- Aucune valeur métier en dur (tout via parameters)
- Migrations Flyway versionnées immutables
- Conventional Commits
- 1 PR = 1 sujet
- Tests avant de cocher une checkbox

Pour toute décision d'architecture non documentée, ME DEMANDER avant d'agir.
```

### Quand poser des questions à Claude (chat) vs Claude Code

**Demande à Claude (chat ici) pour :**
- Décisions d'architecture
- Choix de libs
- Revues de code de modules importants
- Doutes stratégiques
- Quand tu bloques sur un concept

**Demande à Claude Code pour :**
- Génération de code
- Refactorings locaux
- Tests
- Debug
- Commits, branches, PRs

---

## Métriques de progression à suivre

À mettre à jour à chaque fin de sprint dans le CHANGELOG.md :

- [x] Sprint A1 — Setup mono-repo
- [x] Sprint A2 — common-* squelette
- [x] Sprint A3 — identity + tenancy
- [x] Sprint A4 — subscription + parameters
- [x] Sprint A5 — livestock socle
- [x] Sprint B1 — poultry chair
- [x] Sprint B2 — poultry ponte
- [x] Sprint B3 — health
- [x] Sprint B4 — inventory
- [x] Sprint B5 — commercial
- [x] Sprint B6 — finance
- [x] Sprint B7 — mobile MVP
- [x] Sprint C1 — notifications
- [x] Sprint C2 — reporting (audité 2026-09-02 : l'essentiel était déjà livré ;
      les quatre manques réels comblés — clôture de bande, bloc Stock, période
      sur le compte de résultat, comparaison des bandes. Le rendu PDF/Excel
      **serveur** et `kpi_configs` restent hors périmètre, faute d'usage réel :
      cf. la spec de clôture §2.2)
- [ ] Sprint C3 — QR + buyer — **non construit** : aucun endpoint `/qr/*` ni `/buyer/*`, aucune
      page `/scan` (seules les lignes de modules `qr_codes` / `buyer_portal` existent en base). Le
      besoin « client B2B » a pris une autre forme : compte-courant client et portail partenaire
      (provendier/véto, `/portal`). À re-décider, pas à reprendre tel quel.
- [ ] Sprint C4 — polish + bêta — **partiel** : fait = parcours d'inscription/onboarding guidé,
      pages 404 et d'erreur, tests E2E Playwright (`web/e2e`), états de chargement ; **pas fait** =
      bêta mesurée avec NPS ≥ 7, audit UX complet du parcours signup → premier paiement
- [ ] Sprint C5 — production go-live — **partiel** : en ligne sur `jawdi.app` (VPS, HTTPS, GHCR,
      déploiement par workflow, sauvegardes quotidiennes + copie hors site, sondes d'uptime, app
      mobile sur TestFlight) ; **pas fait** = restauration rejouée sur le VPS (cf.
      `runbooks/ops/restaurer-une-sauvegarde.md`), documentation utilisateur, ouverture publique
      (aujourd'hui : phase collaborateurs, inscription via contact)

---

## Contact stratégique

Pour les décisions d'architecture importantes, revenir consulter Claude dans le chat avec en contexte :
1. Les documents 00-04 pertinents
2. Une description claire du problème
3. Ce que vous avez essayé

Bonne construction ! 🚀
