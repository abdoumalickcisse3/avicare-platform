# 🎯 Roadmap Pré-Premier-Client — Console admin + Continuité opérationnelle

> **Contexte** : Plateforme AviCare (SaaS multi-tenant B2B avicole Sénégal) en ligne, tous sprints B + C1 livrés, console admin déployée (`admin.jawdi.app`, 10 écrans, 55 routes, schéma V47). **Aucun client réel encore.** Objectif : boucler les manques critiques identifiés en audit avant de signer le premier client payant.
> 
> **Audit source** : conversation stratégique du 2026-08-30 avec Claude (chat).
> 
> **Contraintes** :
> - Solo dev, pas de dette technique lourde à ajouter
> - Réutiliser patterns existants (requireStatus, façades, activity_log)
> - Chaque item = livrable indépendant, PR séparée
> - COMMITS SANS SIGNATURE CLAUDE

---

## 📊 Score audit initial

| Axe | Score | Notes |
|-----|-------|-------|
| Conception | 9/10 | Raisonnement documenté par écran, gardes multiples |
| Sécurité | 8/10 | Audit inviolable + gardes escalade + impersonation exemplaires |
| Couverture features | 6/10 | ~60% des blocs suggérés couverts |
| Maturité opérationnelle | **4/10** | Dev solo = SPOF, runbooks manquants |
| Différenciation | 9/10 | Benchmarks anonymes + portail partenaires = unique en zone |

**Note globale : 7.2/10** — au-dessus du SaaS B2B early-stage africain moyen.

---

## 🎯 Périmètre de cette roadmap

**6 chantiers**, ordonnés par priorité et dépendance :

1. **P1 — Correlation-id + distributed tracing** (1-2j)
2. **P2 — Data integrity checks + recompute engine** (5-8j)
3. **P3 — Kill switch feature flags runtime** (1-2j)
4. **P4 — Threat detection basique + rate limiting** (3-4j)
5. **P5 — Runbooks opérationnels** (2-3j, doc-only)
6. **P6 — Plan continuité opérationnelle** (2-3j, mix doc + config)

**Total estimé : 15-22 jours** de dev/doc.

---

## P1 — Correlation-id + Distributed tracing

### Pourquoi
Le premier client va appeler : *"j'ai eu une erreur ce matin à 10h37"*. Sans corrélation entre logs Web → Backend → DB → Cron, tu perds 30 min/incident. Chaque incident = perte de crédibilité.

### Livrable
- Chaque requête HTTP entrante a un `X-Request-Id` (UUID v7 idéalement, sortable temporellement)
- Propagé en MDC Logback → présent dans TOUS les logs backend
- Frontend affiche `request-id` dans les toasts d'erreur (utilisateur peut le communiquer)
- Écran admin `/console/traces` : recherche par request-id → timeline complète

### Détails techniques

**Backend Spring Boot** :
```java
// Middleware/Filter
@Component
@Order(1)
public class CorrelationIdFilter extends OncePerRequestFilter {
  private static final String HEADER = "X-Request-Id";
  private static final String MDC_KEY = "requestId";
  
  protected void doFilterInternal(request, response, chain) {
    String id = request.getHeader(HEADER);
    if (id == null || id.isBlank()) id = UUID.randomUUID().toString();
    MDC.put(MDC_KEY, id);
    response.setHeader(HEADER, id);
    try {
      chain.doFilter(request, response);
    } finally {
      MDC.remove(MDC_KEY);
    }
  }
}
```

**Logback pattern** : ajouter `[%X{requestId:-none}]` au pattern.

**Table `request_traces`** (nouvelle) :
```sql
CREATE TABLE request_traces (
  id BIGSERIAL PRIMARY KEY,
  request_id VARCHAR(64) NOT NULL UNIQUE,
  method VARCHAR(10) NOT NULL,
  path VARCHAR(500) NOT NULL,
  user_id BIGINT REFERENCES users(id),
  farm_id BIGINT REFERENCES farms(id),
  status_code INTEGER,
  duration_ms INTEGER,
  request_body_snapshot TEXT,  -- masqué mots de passe, PII
  response_body_snapshot TEXT,  -- tronqué si > 10Ko
  error_message TEXT,
  stack_trace TEXT,
  started_at TIMESTAMP NOT NULL,
  ended_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_traces_request_id ON request_traces(request_id);
CREATE INDEX idx_traces_user ON request_traces(user_id, started_at DESC);
CREATE INDEX idx_traces_farm ON request_traces(farm_id, started_at DESC);
CREATE INDEX idx_traces_errors ON request_traces(started_at DESC) WHERE status_code >= 500;
```

