# Design — Console Super-Admin plateforme (back-office Jawdi)

> Statut : **design validé, non planifié / non développé** (2026-08-20).
> Issu d'un brainstorming. Le premier cycle d'implémentation (spec→plan) couvrira **Phase 0 + Phase 1**.
> Les phases 2→5 sont documentées ici en roadmap ; chacune aura ensuite son propre cycle.

---

## 1. Contexte & état existant

Jawdi n'a aujourd'hui **aucune console back-office**. Le besoin : un espace pour piloter la
plateforme — utilisateurs, fermes (tenants) et paramétrage global.

Constat clé : **le socle est déjà là à ~60 % au niveau auth**, il manque la *surface*.

Ce qui existe déjà :
- `UserRole.ADMIN` (`common-security`) = « personnel Jawdi, contourne tout contrôle tenant ».
  Porté dans le JWT et déjà utilisé : `@PreAuthorize("hasRole('ADMIN')")`,
  `principal.isAdmin()`, bypass du `FeatureChecker` (gating),
  `FarmService.listAccessible(isAdmin=true)` (voit toutes les fermes).
- Convention d'URL déjà en place : `/api/v1/admin/**` (cf. `AdminChangeRequestController`).
- Couche catalogue plateforme `catalog_items` en base — **modifiable uniquement par migration SQL**
  aujourd'hui (aucun écran d'admin).
- Konekt WhatsApp branché ; notifications unifiées en cours.
- Modèle de permissions **membres** (côté ferme) déjà en place → réutilisable comme patron pour
  les permissions **staff**.

Ce qui manque = l'objet de ce design : la console elle-même (écrans + endpoints dédiés).

---

## 2. Décisions verrouillées (brainstorming)

| # | Décision | Choix retenu |
|---|---|---|
| 1 | Périmètre | **Tout, par phases** (roadmap ci-dessous) |
| 2 | Modèle de rôles | **Staff avec permissions fines** (sur le modèle des permissions membres). `SUPER_ADMIN` = toutes permissions implicites. On **sème un compte SUPER_ADMIN fondateur** en Phase 0, on ouvre la granularité ensuite. |
| 3 | Emplacement | **Sous-domaine dédié `admin.jawdi.app`** (front séparé, cloisonné) |
| 4 | Impersonation | **Oui, encadrée** : token à portée réduite, durée limitée, bannière « Mode support », 100 % audité |
| 5 | Sécurité back-office (« O ») | **Compromis léger en Phase 0** : révocation de sessions + audit des connexions staff. **2FA staff optionnel/activable plus tard** (pas un chantier maintenant). |
| 6 | Ajouts au périmètre | **H** (anti-churn/health-score), **M** (conformité/droit à l'oubli), **I/J/L** (différenciateurs moyen terme) |

---

## 3. Architecture d'ensemble

**Frontend** — nouvelle app `admin.jawdi.app`, isolée du code tenant (surface d'attaque
cloisonnée, cookies séparés). Réutilise la stack web existante (Next.js + MUI + RTK Query) mais en
projet/déploiement séparé. Login réservé aux comptes staff. Routing Caddy dédié.

**Backend** — pas de nouveau service : des endpoints `/api/v1/admin/**` dans l'app existante,
protégés par un gate `AdminAccess` (réutilise `@PreAuthorize` + le principal JWT). Chaque endpoint
exige une permission staff précise.

**Sécurité & confiance** — deux invariants transverses :
1. **Journal d'audit inviolable** (`admin_audit_log`, append-only) : *toute* action super-admin y
   est tracée (`acteur, action, cible type+id, tenant, metadata JSONB, ip, horodatage`).
2. **Permissions staff** contrôlées à chaque endpoint ; `SUPER_ADMIN` court-circuite le check
   (détient tout).

**Principe d'isolation** : le back-office est un *client* des façades/endpoints existants autant
que possible (comme l'assistant IA l'est déjà), pour éviter de dupliquer la logique métier. On
n'ajoute de nouveaux services que pour le transverse (audit, permissions staff, impersonation,
health-score, cockpit d'agrégats).

---

## 4. Roadmap par phases

### Phase 0 — Socle sécurité & identité *(non-négociable)*
- Modèle de rôles staff : marqueur `ADMIN` + table `staff_permissions` (patron = permissions
  membres). `SUPER_ADMIN` = toutes permissions implicites. Seed du compte fondateur.
- `admin_audit_log` append-only + service d'écriture d'audit.
- Gate backend `AdminAccess` + convention `/api/v1/admin/**`.
- Bootstrap `admin.jawdi.app` : shell, nav, login staff, routing Caddy, déploiement.
- Compromis « O » : révocation de sessions (réutilise `RefreshTokenService`) + audit des
  connexions staff. 2FA optionnel remis à plus tard.

### Phase 1 — Support & opérations + Anti-churn (H) *(valeur quotidienne max)*
- Liste globale des fermes + **fiche ferme 360°** (membres, modules, volumes, dernière activité).
- Recherche utilisateurs cross-tenant : reset mot de passe, activer/désactiver.
- **Impersonation encadrée** : token scoped + durée limitée + bannière + audit.
- Modules/feature-flags par ferme (réutilise le provisioning `subscription_modules`).
- **Health-score anti-churn (H)** : fermes qui décrochent (pas de saisie depuis X jours,
  onboarding non terminé) + funnel d'activation (inscrit → onboarding fini → 1er lot → 1re vente).

### Phase 2 — Paramétrage sans SQL + Conformité (M)
- Éditeur **`catalog_items`** (CRUD races, catégories, seuils par défaut, formules) → fini les
  migrations pour un ajout métier. Chaque changement audité.
- Templates plateforme poussés aux fermes (programmes de vaccination, formules de référence).
- **Conformité (M)** : export des données d'un tenant (portabilité), suppression/anonymisation
  d'un compte (droit à l'oubli), purge des soft-deleted.

