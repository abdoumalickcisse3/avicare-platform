# Design — Console Super-Admin plateforme (back-office Jawdi)

> Statut : **design validé, non développé**. Écrit le 2026-08-20, **révisé le 2026-08-28**.
> Le premier cycle d'implémentation couvrira **Phase 0 + Phase 1**.
> Les phases 2→5 sont documentées ici en roadmap ; chacune aura ensuite son propre cycle.
>
> ## ⚠️ Révision 2026-08-28 — les partenaires ont changé de statut
>
> Ce document classait la gestion des partenaires en **Phase 5**, comme un différenciateur moyen
> terme (« item J »). C'était exact au 20 août : rien n'était construit.
>
> Depuis, le domaine partenaire a été **entièrement développé et mis en production** :
> migrations V36→V39, portail `partner.jawdi.app`, et les trois couches Voir → Garder →
> Développer. Le produit tourne.
>
> **Conséquence : l'administration des partenaires passe de la Phase 5 à la Phase 1.** Ce n'est
> plus un différenciateur, c'est le prérequis de ce qui est déjà en ligne. Aujourd'hui, créer un
> partenaire, provisionner son compte de connexion ou rattacher une ferme se fait **en appelant
> l'API au curl** — les endpoints `AdminPartnerController` existent tous, aucune interface ne les
> consomme. Voir §6bis.

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

### Phase 1 — Support & opérations + Anti-churn (H) + **Partenaires (J)** *(valeur quotidienne max)*
- Liste globale des fermes + **fiche ferme 360°** (membres, modules, volumes, dernière activité).
- Recherche utilisateurs cross-tenant : reset mot de passe, activer/désactiver.
- **Impersonation encadrée** : token scoped + durée limitée + bannière + audit.
- Modules/feature-flags par ferme (réutilise le provisioning `subscription_modules`).
- **Health-score anti-churn (H)** : fermes qui décrochent (pas de saisie depuis X jours,
  onboarding non terminé) + funnel d'activation (inscrit → onboarding fini → 1er lot → 1re vente).
- **Administration des partenaires (J)** — détail en §6bis. Sans elle, le portail en production
  n'est pilotable qu'au curl.

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

### Phase 5 — Différenciateurs (I/L)
- **I — Benchmarks agrégés** : mortalité / FCR / prix agrégés anonymement → « vous vs moyenne
  région » offert aux fermes ; le super-admin active/modère.
- **L — Supervision assistant IA** : relire les conversations (qualité/hallucinations), feedback,
  activation par ferme, quotas.

> **J — Partenaires B2B2C : déplacé en Phase 1** (révision 2026-08-28). Le domaine est construit et
> en production ; son administration est devenue bloquante, pas différenciante. Détail en §6bis.

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

## 6bis. Détail — Administration des partenaires *(ajouté 2026-08-28)*

### Où on en est

Tous les endpoints existent déjà dans `AdminPartnerController`, **et aucun front ne les appelle** :
créer un partenaire, lister, consulter, suspendre/réactiver, mettre à jour (dont le logo),
provisionner un compte de connexion, rattacher une ferme, générer un code d'invitation.

Le travail est donc surtout une **surface**, plus quelques manques ciblés côté API.

### 6bis.1 Écrans

| Écran | Contenu | État de l'API |
|---|---|---|
| **Liste des partenaires** | Nom, type, statut, nb de fermes, nb de comptes, dernière connexion | ✅ `GET /admin/partners` |
| **Fiche partenaire** | Identité, contacts, logo, portefeuille de fermes, comptes, codes | ✅ partiel |
| **Comptes de connexion** | Créer (mot de passe temporaire), désactiver, réinitialiser | ⚠️ création seule |
| **Rattachement de fermes** | Rattacher, **détacher**, voir les curseurs consentis par chaque éleveur | ⚠️ détachement admin manquant |
| **Codes d'invitation** | Générer, lister, révoquer, suivre les adhésions issues du code | ⚠️ génération seule |
| **Prospects** | cf. 6bis.3 — l'écran de recrutement | ❌ à construire |

### 6bis.2 Ce que l'API doit gagner

