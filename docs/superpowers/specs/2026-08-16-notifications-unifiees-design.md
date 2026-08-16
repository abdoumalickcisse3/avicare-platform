# Design — Notifications unifiées (Sprint C1)

> Spec fondatrice du chantier « Notifications unifiées » (premier chantier du
> Sprint C, phase C — finitions & lancement). Rédigée en session de brainstorming
> le 2026-08-16. Réf. roadmap : `docs/01-roadmap-v1.md` §5 Sprint C1 ;
> vision : `docs/00-vision-strategique.md`.

---

## 0. Contexte & cadrage

Le Sprint C a été **repriorisé** par rapport à la roadmap d'origine : la prod est
déjà live (jawdi.app), l'onboarding est livré et l'assistant IA est en place. Le
Sprint C consiste donc à **combler les vrais manques Phase C**, en commençant par
les **notifications unifiées**.

### État de l'existant (constaté dans le code)

- Les alertes sont **calculées à la lecture** (compute-on-read), **par domaine** :
  - `livestock/health/AlertService` → `HealthAlertController`
    (`GET /farms/{id}/health/alerts`) : vaccinations en retard, observations
    critiques, délais d'attente actifs, visites de suivi.
  - `livestock/inventory/InventoryAlertService` → `InventoryAlertController`
    (`GET /farms/{id}/inventory/alerts`) : stock bas, stock négatif, bons de
    commande en retard, mouvements récents.
- **Aucune** persistance de notification, **aucun** état lu/non-lu, **aucune**
  préférence, **aucun** cron, **aucune** cloche unifiée, **aucun** canal externe.
- Ces panneaux live sont affichés dans leurs pages respectives (santé / stocks).

### Décisions de cadrage (verrouillées en brainstorming)