**Rétention** : 30 jours (job purge nightly). Écrit async via queue (pas dans le request path).

**Écran admin `/console/traces`** :
- Recherche par : request-id, user email, farm_id, endpoint, status_code
- Timeline visuelle par trace (start → end, durée)
- Payload (masqué credentials automatiquement)
- Stack trace si erreur
- Lien vers activity_log correspondant
- Filtre "erreurs uniquement" (status >= 400)

**Permission requise** : `metrics:read` (existant, pas de nouvelle perm).

### Acceptance criteria
- [x] Toute requête HTTP a un identifiant de corrélation (généré si absent en input).
      **Header canonique `X-Correlation-Id`** — déjà en place et conservé ; `X-Request-Id` est
      accepté en alias d'entrée (cf. ADR-010, décision 1)
- [x] Tous les logs backend contiennent le requestId (`logback-spring.xml`, `[%X{correlationId}]`)
- [x] Frontend : la référence courte s'affiche dans les erreurs — `apiErrorMessage()` la suffixe
      sur les 5xx (un seul point de modification pour les ~79 appelants), `app/error.tsx` affiche
      le `digest` d'une erreur de rendu
- [x] Écran /console/traces : recherche par référence, email, endpoint, filtre « erreurs seulement »,
      détail avec payloads masqués, stack trace et actions d'audit liées
- [x] Test IT : `AdminTraceApiIT` — POST authentifié → `GET /admin/traces?requestId=…` retrouve la
      trace (+ masquage du mot de passe, + 401/403 pour tout le monde sauf `metrics:read`)
- [x] Rétention 30 jours : `RequestTracePurgeJob` (cron configurable) + `RequestTraceRepositoryIT`
- [x] Migration V48 appliquée (validée en PSQL réel BEGIN/ROLLBACK puis par Flyway au démarrage)

**Décisions d'architecture** : `docs/decisions/010-request-tracing.md` (header canonique, politique
de capture erreurs+écritures+lectures lentes, masquage/troncature, écriture asynchrone, jointure
avec `admin_audit_log`).

### Estimation : **1-2 jours**

---

## P2 — Data integrity checks + Recompute engine

### Pourquoi
Cascade D18 (StockConsumption cross-context) + workflows Order/Sale/Delivery/Invoice/Payment = **il y aura des incohérences**. Bugs subtils, races conditions, deploys foireux. Sans détection auto, tu les découvriras via un client furieux.

### Livrable
- Job cron nightly (3h du matin) qui check invariants critiques
- Écran `/console/integrite` : anomalies détectées + preview
- Recompute engine : re-calcul depuis données source (dry-run + apply)
- Toutes actions bulk = audit + confirmation double

### Invariants à vérifier

```
1. STOCK
   stock_items.current_quantity == SUM(stock_movements.quantity signé)
   pour chaque stock_item actif

2. ORDERS
   orders.total_xof == SUM(order_items.line_total_xof) pour chaque order

3. INVOICES
   invoices.paid_xof == SUM(payments.amount_xof WHERE invoice_id = X)
   invoices.status cohérent avec paid vs total

4. CLIENTS BALANCE
   clients.current_balance_xof == 
     SUM(invoices.total_xof) - SUM(payments.amount_xof) pour ce client

5. LIVESTOCK
   production_units.current_count cohérent avec initial - SUM(mortality)
   
6. FKs ORPHELINES
   deliveries sans order source
   invoices sans sale ni delivery source
   payments sans invoice/sale/delivery
   
7. WORKFLOW STATES
   order.status = DELIVERED → doit avoir delivered_at + delivered_by
   invoice.status = PAID → paid_xof == total_xof
   po.status = RECEIVED → tous items.received_quantity > 0
   
8. HEALTH
   vaccinations avec doses_count = 0 (bug UI ?)
   treatments avec quantity = 0
   production_units avec 0 daily_records depuis 30j (lot fantôme ?)
```