### Phase 3 — Observabilité & pilotage
- Cockpit : fermes actives, MAU, volumes (lots/ventes/notifs).
- **Crédits WhatsApp Konekt** restants + coût par ferme, envois échoués + relance.
- Statut backups (dumps nightly B2 déjà en place → juste les *voir*), version déployée, migrations.

### Phase 4 — Communication
- Bannières/annonces in-app broadcast, campagnes WhatsApp ciblées (pilotes), notes de version.

### Phase 5 — Différenciateurs (I/J/L)
- **I — Benchmarks agrégés** : mortalité / FCR / prix agrégés anonymement → « vous vs moyenne
  région » offert aux fermes ; le super-admin active/modère.
- **J — Partenaires B2B2C** : entité partenaire (fournisseur d'aliment / véto), rattachement des
  fermes, vue portefeuille par partenaire. Aligné plan GTM.
- **L — Supervision assistant IA** : relire les conversations (qualité/hallucinations), feedback,
  activation par ferme, quotas.

### Hors périmètre (dormant) — « P » Monétisation
Le gating existe en sommeil (ADR-009). Quand la monétisation reviendra : gestion plans/prix,
refacturation des crédits WhatsApp. **Pas construit maintenant.**

---

## 5. Détail — Phase 0 (premier cycle d'implémentation)

### 5.1 Modèle de rôles & permissions staff
- Conserver `UserRole.ADMIN` comme marqueur « personnel plateforme ».
- Nouvelle table `staff_permissions` (une ligne = un couple user × permission), patron =
  permissions membres côté ferme.
- Catalogue de permissions staff (domaines) — proposition initiale :
  `tenants:read`, `tenants:write`, `users:read`, `users:reset-password`, `users:deactivate`,
  `impersonate`, `catalog:write`, `broadcast:send`, `compliance:export`, `compliance:delete`,
  `staff:manage`.
- `SUPER_ADMIN` : marqueur (colonne ou permission spéciale `*`) → détient tout implicitement.
  Un seed provisionne le compte fondateur.

### 5.2 Audit inviolable
- Table `admin_audit_log` append-only : `id, actor_user_id, action, target_type, target_id,
  tenant_id, metadata JSONB, ip, created_at`. Pas d'`update`/`delete` applicatif.
- Service `AdminAuditService.record(...)` appelé par chaque endpoint admin muté.

### 5.3 Gate & convention API
- `AdminAccess` : helper `@PreAuthorize` exigeant une permission staff nommée (ou `SUPER_ADMIN`).
- Tous les endpoints sous `/api/v1/admin/**`.

### 5.4 Front `admin.jawdi.app`
- Projet front séparé, login staff, shell + navigation. Routing Caddy + pipeline de déploiement
  (conteneur GHCR, comme les autres).

### 5.5 Compromis sécurité (O léger)
- Révocation de sessions d'un utilisateur (réutilise `RefreshTokenService` + révocation Redis).
- Audit des connexions staff. 2FA staff : conçu comme extension optionnelle future.

---

## 6. Détail — Phase 1 (premier cycle d'implémentation)

- **Fiche ferme 360°** : agrège membres (`TenancyFacade`), modules (`subscription`), volumes
  métier (`livestock`/`finance`), dernière activité (`reporting`/`ActivityService`).
- **Recherche users cross-tenant** : nouvel endpoint admin de recherche (email/nom/téléphone),
  actions reset-pw / activer-désactiver (réutilise `identity`).
- **Impersonation encadrée** : émission d'un access token « act-as » scoped + court, marqué
  impersonation, bannière front permanente, entrée d'audit à l'ouverture *et* à la fermeture.
- **Modules/flags par ferme** : lecture + toggle du provisioning `subscription_modules`.
- **Health-score (H)** : read-model dérivé (dernière saisie, état onboarding) → liste « à
  relancer » + funnel d'activation.

---

## 7. Questions ouvertes / à trancher au moment du spec détaillé

- Front admin : **réutiliser la stack Next.js/MUI** du web ou une app plus légère ? (défaut : Next.js
  pour cohérence.)
- Impersonation : token « act-as » **séparé** (échange de token) vs claim `impersonating` ajouté —
  choisir au moment de l'implémentation sécurité.
- `SUPER_ADMIN` : **colonne dédiée** sur `users` vs **permission spéciale `*`** dans
  `staff_permissions` — décider au spec Phase 0.
- Health-score : seuils « décrochage » (X jours sans saisie) — à paramétrer (idéalement via
  `catalog_items`, cohérent avec « aucune valeur métier en dur »).
- 2FA staff : à rouvrir si/quand des comptes staff autres que le fondateur sont créés.

---

## 8. Prochaines étapes

1. **Aucune implémentation pour l'instant** (décision utilisateur — on brainstorme d'autres aspects
   de la plateforme d'abord).
2. Quand on décide de lancer : écrire le **spec détaillé Phase 0 + Phase 1**, puis invoquer
   `writing-plans` pour le plan d'implémentation.