| # | Décision | Choix |
|---|---|---|
| N1 | Périmètre Sprint C | Combler les manques réels Phase C, repriorisés (notifications d'abord) |
| N2 | Canaux C1 | **In-app + WhatsApp** (via Konekt). Pas de FCM push ni email en C1. |
| N3 | Lien assistant IA | **Concevoir pour** (interface propre), **ne pas coder** l'intégration en C1 |
| N4 | Modèle de persistance | **Matérialiser sur transition + garder les vues live** existantes |

---

## 1. Architecture — contexte & placement

Nouveau **bounded context racine `com.avicare.notification`** (même niveau que
`finance`, `assistant`, `reporting`).

- **Aucun cross-import** entre bounded contexts (règle 4 vision). Le contexte
  `notification` lit les conditions d'alerte via **facades** :
  - `livestock/api/InventoryFacade` (stock bas/négatif, PO en retard) — existe.
  - `livestock/api/CommercialFacade` (encours/crédit, factures overdue) — existe.
  - **Nouvelle** méthode de facade côté `livestock` pour exposer `AlertService`
    (santé) au contexte notification — p. ex. `HealthFacade.computeAlerts(farmId)`
    ou une méthode consolidée dans une façade livestock dédiée. **Aucune** logique
    de détection n'est dupliquée : le contexte notification **orchestre** les
    services compute-on-read existants.
- Le contexte notification **possède** : sa persistance, son cron, ses
  préférences, son intégration WhatsApp, sa façade de lecture.

### Unités (isolation & responsabilité unique)

- `NotificationScannerService` — détecte les transitions, upsert les notifications.
- `NotificationService` — CRUD/lecture, état lu/non-lu, résolution des préférences.
- `NotificationFacade` — interface de lecture publique (pour l'assistant IA futur).
- `WhatsAppClient` — appel HTTP Konekt (derrière interface, mockable).
- `WhatsAppDispatcher` — worker asynchrone qui vide l'outbox.
- Détecteurs (`*Detector`) — wrappers fins par catégorie, réutilisant les facades.

---

## 2. Modèle de données (Flyway V34+)

Conventions doc 04 respectées : tables `snake_case` pluriel, `BIGSERIAL PK`,
enums `VARCHAR + CHECK`, `TIMESTAMP` UTC, `JSONB`, triggers `updated_at`, FK
explicites + index.

### `notifications`

| Colonne | Type | Notes |
|---|---|---|
| `id` | `BIGSERIAL PK` | |
| `farm_id` | `BIGINT NOT NULL` | FK `farms(id)`, index ; périmètre = ferme |
| `category` | `VARCHAR NOT NULL` | CHECK IN (`MORTALITY_ANOMALY`, `VACCINATION_LATE`, `WITHDRAWAL_ENDING`, `CRITICAL_OBSERVATION`, `LOW_STOCK`, `NEGATIVE_STOCK`, `PO_OVERDUE`, `CREDIT_EXCEEDED`, `INVOICE_OVERDUE`) |
| `severity` | `VARCHAR NOT NULL` | CHECK IN (`INFO`, `WARNING`, `CRITICAL`) |
| `title` | `VARCHAR NOT NULL` | libellé court (i18n FR V1) |
| `body` | `TEXT` | détail |
| `source_ref` | `JSONB` | `{unitId, itemId, invoiceId, ...}` pour deep-link UI |
| `dedup_key` | `VARCHAR NOT NULL` | clé naturelle stable, ex. `LOW_STOCK:item:42` |
| `status` | `VARCHAR NOT NULL` | CHECK IN (`ACTIVE`, `RESOLVED`), défaut `ACTIVE` |
| `created_at` | `TIMESTAMP NOT NULL` | trigger |
| `updated_at` | `TIMESTAMP NOT NULL` | trigger |
| `resolved_at` | `TIMESTAMP NULL` | posé quand la condition disparaît |

**Index unique partiel** : `UNIQUE (farm_id, dedup_key) WHERE status = 'ACTIVE'`.
→ dédup (une seule notif active par condition) + **ré-armement** (quand résolue,
la clé se libère ; si la condition revient, une nouvelle notif est créée).
Index `(farm_id, status, created_at DESC)` pour le feed.

Pas de `deleted_at` (le cycle de vie est `ACTIVE → RESOLVED`, pas de soft delete).

### `notification_reads`

| Colonne | Type | Notes |
|---|---|---|
| `id` | `BIGSERIAL PK` | |
| `notification_id` | `BIGINT NOT NULL` | FK `notifications(id) ON DELETE CASCADE` |
| `user_id` | `BIGINT NOT NULL` | FK `users(id)` |
| `read_at` | `TIMESTAMP NOT NULL` | |

**UNIQUE (notification_id, user_id)**. La notif est au périmètre ferme ;
l'état « lu » est **par utilisateur** (owner + manager voient la même notif,
la marquent lue indépendamment). Non-lu = absence de ligne.

### `notification_preferences`

| Colonne | Type | Notes |
|---|---|---|
| `id` | `BIGSERIAL PK` | |
| `farm_id` | `BIGINT NOT NULL` | FK `farms(id)` |
| `user_id` | `BIGINT NOT NULL` | FK `users(id)` |
| `category` | `VARCHAR NOT NULL` | même domaine que `notifications.category` |
| `channel` | `VARCHAR NOT NULL` | CHECK IN (`IN_APP`, `WHATSAPP`) |
| `enabled` | `BOOLEAN NOT NULL` | |
| `min_severity` | `VARCHAR NOT NULL` | CHECK IN (`INFO`, `WARNING`, `CRITICAL`) |

**UNIQUE (farm_id, user_id, category, channel)**. **Défaut (résolu en code, pas
en dur DB)** : `IN_APP` = ON (min `INFO`), `WHATSAPP` = OFF. Une ligne n'existe
que si l'utilisateur a surchargé le défaut → cohérent règle d'or paramétrage.
Le numéro WhatsApp est repris du **profil utilisateur** (pas dupliqué ici).

### `whatsapp_outbox`

| Colonne | Type | Notes |
|---|---|---|
| `id` | `BIGSERIAL PK` | |
| `notification_id` | `BIGINT NOT NULL` | FK `notifications(id)` |
| `phone` | `VARCHAR NOT NULL` | format Konekt `221XXXXXXXXX` |
| `message` | `TEXT NOT NULL` | corps rendu |
| `status` | `VARCHAR NOT NULL` | CHECK IN (`PENDING`, `SENT`, `FAILED`), défaut `PENDING` |
| `attempts` | `INT NOT NULL` | défaut 0 |
| `last_error` | `TEXT NULL` | |
| `provider_response` | `JSONB NULL` | réponse Konekt |
| `created_at` | `TIMESTAMP NOT NULL` | trigger |
| `sent_at` | `TIMESTAMP NULL` | |

Index `(status, created_at)` pour le worker.

---

## 3. Détection & planification

### Cron de scan

- `NotificationScannerService` déclenché par `@Scheduled` (nécessite
  `@EnableScheduling`).
- Cron **quotidien**, défaut **06:00 Africa/Dakar**, valeur en config
  (`notifications.scan.cron`, `notifications.scan.zone`).
- Boucle : pour chaque ferme active × chaque détecteur →
  1. calcule l'ensemble des `dedup_key` actuellement en condition (via facade) ;
  2. **crée** une notif `ACTIVE` pour chaque clé nouvelle (respect index unique) ;
  3. **résout** (`status=RESOLVED`, `resolved_at=now`) les notifs actives dont la
     clé n'est plus en condition.
- Idempotent : ré-exécuter le scan le même jour ne duplique rien.

### Détecteurs (une classe par catégorie, wrapper fin)

Chaque détecteur : `Set<DetectedCondition> detect(farmId)` où
`DetectedCondition = { category, severity, dedupKey, title, body, sourceRef }`.
Ils appellent les services compute-on-read existants via facade et **mappent**
vers `DetectedCondition`. Zéro logique métier neuve.

- `LowStockDetector`, `NegativeStockDetector`, `PurchaseOrderOverdueDetector`
  (← `InventoryFacade`)
- `VaccinationLateDetector`, `WithdrawalEndingDetector`,
  `CriticalObservationDetector` (← facade santé/`AlertService`)
- `CreditExceededDetector`, `InvoiceOverdueDetector` (← `CommercialFacade`)
- `MortalityAnomalyDetector` : à brancher sur le calcul de mortalité anormale
  existant s'il est exposé ; sinon seuil paramétrable (`alert_thresholds`) —
  **à confirmer au plan** selon ce qui est réellement calculable via facade.

### Événementiel (temps réel) — DIFFÉRÉ

Structuré mais **non codé en C1** : `NotificationScannerService.upsert(...)`
est public et réutilisable ; un futur listener de domaine
(`MortalityRecordedEvent`, `StockWentNegativeEvent`) pourra appeler le même
upsert pour notifier immédiatement, sans refonte.

### Concurrence

Mono-instance VPS → **pas de lock distribué** en C1 (noté comme dette si on
scale horizontalement).

---

## 4. WhatsApp (Konekt) — asynchrone, non bloquant

### Contrat API Konekt (relevé depuis la doc)

- Envoi simple : `POST https://konekt.nexteranga.com/send`
  - Headers : `Content-Type: application/json`, `X-WA-SECRET: <clé>`
  - Body : `{ "phone": "221770000000", "message": "...", "mediaUrl": "..." (optionnel) }`
- Envoi groupé : `POST /send-batch` — Body :
  `{ "numbers": ["221...","221..."], "message": "..." }`
- WhatsApp via **instance téléphone connectée** (pas la Business API officielle)
  → **pas de templates à approuver**, texte libre. Livraison **best-effort**
  (dépend du téléphone émetteur en ligne). Système à **crédits** (coût/message).

### Intégration

- `WhatsAppClient` (Spring `RestClient`), derrière interface `WhatsAppSender`
  (mockable en test — **aucun appel réseau réel en test**).
- Config : `konekt.base-url=https://konekt.nexteranga.com`,
  secret via **env `KONEKT_API_SECRET`** — **jamais commité** (settings VPS /
  `.env.production`). Feature flag `notifications.whatsapp.enabled` (défaut off en
  dev, on en prod).
- À la **création** d'une notif : pour chaque destinataire (membres de la ferme)
  ayant `WHATSAPP` ON pour la catégorie et `severity ≥ min_severity` → **enfiler**
  une ligne `whatsapp_outbox` (une par destinataire). L'enfilage est dans la même
  transaction que la création de notif ; **l'envoi ne l'est pas**.
- `WhatsAppDispatcher` `@Scheduled` (~2 min) : traite les `PENDING`, appelle
  Konekt, **retry + backoff** (cap `attempts`, ex. 5), `FAILED` au-delà.
  Transaction courte isolée par ligne → un échec n'affecte pas les autres.
- Normalisation téléphone → format Konekt (`221XXXXXXXXX` : retire `+`, espaces,
  préfixe pays si absent selon `farm_settings`/défaut Sénégal).
- **Discipline coût** : `WHATSAPP` **OFF par défaut** ; par défaut éligibilité
  **`CRITICAL`** seulement (l'utilisateur peut abaisser `min_severity`). Le
  digest via `/send-batch` est laissé en **extension** (pas C1).

---

## 5. API (contexte notification)

Toutes gatées `@FarmAccess.hasPermission(farmId, 'notification:read'|'notification:write')`
+ filtrage `getAccessibleFarmIds(user)`. Réponses `ApiResponse<T>` / `PageResponse<T>`,
erreurs RFC 7807.

| Méthode | Endpoint | Rôle |
|---|---|---|
| `GET` | `/api/v1/farms/{farmId}/notifications?status=&unread=&page=` | Feed paginé |
| `GET` | `/api/v1/farms/{farmId}/notifications/unread-count` | Badge cloche |
| `POST` | `/api/v1/farms/{farmId}/notifications/{id}/read` | Marquer lu |
| `POST` | `/api/v1/farms/{farmId}/notifications/read-all` | Tout marquer lu |
| `GET` | `/api/v1/farms/{farmId}/notification-preferences` | Lire préférences (défauts fusionnés) |
| `PUT` | `/api/v1/farms/{farmId}/notification-preferences` | Surcharger préférences |
| `POST` | `/api/v1/farms/{farmId}/notifications/scan` | **Dev only** — déclenche un scan (test) |

### Façade pour l'assistant IA (design-for, pas d'appel en C1)

```java
public interface NotificationFacade {
  List<NotificationView> listActive(Long farmId);   // pour "quelles alertes aujourd'hui ?"
  long unreadCount(Long farmId, Long userId);
}
```

L'assistant pourra brancher un `read tool` dessus plus tard sans refonte.

### Permissions RBAC

Nouvelles permissions `notification:read` / `notification:write`, ajoutées aux
`defaultPermissions()` conservateurs (OWNER/MANAGER/FARMER lecture ; écriture
= marquer lu / éditer ses préférences pour tout membre authentifié de la ferme).
`min_severity` et catégories restent paramétrables.

---

## 6. Web + mobile

### Web (Next.js + MUI + RTK Query)

- **Cloche** dans l'AppShell (barre haute) : badge unread, dropdown feed
  (12 dernières), « tout marquer lu », deep-link vers la source (`source_ref`).
- RTK Query `notificationsApi` : `getNotifications`, `getUnreadCount`,
  `markRead`, `markAllRead`, `getPreferences`, `updatePreferences`. **Polling
  ~60s** sur le badge (pas de websocket V1).
- Page **préférences** sous `/reglages` (grille catégorie × canal, toggles +
  min_severity ; champ téléphone WhatsApp = profil).
- Les panneaux d'alerte live existants (santé / stocks) **restent inchangés**.

### Mobile (React Native)

- Icône cloche dans le header + **écran notifications** + préférences dans les
  réglages. **Mêmes endpoints**. Polling au focus d'écran.
- Respect des patterns mobiles connus (tests RNTL async, imports par chemin
  relatif, gates = tsc + jest).

---

## 7. Configuration & secrets

- `konekt.base-url` (défaut `https://konekt.nexteranga.com`).
- `KONEKT_API_SECRET` — **env / secret VPS uniquement**, jamais dans le repo.
- `notifications.whatsapp.enabled` (bool), `notifications.scan.cron`,
  `notifications.scan.zone`, `notifications.whatsapp.dispatch.cron`.
- `@EnableScheduling` activé (nouveau) — vérifier qu'aucun autre `@Scheduled`
  n'entre en conflit.

---

## 8. Tests & garde-fous

- **Unit** : détecteurs (transition = création, disparition = résolution,
  ré-armement) ; dédup via clé ; résolution des préférences (défauts + surcharge) ;
  normalisation téléphone ; construction payload WhatsApp ; `WhatsAppDispatcher`
  (retry/backoff/FAILED) avec `WhatsAppSender` mocké — **aucun appel réseau réel**.
- **Slice** `@DataJpaTest` + Testcontainers pour les repos notif (⚠️ Testcontainers
  KO en local sur cette machine → valider non-TC en local, s'appuyer sur la CI).
- ⚠️ **Contextes DB-less** : chaque nouveau repo JPA doit être `@MockitoBean` dans
  `SecurityE2ETest`, `SecurityIntegrationTest` **et** `DashboardControllerIT`,
  sinon vert local / rouge CI.
- Couverture module ≥ 80 % sur la logique critique (détection, préférences,
  dispatch).

---

## 9. Périmètre (YAGNI C1)

**IN :** contexte `notification` + 4 tables ; cron détecteurs sur les alertes
existantes ; cloche unifiée web + mobile ; préférences par catégorie × canal ;
WhatsApp async single-send avec outbox/retry ; `NotificationFacade` pour l'IA.

**DIFFÉRÉ :** notifications événementielles temps réel (structurées, non codées) ;
FCM push ; email ; templates/média WhatsApp ; digest `/send-batch` ; lock
scheduler distribué ; code d'intégration assistant IA.

---

## 10. Séquencement d'implémentation (aperçu — détaillé au plan)

1. Migrations Flyway V34+ (4 tables) + entités/repos JPA.
2. Détecteurs + `NotificationScannerService` (cron) + facade santé manquante.
3. `NotificationService` + endpoints REST + RBAC + `NotificationFacade`.
4. WhatsApp : `WhatsAppClient`/`WhatsAppSender` + `whatsapp_outbox` + dispatcher.
5. Web : `notificationsApi` + cloche AppShell + page préférences.
6. Mobile : cloche + écran notifications + préférences.
7. Tests transverses + garde-fous DB-less + validation locale/CI.

Chaque étape = 1 PR (1 sujet), commits Conventional, sans signature.
