# 08 — Mobile React Native

> Architecture mobile AviCare Platform — offline-first, mode terrain.
> Référence pour Sprint B7 (mobile MVP) et tous les sprints mobile ensuite.
>
> **Pré-requis :** avoir lu `00-vision-strategique.md`, `01-roadmap-v1.md` (§ Sprint B7),
> `06-cross-cutting.md`, `10-design-system.md`.

---

## Table des matières

1. [Périmètre B7 & ce qui est hors périmètre](#1-périmètre-b7--ce-qui-est-hors-périmètre)
2. [Stack & versions](#2-stack--versions)
3. [Structure du projet](#3-structure-du-projet)
4. [Navigation & écrans](#4-navigation--écrans)
5. [Authentification & sessions](#5-authentification--sessions)
6. [Persistance locale — deux stockages](#6-persistance-locale--deux-stockages)
7. [Le moteur de synchronisation](#7-le-moteur-de-synchronisation)
8. [Idempotence — analyse endpoint par endpoint](#8-idempotence--analyse-endpoint-par-endpoint)
9. [Livrables backend](#9-livrables-backend)
10. [Sémantique de la mortalité](#10-sémantique-de-la-mortalité)
11. [Résolution de conflits](#11-résolution-de-conflits)
12. [Tests](#12-tests)
13. [Conventions code](#13-conventions-code)
14. [Décisions consignées](#14-décisions-consignées)

---

## 1. Périmètre B7 & ce qui est hors périmètre

Le Sprint B7 livre un **MVP terrain**, pas la parité avec le web.

Le web expose 37 routes sur 6 domaines. Les porter toutes en React Native, écriture et
offline compris, représente plusieurs mois — un ordre de grandeur au-dessus des deux semaines
allouées, et exactement ce contre quoi le risque **R2** de `01-roadmap-v1.md` met en garde :
_« Démarrer B7 sur un seul flow (mortalité) avant d'étendre »_.

### Dans le périmètre

| Bloc | Contenu |
|---|---|
| Socle | Navigation, store, thème, client HTTP |
| Auth | Login, refresh, logout, stockage sécurisé des tokens |
| Sélection | Sélecteur de ferme, puis de lot |
| Saisies terrain | Journalier (chair), mortalité, pesée, collecte d'œufs |
| Offline | File de mutations durable, sync automatique, indicateur online/offline |
| Rôles | `FARMER` → mode terrain. `BUYER` → bloqué en V1 |

### Hors périmètre (repoussé)

| Élément | Où |
|---|---|
| Parité écrans web (stocks, commercial, finance, réglages) | B7b / B7c / B7d |
| Biométrie au login | Différée — `01-roadmap-v1.md` la marque « optionnel » |
| Push notifications | Sprint C1 |
| Mode buyer | V2 |
| Réplique locale complète de la donnée ferme | Non retenu — cf. §6 |

---

## 2. Stack & versions

Le dossier `mobile/` contient déjà un squelette Expo nu (SDK 56, RN 0.85, React 19,
`App.tsx` jamais modifié). B7 part de cette base.

| Couche | Choix | Justification |
|---|---|---|
| Runtime | **Expo SDK 56** | Déjà en place ; OTA, build cloud EAS |
| Framework | **React Native 0.85** + React 19 | Aligné sur le squelette existant |
| Langage | **TypeScript** strict | Cohérent avec `web/` |
| Navigation | **expo-router** | Bâti sur React Navigation (donc conforme roadmap), routing par fichiers — même modèle mental que l'App Router du web |
| State | **Redux Toolkit + RTK Query** | Miroir du web ; les définitions d'endpoints se transposent |
| Tokens | **expo-secure-store** | Keychain iOS / Keystore Android — jamais AsyncStorage pour des tokens |
| File de sync | **expo-sqlite** | Transactionnel et ordonné — cf. §6 |
| Cache lecture | **redux-persist** + AsyncStorage | Volume faible, remplacement atomique acceptable |
| Connectivité | **@react-native-community/netinfo** | Déclencheur de reprise de sync |
| Forms | **React Hook Form + Zod** | Cohérent avec le web |
| Tests | **Jest + React Native Testing Library** | Standard RN |

**Aucun module natif custom n'est requis.** `expo-sqlite`, `expo-secure-store` et `netinfo`
sont tous inclus dans Expo Go : le développement B7 ne nécessite pas de build natif.

---

## 3. Structure du projet

```
mobile/
├── app/                        # Routes expo-router
│   ├── (auth)/
│   │   ├── login.tsx
│   │   └── _layout.tsx
│   ├── (field)/                # Mode terrain — exige rôle FARMER+
│   │   ├── index.tsx           # Sélecteur de ferme
│   │   ├── lots/
│   │   │   ├── index.tsx       # Liste des lots (cache)
│   │   │   └── [unitId]/
│   │   │       ├── index.tsx   # Essentiels du lot
│   │   │       ├── journalier.tsx
│   │   │       ├── mortalite.tsx
│   │   │       ├── pesee.tsx
│   │   │       └── oeufs.tsx
│   │   ├── file.tsx            # Actions en attente de sync
│   │   └── _layout.tsx
│   └── _layout.tsx             # Providers racine
│
├── src/
│   ├── store/
│   │   ├── api/                # Slices RTK Query (miroir web)
│   │   ├── slices/
│   │   └── index.ts
│   ├── sync/
│   │   ├── db.ts               # Schéma SQLite + ouverture
│   │   ├── queue.ts            # enqueue / peek / markDone / markFailed
│   │   ├── engine.ts           # Boucle de drain, backoff, triggers
│   │   └── types.ts
│   ├── auth/
│   │   ├── tokens.ts           # SecureStore
│   │   └── session.ts
│   ├── theme/                  # Tokens doc 10 portés en RN
│   └── components/
│
└── assets/
```

---

## 4. Navigation & écrans

Deux groupes de routes, séparés par un garde d'authentification :

- `(auth)` — non authentifié. Login uniquement en V1 (pas de signup mobile : la création de
  compte reste web, un éleveur est onboardé avant d'aller au poulailler).
- `(field)` — authentifié + rôle terrain. Un `BUYER` qui se connecte voit un écran
  « Application réservée aux équipes de terrain » (V1).

L'indicateur **online/offline** et le **compteur d'actions en attente** vivent dans le layout
`(field)`, donc visibles sur tous les écrans terrain. C'est un critère d'acceptation de la
roadmap : _« L'app affiche "5 actions en attente de sync" quand offline »_.

---

## 5. Authentification & sessions

**Aucun travail backend.** `AuthController` fait déjà transiter le refresh token **dans le
corps de la requête**, pas en cookie httpOnly — le commentaire de classe le dit explicitement
(« The refresh token travels in the request body (mobile / Bearer-first) »). Le mobile consomme
les mêmes endpoints que le web :

| Endpoint | Usage mobile |
|---|---|
| `POST /api/v1/auth/login` | Retourne `AuthTokens` (access + refresh) |
| `POST /api/v1/auth/refresh` | Refresh token dans le body |
| `POST /api/v1/auth/logout` | Refresh token dans le body |

Les deux tokens sont stockés dans **expo-secure-store**, jamais dans AsyncStorage ni dans le
state Redux persisté. Le `baseQuery` RTK Query intercepte les `401`, tente un refresh unique,
puis rejoue la requête. Un échec de refresh purge la session et renvoie sur `(auth)/login`.

Les memberships ferme et permissions sont lus depuis les claims du JWT (Règle 3 du doc 00 —
le JWT porte tout), comme sur le web.

---

## 6. Persistance locale — deux stockages

Décision de cadrage : hors réseau, l'éleveur doit pouvoir **saisir ET consulter les essentiels
du lot** (effectif, âge, race, saisies du jour). Il n'a pas besoin de naviguer toute la donnée
de la ferme hors ligne.

Cette frontière est ce qui permet d'éviter un moteur de synchronisation bidirectionnel
(WatermelonDB et assimilés). On n'a pas de réplique à réconcilier : on a un **flux d'écritures
sortantes** et un **cache de lecture jetable**. Deux problèmes distincts, deux stockages.

### 6.1 File de mutations — SQLite (`expo-sqlite`)

```sql
CREATE TABLE IF NOT EXISTS mutation_queue (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,  -- garantit l'ordre FIFO
  client_ref    TEXT NOT NULL UNIQUE,               -- UUID v4 généré à la saisie
  farm_id       INTEGER NOT NULL,
  kind          TEXT NOT NULL,   -- DAILY_RECORD | MORTALITY | WEIGHING | EGG_COLLECTION
  endpoint      TEXT NOT NULL,
  payload       TEXT NOT NULL,   -- JSON
  status        TEXT NOT NULL,   -- PENDING | IN_FLIGHT | FAILED
  attempts      INTEGER NOT NULL DEFAULT 0,
  last_error    TEXT,
  created_at    TEXT NOT NULL
);
```

SQLite et pas AsyncStorage : la file doit survivre à un crash **en pleine écriture**, être
ordonnée, et porter un statut par ligne. AsyncStorage réécrit un blob JSON entier à chaque
mutation : deux écritures concurrentes et une saisie disparaît silencieusement. Sur de la
donnée que l'éleveur ne peut pas ressaisir, c'est inacceptable.

Une ligne réussie est **supprimée**, pas marquée. La file est un tampon, pas un journal :
l'historique est côté serveur.

### 6.2 Cache de lecture — RTK Query persisté

Le state RTK Query est persisté via `redux-persist` sur AsyncStorage, **whitelist limitée** aux
essentiels du lot. Volume faible, écrasement atomique acceptable, aucune donnée non
resynchronisable. Le cache est purgé au logout et au changement de ferme.

---

## 7. Le moteur de synchronisation

### 7.1 Ordre

Drain **FIFO séquentiel par ferme**, une mutation en vol à la fois. Pas de parallélisation :
plusieurs écritures touchent le même effectif de lot, et l'ordre d'application change le
résultat.

### 7.2 Déclencheurs

| Déclencheur | Source |
|---|---|
| Retour de connectivité | `netinfo` — transition offline → online |
| Passage au premier plan | `AppState` |
| Après une saisie, si déjà en ligne | Appel direct post-enqueue |
| Manuel | Pull-to-refresh sur l'écran file |

### 7.3 Classification des échecs

C'est le point le plus important du moteur. Tous les échecs ne se valent pas :

| Réponse | Traitement |
|---|---|
| `2xx` | Succès — ligne supprimée de la file |
| `401` | Refresh du token, puis reprise du drain (ne compte pas comme tentative) |
| `4xx` (hors 401) | **Échec définitif** — statut `FAILED`, le drain continue avec la suivante |
| `5xx` / erreur réseau | **Retry** — backoff exponentiel |

Un `422` (règle métier violée) ou un `403` (module inactif, permission manquante) ne
deviendra jamais un succès en le rejouant. Le rejouer indéfiniment bloquerait la file derrière
lui. On le gare en `FAILED` en conservant le `detail` du Problem Details RFC 7807 (doc 06),
affiché tel quel sur l'écran file avec une action « Corriger » ou « Supprimer ».

Backoff : `2^attempts` secondes, plafonné à 5 minutes, maximum 8 tentatives avant passage en
`FAILED` manuel.

### 7.4 Ce que le moteur n'est pas

Il ne tire **rien** du serveur. Le rafraîchissement du cache de lecture est le travail normal de
RTK Query quand le réseau est là. Le moteur de sync ne pousse que des écritures.

---

## 8. Idempotence — analyse endpoint par endpoint

Une file de rejeu a un piège structurel : si le réseau coupe **après** que le serveur ait
traité la requête mais **avant** que la réponse n'arrive, le mobile croit à un échec et rejoue.
Sur de la mortalité, cela décrémente deux fois l'effectif du lot — silencieusement.

L'analyse des 4 endpoints terrain montre que le problème est plus étroit qu'attendu :

| Saisie | Endpoint | Sémantique serveur | Rejeu sûr ? |
|---|---|---|---|
| Journalier chair | `POST /farms/{farmId}/poultry-batches/{batchId}/daily-records` | **upsert** `(lot, date)` | ✅ Oui |
| Collecte d'œufs | `POST /farms/{farmId}/egg-production/collections` | **upsert** `(unité, date, créneau)` | ✅ Oui |
| Pesée | `POST /farms/{farmId}/poultry-batches/{batchId}/weighings` | **INSERT pur** | ❌ Crée un doublon |
| Mortalité (événement) | `POST /farms/{farmId}/production-units/{unitId}/mortality` | **append**, delta `−count` | ❌ Double décrément |

Les deux premiers sont idempotents **par construction** : rejouer un upsert avec la même clé et
la même charge produit exactement le même état. Aucun travail requis.

Seuls **la pesée et l'événement de mortalité** ont besoin d'une clé d'idempotence.

### Pourquoi pas un endpoint `/mobile/sync` batch

`01-roadmap-v1.md` prévoyait un endpoint batch. Il est écarté : il a été pensé avant que les
endpoints métier n'existent. Aujourd'hui, un batch devrait **réimplémenter** la validation, le
RBAC `@FarmAccess`, le feature gating par module et les règles métier de 4 flux distincts —
une seconde surface d'API condamnée à diverger de celle du web.

Le mobile rejoue donc les endpoints métier existants, un par un. Un aller-retour par mutation
au lieu d'un seul, contre zéro duplication de logique métier. Le compromis est net : les
volumes en jeu (quelques dizaines de saisies par jour et par ferme) ne justifient pas de payer
en risque de divergence ce qu'on gagnerait en round-trips.

---

## 9. Livrables backend

Périmètre volontairement chirurgical.

### 9.1 Migration `V30__mobile_idempotency.sql`

> Dernière migration mergée : `V29__sales_channels.sql`.

```sql
ALTER TABLE lifecycle_events  ADD COLUMN client_ref UUID NULL;
ALTER TABLE weighing_samples  ADD COLUMN client_ref UUID NULL;

CREATE UNIQUE INDEX uq_lifecycle_events_client_ref
  ON lifecycle_events (client_ref) WHERE client_ref IS NOT NULL;
CREATE UNIQUE INDEX uq_weighing_samples_client_ref
  ON weighing_samples (client_ref) WHERE client_ref IS NOT NULL;
```

Index **partiel** : toutes les écritures venues du web laissent `client_ref` à `NULL` et ne
doivent pas entrer en collision.

### 9.2 DTOs

`RecordMortalityRequest` et `WeighingRequest` reçoivent un champ optionnel
`UUID clientRef`. Absent (web) → comportement strictement inchangé.

### 9.3 Services

`LivestockService.recordMortality` et `GrowthAnalysisService.recordWeighing` : si `clientRef`
est fourni et déjà présent en base pour cette ferme, **retourner la ligne existante** au lieu
d'en créer une nouvelle. Le mobile reçoit la même réponse qu'au premier appel et retire
l'action de sa file.

Aucun changement sur `daily-records` ni sur `egg-production/collections`.

---

## 10. Sémantique de la mortalité

Le critère d'acceptation de la roadmap dit : _« En mode avion, il saisit 5 mortalités → les 5
sont envoyées au serveur, l'effectif lot est mis à jour »_. Cette formulation mérite d'être
précisée, car elle ne se traduit pas de la même façon selon l'espèce.

**Lot chair.** La mortalité vit dans le journalier, en upsert par jour. Cinq saisies successives
le même jour ne sont pas cinq additions : ce sont cinq réécritures du même enregistrement, la
dernière l'emportant. Le mobile tient donc un **cumul local du jour** et pousse le total
courant. L'éleveur qui trouve ses bêtes une par une voit son compteur monter (1, 2, 3, 4, 5) ;
le serveur reçoit un total. Naturel côté usage, idempotent par construction.

**Lot ponte.** La mortalité passe par l'événement d'attrition sur la `ProductionUnit` — un
append delta. Chaque saisie est une action distincte dans la file, porteuse de son `clientRef`.

---

## 11. Résolution de conflits

**Last-write-wins**, conformément à la roadmap. Sur les endpoints upsert, c'est le comportement
naturel — aucun code de résolution à écrire.

**Risque assumé et documenté :** si une saisie est modifiée sur le web pendant que l'éleveur est
hors ligne, la synchronisation de ce dernier écrasera la valeur web sans avertissement. Le
scénario est peu probable en V1 (l'éleveur au poulailler est généralement seul à saisir sur son
lot) et le coût d'une détection de conflit — versionner chaque enregistrement et construire une
UI d'arbitrage — est hors de proportion pour un MVP. À réévaluer si le multi-saisie simultanée
devient un usage réel.

---

## 12. Tests

| Niveau | Périmètre |
|---|---|
| Unitaire — `src/sync/queue.ts` | enqueue, ordre FIFO, unicité `client_ref`, suppression après succès |
| Unitaire — `src/sync/engine.ts` | backoff, classification 4xx définitif / 5xx retry, refresh sur 401, drain séquentiel |
| Composant | Formulaires de saisie, cumul local de mortalité, indicateur online/offline |
| Intégration backend | Rejeu du même `clientRef` sur mortalité et pesée → une seule ligne, effectif décrémenté une seule fois |
| Acceptation manuelle | Scénario mode avion de `01-roadmap-v1.md` § B7 |

Le test d'intégration backend est le plus important du sprint : c'est lui qui prouve que la
donnée vivante ne se corrompt pas.

---

## 13. Conventions code

- TypeScript strict, aucun `any` implicite.
- Écrans en composants fonctionnels ; toute logique non triviale extraite en hook.
- Tokens du doc 10 portés dans `src/theme/` — aucune couleur ni espacement en dur.
- Textes user-facing en français (langue V1 du doc 00).
- Messages techniques et logs en anglais, cohérent avec le backend.
- Conventional Commits, scope `mobile` : `feat(mobile): ...`, `feat(backend:livestock): ...`.

---

## 14. Décisions consignées

| # | Décision | Choix |
|---|---|---|
| M1 | Périmètre B7 | MVP terrain, **pas** la parité web. Parité repoussée en B7b+ (risque R2) |
| M2 | Besoin offline | Saisie **et** consultation des essentiels du lot ; pas de réplique complète |
| M3 | Moteur offline | Pas de sync bidirectionnel (WatermelonDB écarté) — file d'écritures + cache de lecture |
| M4 | Stockage de la file | SQLite (`expo-sqlite`), pas AsyncStorage — durabilité et ordre |
| M5 | Stratégie de sync | Rejeu des endpoints métier existants, **pas** de `/mobile/sync` batch |
| M6 | Idempotence | `client_ref` UUID sur mortalité et pesée uniquement ; les upserts sont déjà idempotents |
| M7 | Échecs 4xx | Définitifs — garés en `FAILED`, jamais rejoués, `detail` RFC 7807 affiché |
| M8 | Conflits | Last-write-wins ; écrasement d'une édition web concurrente assumé en V1 |
| M9 | Navigation | `expo-router` (React Navigation sous le capot) |
| M10 | Biométrie | Différée hors B7 |

---

_Document créé pour le Sprint B7. À mettre à jour à chaque décision mobile majeure._