### Détails techniques

**Table `integrity_findings`** (nouvelle) :
```sql
CREATE TABLE integrity_findings (
  id BIGSERIAL PRIMARY KEY,
  check_key VARCHAR(80) NOT NULL,     -- 'stock_movement_sum', 'order_total_mismatch', etc.
  severity VARCHAR(20) NOT NULL,       -- INFO, WARNING, CRITICAL
  entity_type VARCHAR(50) NOT NULL,    -- 'stock_item', 'order', etc.
  entity_id BIGINT NOT NULL,
  farm_id BIGINT REFERENCES farms(id),
  expected_value TEXT,                  -- valeur attendue (JSON)
  actual_value TEXT,                    -- valeur réelle (JSON)
  details JSONB,                        -- contexte enrichi
  detected_at TIMESTAMP NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMP,
  resolved_by BIGINT REFERENCES users(id),
  resolution_action VARCHAR(80),        -- 'recomputed', 'manual_fix', 'accepted_drift'
  resolution_notes TEXT,
  
  CONSTRAINT chk_severity CHECK (severity IN ('INFO','WARNING','CRITICAL'))
);
CREATE INDEX idx_integrity_unresolved 
  ON integrity_findings(detected_at DESC) 
  WHERE resolved_at IS NULL;
CREATE INDEX idx_integrity_entity ON integrity_findings(entity_type, entity_id);
```

**Service `IntegrityCheckService`** :
- `runAllChecks()` — appelé par cron
- 1 méthode par invariant : `checkStockMovementSums()`, `checkOrderTotals()`, etc.
- Chaque check retourne `List<IntegrityFinding>` (empty si OK)
- Persist findings non résolues
- Auto-resolve findings anciennes si condition redevient OK (drift auto-corrigé)

**Service `RecomputeService`** :
- `recomputeStockCurrentQuantity(stockItemId, dryRun)` → `RecomputeResult(before, after, delta)`
- `recomputeClientBalance(clientId, dryRun)`
- `recomputeInvoicePaid(invoiceId, dryRun)`
- Toujours dry-run first pattern
- Apply nécessite raison textuelle + user_id + double confirm frontend

**Écran `/console/integrite`** :
- Dashboard : count par severity (CRITICAL rouge en haut)
- Liste findings unresolved (paginée, filtrable par check_key, farm)
- Card par finding : expected vs actual + JSONB details
- Bouton "Enquêter" → drill-down entity
- Bouton "Recomputer" (si applicable) → modal dry-run + confirm
- Bouton "Accepter le drift" (avec raison) → mark resolved

**Cron job** : 
- `0 3 * * *` (3h locale) via `scheduled_jobs_service` existant
- Configurable : `INTEGRITY_CHECKS_ENABLED=true`
- Génère notification staff si CRITICAL detected

**Permission requise** : `integrity:read` + `integrity:recompute` (nouvelles).

### Acceptance criteria
- [x] Table `integrity_findings` + migration **V50** (et non V49 : P3 mergé avant P2, cf. ADR-011),
      avec index unique partiel sur les anomalies ouvertes et `notified_at`
- [x] `IntegrityCheckService` avec **9 contrôles**. Quatre invariants de la liste ci-dessus étaient
      faux face au schéma réel et ont été redérivés de leurs écrivains ; celui des FK orphelines est
      structurellement impossible (NOT NULL + FK) et a été remplacé par la cohérence multi-tenant.
      Détail dans **ADR-012**
- [x] `RecomputeService` : stock, encours client, payé facture — et **rien d'autre** : jamais une
      valeur saisie par un humain (422 `RECOMPUTE_NOT_SUPPORTED`)
- [x] Cron nocturne configurable + déclenchement manuel depuis la console
- [x] Écran `/console/integrite` : compteurs par sévérité, liste triée par gravité, dry-run avant
      écriture, recalcul / corrigé / écart accepté, chacun avec raison obligatoire
- [x] Test IT `IntegrityFlowIT` : incohérence injectée → détectée → recalculée → anomalie close →
      contrôle d'accord. C'est aussi ce qui garantit que contrôle et recalcul partagent la formule