- **Détacher une ferme** côté admin (le chemin éleveur existe, pas l'admin).
- **Désactiver / réinitialiser** un compte partenaire (aujourd'hui : création seulement, donc un
  départ de salarié chez un provendier n'est pas gérable).
- **Lister et révoquer** les codes d'invitation, et mesurer leur conversion.
- **Dernière connexion** d'un `partner_user` : la donnée n'est pas stockée. Sans elle, impossible
  de savoir si un partenaire signé utilise réellement le portail — c'est pourtant la seule métrique
  qui dit si le produit tient sa promesse.
- **Upload du logo** : `logoUrl` est une URL saisie à la main ; aucun stockage de fichier
  n'existe sur la plateforme. À trancher (URL externe assumée vs premier stockage d'objets).

### 6bis.3 « Prospects partenaires » — le recrutement par la donnée

**L'idée vient d'un constat de terrain : le fournisseur d'un éleveur n'est pas forcément inscrit
sur la plateforme.** C'est vrai, et c'est exploitable.

Les éleveurs saisissent déjà leurs fournisseurs dans l'inventaire (table `suppliers`, une ligne
par ferme), sans aucun lien avec `partners`. La plateforme sait donc **chez qui les éleveurs
achètent réellement**, y compris chez des provendiers qui ignorent son existence — et la table
porte `commercial_name`, `contact_person`, `phone`, `email`, `city` : le prospect arrive avec ses
coordonnées.

Un écran d'admin qui agrège ces fournisseurs — groupés par nom normalisé, classés par **nombre de
fermes clientes** puis par **volume acheté** (`purchase_orders`) — produit une liste de prospects
hiérarchisée par preuve d'usage. Chaque ligne indique si ce fournisseur est déjà un `partner`.

**Vérifié sur la production du 2026-08-28** : la requête d'agrégation tourne et remonte 3
fournisseurs distincts sur 14 fermes, dont **Sedima** — un groupe avicole sénégalais majeur. Le
mécanisme est donc bon ; son rendement est proportionnel à l'adoption, et reste faible tant que la
base de fermes l'est. À construire pour ce qu'il vaudra à 100 fermes, pas pour ce qu'il rend
aujourd'hui.

C'est le pendant exact de la thèse GTM du doc 11 (le canal B2B2C passe par les provendiers des
pilotes) : au lieu de démarcher au hasard, on appelle le provendier qui sert déjà onze fermes
Jawdi, chiffres à l'appui.

**Prudence** : ces noms sont des données d'éleveurs. L'écran est un outil interne de prospection,
il ne doit ni être exposé aux partenaires, ni révéler à un provendier qui sont les clients d'un
autre. À traiter comme de la donnée de tenant, dans le journal d'audit comme le reste.

### 6bis.4 Permissions staff

À ajouter au catalogue de §5.1 : `partners:read`, `partners:write` (créer/modifier/suspendre),
`partners:users` (provisionner et désactiver des comptes), `partners:attach` (rattacher et
détacher des fermes), `partners:prospect` (voir l'écran de recrutement).

Le rattachement d'une ferme mérite sa propre permission : c'est l'action qui rend les données d'un
éleveur visibles par un tiers.

### 6bis.5 Audit

Chaque action partenaire atterrit dans `admin_audit_log`, avec le `tenant_id` de la ferme
concernée quand il y en a une. **Le rattachement et le détachement sont les entrées les plus
sensibles de tout le back-office** : elles ouvrent et ferment l'accès d'un tiers aux données d'un
éleveur. Elles doivent être relisibles ligne à ligne, et idéalement visibles par l'éleveur lui-même
dans un cycle ultérieur.

### 6bis.6 Ce que ça ne couvre pas

La console administre les partenaires ; elle ne construit pas leur espace de travail. Le
brainstorm du 2026-08-28 a acté un portail **transactionnel** (les commandes y passent) et
**spécialisé par type** (console provendier ≠ console vétérinaire), plus un mode partenaire dans
l'app mobile. Ces trois chantiers ont leur propre spec — celui-ci s'arrête au pilotage.

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
- Logo partenaire : rester sur une URL externe saisie à la main, ou introduire le premier stockage
  de fichiers de la plateforme ? (aucun n'existe aujourd'hui — cf. §6bis.2)
- « Dernière connexion » d'un `partner_user` : colonne sur `partner_users` ou dérivée d'un journal
  de connexions staff/partenaire mutualisé ?

---

## 8. Prochaines étapes

1. Écrire le **spec détaillé Phase 0 + Phase 1** (partenaires inclus, cf. §6bis), puis le plan
   d'implémentation.
2. Décidé le 2026-08-28 : la console d'administration passe **avant** l'enrichissement du portail
   partenaire et avant le mode partenaire mobile. Piloter ce qui est déjà en production prime sur
   l'ajout de surfaces.