- [x] Audit de chaque action (`integrity.recomputed` / `.accepted_drift` / `.manual_fix`) avec
      l'acteur et sa raison ; le balayage automatique s'inscrit avec un acteur nul
- [x] Notification staff sur CRITICAL, **une seule fois** par anomalie (`notified_at`)

**Vérifié sur les données de production** : 0 CRITICAL, 0 WARNING, 38 INFO authentiques.

**Décisions d'architecture** : `docs/decisions/012-data-integrity-checks.md`.

### Estimation : **5-8 jours**

---

## P3 — Kill switch feature flags runtime

### Pourquoi
Bug détecté à 22h sur `module.commercial`. Ton kill switch actuel = "par ferme". Il faut aussi : **kill switch plateforme entière** en 1 clic. Sinon = SSH + rebuild + deploy = 1-2h pendant lesquelles chaque nouvelle donnée peut être corrompue.

### Livrable
- Table `feature_flags` : flags plateforme (pas par ferme)
- Écran `/console/urgence` : toggle actif/inactif par module
- Backend : middleware vérifie flag avant chaque endpoint gaté
- Kill switch = auto-expire après 30 min (force revalidation)
- Log audit + notification Slack/WhatsApp staff

### Détails techniques

**Table `feature_flags`** :
```sql
CREATE TABLE feature_flags (
  id BIGSERIAL PRIMARY KEY,
  flag_key VARCHAR(80) NOT NULL UNIQUE,   -- 'module.commercial', 'cascade.d18', etc.
  enabled_globally BOOLEAN NOT NULL DEFAULT TRUE,
  killswitch_active BOOLEAN NOT NULL DEFAULT FALSE,
  killswitch_reason TEXT,
  killswitch_by BIGINT REFERENCES users(id),
  killswitch_at TIMESTAMP,
  killswitch_expires_at TIMESTAMP,   -- auto-expire 30 min après activation
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Seed : 1 flag par module existant
INSERT INTO feature_flags(flag_key) VALUES
  ('module.poultry.broiler'),
  ('module.poultry.layer'),
  ('module.health.basic'),
  ('module.health.advanced'),
  ('module.inventory'),
  ('module.commercial'),
  ('module.finance'),
  ('cascade.d18.stock_consumption'),
  ('assistant.enabled'),
  ('whatsapp.outbound');
```

**Service `FeatureFlagService`** :
- `isEnabled(flagKey)` → boolean (cache 30s pour perf)
- `activateKillswitch(flagKey, reason, userId)` → notif + audit
- `deactivateKillswitch(flagKey, userId)`
- Job cron toutes les 5min : auto-deactivate killswitches expirés

**Extension du middleware existant** :
```java
// SubscriptionFacade.isEnabled(...) devient :
public boolean isEnabled(Long farmId, String moduleKey) {
  // 1. Kill switch plateforme
  if (featureFlagService.isKillswitchActive(moduleKey)) return false;
  // 2. Feature gating existant (per farm)
  return existingCheck(farmId, moduleKey);
}
```

**Écran `/console/urgence`** :
- Liste tous les flags
- Toggle "Actif global" (peut désactiver un flag)
- Bouton rouge "🚨 Kill switch" par flag → modal reason obligatoire
- Countdown visible si killswitch actif (temps restant avant auto-expire)
- Bouton "Prolonger 30 min" (reset expiration)
- Bouton "Désactiver kill switch" (avant expiration)
- Historique 30 derniers changements

**Permission requise** : `flags:manage` (nouvelle, réservée à `*` super-admin).

### Acceptance criteria
- [x] Table feature_flags + seed (15 flags) + migration **V49** (et non V50 : ordre de merge
      P1 → P3 → P2 et Flyway sans `out-of-order`, cf. ADR-011)
- [x] `FeatureFlagService` avec cache 30 s, **fail open** si la table est illisible, invalidé à
      chaque écriture (une coupure prend effet immédiatement)
- [x] `SubscriptionFacadeImpl.isModuleEnabled` **et** `FeatureChecker` vérifient la coupure —
      le second **avant** les bypass ADMIN et dev, sinon le personnel écrirait dans le module coupé
- [x] Écran `/console/urgence` : coupure avec raison obligatoire, compte à rebours, prolonger,
      lever, interrupteur permanent, 30 derniers changements
- [x] Auto-expiration 30 min : balayage cron toutes les 5 min **et** fenêtre honorée à la lecture
      (une coupure échue cesse de bloquer à la seconde, sans attendre le balayage)
- [x] Test IT `KillSwitchApiIT` : coupure → endpoint gaté en **503** avec la raison ; le staff
      ADMIN reçoit 503 lui aussi ; RBAC ; raison vide refusée ; balayage + historique
- [x] Notification staff par WhatsApp (rail Konekt existant) à la coupure, à la levée et à
      l'expiration ; `ADMIN_ONCALL_PHONE` vide = pas de notif, l'audit reste écrit
- [x] Audit de chaque bascule, y compris celles du balayage (acteur nul = la plateforme)

**Décisions d'architecture** : `docs/decisions/011-platform-kill-switch.md`.

### Estimation : **1-2 jours**

---

## P4 — Threat detection basique + Rate limiting

### Pourquoi
Aujourd'hui : rien. Attaquant peut brute-force login, créer 1000 comptes trial en 5 min, scraper endpoints publics. **Critique avant premier client payant** (SLA, réputation, coûts infra).

### Livrable
- Rate limiting global (Bucket4j) : par IP + par user
- Détection anomalies auth : failed logins, signups suspects, sessions concurrentes
- Écran `/console/securite` : événements sécurité 7j
- Blocage temporaire IP auto après N failed logins

### Détails techniques

**Dépendance** : `com.bucket4j:bucket4j-core` + `bucket4j-postgresql` (distribué).

**Rate limits (défaut)** :
```
- /auth/login : 5 req/min par IP + 10/min par email
- /auth/signup : 3/hour par IP
- /* (autres endpoints authentifiés) : 100 req/min par user
- /admin/* : 30 req/min par user (staff)
```

**Table `security_events`** :
```sql
CREATE TABLE security_events (
  id BIGSERIAL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,    -- 'FAILED_LOGIN', 'RATE_LIMIT_EXCEEDED', 
                                       -- 'SIGNUP_ANOMALY', 'CONCURRENT_SESSIONS',
                                       -- 'IP_GEO_ANOMALY', 'BRUTEFORCE_DETECTED'
  severity VARCHAR(20) NOT NULL,       -- INFO, WARNING, CRITICAL
  ip_address INET NOT NULL,
  user_id BIGINT REFERENCES users(id),  -- null si signup/login non résolu
  email VARCHAR(255),                   -- pour tracer même sans user_id
  user_agent TEXT,
  geo_country VARCHAR(2),               -- via IP lookup (V2)
  details JSONB,
  action_taken VARCHAR(80),             -- 'blocked', 'warned', 'notified_staff'
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_sec_events_recent ON security_events(created_at DESC);
CREATE INDEX idx_sec_events_ip ON security_events(ip_address, created_at DESC);
CREATE INDEX idx_sec_events_email ON security_events(email, created_at DESC);
```

**Table `blocked_ips`** :
```sql
CREATE TABLE blocked_ips (
  ip_address INET PRIMARY KEY,
  blocked_at TIMESTAMP NOT NULL DEFAULT NOW(),
  blocked_until TIMESTAMP NOT NULL,
  reason VARCHAR(255) NOT NULL,
  blocked_by VARCHAR(80) NOT NULL     -- 'AUTO_BRUTEFORCE' or user_email
);
```

**Service `ThreatDetectionService`** :
- `recordFailedLogin(ip, email)` → si 5+ échecs 15 min → block IP 1h + event CRITICAL
- `recordSignup(ip, email)` → si 3+ signups 1h même IP → warn
- `detectConcurrentSessions(userId)` → si > 3 sessions actives → event
- `checkIpGeography(ip, userId)` → si pays inhabituel pour ce user → event (V2)

**Middleware `IpBlockingFilter`** : rejette 403 si IP dans blocked_ips.

**Écran `/console/securite`** :
- Timeline events 7 derniers jours (filtrable par severity/type)
- Liste IP bloquées + bouton "Débloquer" (avec raison)
- Métriques : login attempts/hour, signups/hour, blocks/day
- Alerte visuelle si CRITICAL détecté dernières 24h

**Notification staff** : événement CRITICAL → WhatsApp/Slack immédiat.

**Permission requise** : `security:read` + `security:manage` (nouvelles).

### Acceptance criteria
- [ ] Bucket4j configuré avec limits ci-dessus
- [ ] Endpoints rate-limités retournent 429 Too Many Requests
- [ ] Table security_events + blocked_ips + migration V51
- [ ] ThreatDetectionService fonctionne (auto-block bruteforce)
- [ ] IpBlockingFilter en premier dans chain (avant auth)
- [ ] Écran /console/securite fonctionnel
- [ ] Test IT : simuler 10 failed logins → IP bloquée + event CRITICAL
- [ ] Notification staff sur CRITICAL

### Estimation : **3-4 jours**

---

## P5 — Runbooks opérationnels

### Pourquoi
**Tu es le seul à savoir comment débugger la plateforme.** Si tu es indisponible, un autre dev doit pouvoir résoudre en < 30 min. Sinon = perte client. Ces runbooks sont **la doc qui te libère** (autres devs, futur toi dans 6 mois qui a oublié).

### Livrable
Dossier `docs/runbooks/` avec 1 fichier MD par scénario.

### Runbooks à écrire (minimum viable)

```
docs/runbooks/
├── README.md                                    # Index + comment utiliser
├── incidents/
│   ├── client-facture-non-generee.md           # Debugger cascade Order → Invoice
│   ├── stock-incoherent-apres-d18.md           # Symptomes + recompute
│   ├── delivery-bloquee-status.md              # Workflow Order/Delivery states
│   ├── whatsapp-envoi-echoue.md                # Debug Konekt + retry
│   ├── assistant-repond-nimporte-quoi.md       # Review + kill switch
│   ├── backup-manqué.md                         # Diagnostic + relance
│   ├── cascade-d18-timeout.md                   # Long-running transaction
│   └── charge-elevee-lenteur.md                 # Slow queries + N+1 detection
├── ops/
│   ├── deploy-production.md                     # Steps deploy + rollback
│   ├── migration-flyway-en-prod.md              # Preview + apply + rollback
│   ├── restore-from-backup.md                   # Test restore mensuel
│   ├── ajouter-un-super-admin.md                # SQL direct (bootstrap)
│   ├── impersonation-support.md                 # Comment utiliser mode support
│   ├── rotation-jwt-secret.md                   # Sans invalider tous les tokens
│   └── kill-switch-module.md                    # Quand + comment
├── data/
│   ├── recompute-stock.md                       # Utiliser RecomputeService
│   ├── recompute-client-balance.md              # Cohérence facturation
│   ├── purger-ferme-test.md                     # Compliance workflow
│   └── anonymiser-user.md                       # Compliance workflow
└── recovery/
    ├── panne-backend-total.md                   # Redémarrer + vérifier state
    ├── db-corruption.md                          # Restore backup + replay logs
    ├── ddos-attack.md                            # Cloudflare + rate limits
    └── data-leak-suspicion.md                    # Procédure d'urgence + notif
```

### Template standard par runbook

```markdown
# [Titre du runbook]

**Sévérité** : LOW / MEDIUM / HIGH / CRITICAL
**Temps résolution moyen** : X minutes
**Dernière mise à jour** : YYYY-MM-DD par [nom]

## Symptômes
- Ce que le client rapporte
- Ce que tu vois dans les logs / metrics

## Diagnostic (étapes ordonnées)
1. Vérifier X dans /console/traces
2. Requête SQL / API à faire
3. Interpréter le résultat

## Résolution
### Option A : cas nominal
```
Étapes de fix step-by-step avec commandes exactes
```

### Option B : cas dégradé
```
Fallback si option A ne marche pas
```

### Option C : escalation
- Qui appeler
- Kill switch à activer
- Rollback deploy si nécessaire

## Post-mortem
- Créer issue GitHub avec label `incident`
- Analyser cause racine
- Ajouter test régression si applicable
- Mettre à jour ce runbook si nouveau cas

## Références
- Endpoints impliqués : /api/v1/xxx
- Tables impliquées : orders, invoices, ...
- ADRs pertinents : ADR-008, D18
- Commits historiques : #NNN
```

### Priorité runbooks (à écrire d'abord)

**Top 5 CRITICAL** (avant premier client) :
1. `client-facture-non-generee.md` — le plus probable premier incident
2. `stock-incoherent-apres-d18.md` — cascade complexe
3. `backup-manqué.md` — pour dormir tranquille
4. `deploy-production.md` — reproductibilité
5. `restore-from-backup.md` — tester au moins 1 fois avant client réel

Les autres = post-premier client, en itératif.

### Acceptance criteria
- [ ] Dossier docs/runbooks/ créé avec structure ci-dessus
- [ ] README.md avec index + convention utilisation
- [ ] 5 runbooks CRITICAL rédigés selon template
- [ ] Chaque runbook testé au moins 1 fois (exécuter les steps)
- [ ] Lien depuis CLAUDE.md et README principal
- [ ] Convention : runbooks mis à jour après CHAQUE incident réel

### Estimation : **2-3 jours** (rédaction + validation)

---

## P6 — Plan continuité opérationnelle (SPOF dev solo)

### Pourquoi
**Tu es le SPOF de ta plateforme.** Si tu es indisponible (accident, burn-out, obligation familiale) pendant 1 semaine avec incident en cours → plateforme meurt. Un client qui paie 25 000 F/mois attend que ça marche **même si tu es à l'hôpital**.

Ce chantier n'est pas technique. C'est **procédural + humain**.

### Livrable
1. Doc `docs/continuity/README.md` : plan de continuité opérationnelle
2. Dead man switch : notification auto si absence > 72h
3. Contact d'urgence identifié + brief
4. Accès d'urgence sécurisé mais documenté

### Détails

**1. Document `docs/continuity/emergency-access.md`** (chiffré ou dans coffre) :

```markdown
# 🚨 Accès d'urgence AviCare

**ACCÈS À NE PARTAGER QU'À** : [Nom personne de confiance]
**En cas de** : indisponibilité Malick > 48h avec incident client en cours

## Contact principal
- Malick Cisse : +221 XX XX XX XX (WhatsApp)
- Email : xxx@xxx.com

## Contact de secours (à définir avec accord)
- [Nom + relation]
- Téléphone : +221 XX XX XX XX
- A quoi il/elle a accès :
  - [ ] Console admin.jawdi.app (compte staff *) — voir credentials-vault
  - [ ] GitHub org (droits admin)
  - [ ] Hébergeur (Hetzner/OVH/AWS) — accès facturation + reboot
  - [ ] DNS registrar (renouvellement)
  - [ ] Compte Konekt (WhatsApp API)
  - [ ] Base de données (backup + restore, PAS de write direct)

## Ce que peut faire le contact de secours
- Kill switch un module qui dysfonctionne (/console/urgence)
- Communiquer avec les clients via /console/communication
- Suivre les runbooks (docs/runbooks/)
- Restore backup si DB corrompue
- Reboot serveur

## Ce qu'il NE DOIT PAS faire
- Deploy nouveau code (accepter la dette d'incident, ne pas la aggraver)
- Modifier schema (Flyway) sans validation Malick
- Changer les prix / plans commerciaux

## Où trouver
- Credentials vault : [Bitwarden / 1Password / GPG file location]
- Documentation : github.com/[org]/avicare/docs
- Runbooks : docs/runbooks/
- Monitoring : [URL Grafana / UptimeRobot]

## Compensation
- [Définir : accès pro bono / retainer mensuel / one-shot par intervention]
```

**2. Dead man switch (technique)** :

```java
// Job cron dans backend
@Scheduled(cron = "0 0 * * * *")  // toutes les heures
public void checkOwnerHeartbeat() {
  Instant lastLogin = staffService.getLastLoginForOwner();
  Duration since = Duration.between(lastLogin, Instant.now());
  
  if (since.toHours() > 72) {
    // Notification WhatsApp au contact de secours
    emergencyNotifier.notify(
      "Malick n'a pas été vu sur admin.jawdi.app depuis 72h. " +
      "Vérifier son état + activer procédure de continuité si nécessaire."
    );
  }
}
```

**3. Table `owner_heartbeat`** :
```sql
CREATE TABLE owner_heartbeat (
  id BIGSERIAL PRIMARY KEY,
  owner_user_id BIGINT NOT NULL REFERENCES users(id),
  last_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
  triggered_alerts_count INTEGER DEFAULT 0,
  last_alert_at TIMESTAMP
);
```

Updated à chaque login admin par Malick.

**4. Runbook `docs/continuity/what-to-do-if-owner-unavailable.md`** :
- Vérification 1 : essayer contact direct (WhatsApp, appel, famille)
- Vérification 2 : voir si un incident est en cours (`/console/traces?errors=true`)
- Décision : activer kill switch en préventif ? ou attendre ?
- Communication client : template de message d'attente
- Suivi : logger toutes actions faites pour Malick à son retour

### Acceptance criteria
- [ ] Doc emergency-access.md rédigé (contact de secours identifié + briefé)
- [ ] Contact de secours confirmé + a testé login console 1 fois
- [ ] Dead man switch implémenté (notification 72h)
- [ ] Runbook what-to-do-if-owner-unavailable.md rédigé
- [ ] Credentials vault créé (Bitwarden/1Password)
- [ ] Test complet : simuler "Malick indispo" → contact de secours 
      arrive à faire kill switch + envoyer notif clients
- [ ] Contrat clair (même informel) avec contact de secours

### Estimation : **2-3 jours** (surtout coordination + test)

---

## 📋 Planning suggéré

**Semaine 1** : P1 (correlation-id) + P3 (kill switch) — 3-4j — bases posées
**Semaine 2-3** : P2 (data integrity + recompute) — 5-8j — le plus gros
**Semaine 4** : P4 (threat detection + rate limiting) — 3-4j
**Semaine 5** : P5 (runbooks) + P6 (continuité) en parallèle — 4-6j

**Total : 4-5 semaines** de travail concentré avant premier client.

**Ordre de merge** : P1 → P3 → P2 → P4 → P5 → P6 (chaque merge = tag mineur).

---

## 🎯 Après cette roadmap

**Signaux "prêt pour premier client payant"** :
- ✅ Incident client debuggable en < 5 min (P1)
- ✅ Data integrity vérifiée quotidiennement + recompute possible (P2)
- ✅ Kill switch fonctionnel (P3)
- ✅ Rate limiting + block IP auto (P4)
- ✅ 5 runbooks CRITICAL rédigés + testés (P5)
- ✅ Contact de secours briefé + accès vérifié (P6)

**Post-premier client** (Phase C2+, non couvert ici) :
- Slow query detector + N+1 monitor
- Sandbox tenant clone anonymisé
- Bulk operations preview + rollback
- Query builder GUI safe
- Regional Health Network (différenciateur)
- Anomaly detection ML léger

---

## ⚠️ Règles pour Claude Code

- **COMMITS SANS SIGNATURE CLAUDE** (toujours)
- **1 PR par chantier** (P1, P2, P3, P4, P5, P6 = 6 PRs distinctes)
- **CI verte obligatoire** avant merge
- **Migration Flyway numérotée**, dans l'ordre de **merge** et non dans l'ordre du plan :
  V48 (P1), V49 (P3), V50 (P2), V51 (P4). Flyway tourne sans `out-of-order` — une migration
  numérotée plus bas qu'une migration déjà appliquée est refusée au démarrage
- **@MockitoBean pour nouveaux repos** dans SecurityE2ETest + SecurityIntegrationTest (gotcha connu)
- **Tests Testcontainers IT** pour chaque check métier (P2 notamment)
- **Validation PSQL réelle** (BEGIN/ROLLBACK) avant push migrations
- **Pattern requireStatus** réutilisé où applicable (P3 workflow states)
- **Audit log obligatoire** pour toute action mutante (P1, P2, P3, P4)
- **Doc mise à jour** après chaque PR (ADR si architecture, sinon doc opérationnelle)

## 📞 Points de validation stratégique

Avant de lancer chaque chantier, Claude Code **DOIT** :
1. Lire `CLAUDE.md`
2. Confirmer lecture de ce roadmap (docs/roadmap-pre-first-client.md)
3. Proposer plan détaillé Étape 2+3 (diagnostic + design)
4. **ATTENDRE VALIDATION Malick** avant implémentation
5. Tester en local avant push
6. CI verte avant merge

---

_Doc rédigé le 2026-08-30 après audit stratégique. À réviser après chaque PR mergée._
_Contact : Malick Cisse (Dakar). Plateforme : admin.jawdi.app._