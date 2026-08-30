# ADR 010 — Traçabilité des requêtes (chantier P1)

**Date** : 2026-08-30
**Statut** : Accepté
**Auteur** : Abdou Malick Cisse

## Contexte

Le premier client payant arrive. Le premier appel de support sera : « j'ai eu une erreur ce matin
à 10h37 ». Aujourd'hui le `X-Correlation-Id` existe déjà (filtre `CorrelationIdFilter`, MDC, pattern
Logback, champ `traceId` de toute réponse RFC 7807) — mais il **ne survit nulle part** : il n'est ni
affiché à l'utilisateur, ni persisté, ni cherchable. Retrouver une requête revient à fouiller les
logs du conteneur, et chaque incident coûte 30 minutes et un peu de crédibilité.

Cf. `docs/roadmap-pre-first-client.md` §P1.

## Décisions

1. **Le header canonique reste `X-Correlation-Id`.** Le roadmap parlait de `X-Request-Id` ; le
   renommer aurait touché la CORS (`exposedHeaders`), le contrat d'erreur (`traceId`) et le pattern
   de logs pour zéro gain. `X-Request-Id` est **accepté en alias d'entrée** (proxies, CDN), la
   réponse porte toujours le nom canonique. L'identifiant reste un UUID v4 : le tri temporel est
   assuré par `started_at` indexé, un v7 imposerait un générateur maison.

2. **Politique de capture : erreurs + écritures + lectures lentes** (`avicare.tracing.capture`,
   défaut `ERRORS_AND_MUTATIONS`, alternative `ALL` pour une fenêtre de debug). Tout tracer ferait
   gonfler la table sans valeur : le mobile interroge l'API en boucle, et un GET qui a répondu 200
   en 40 ms n'intéresse personne. Une lecture au-delà de `slow-ms` (défaut 1000) est conservée —
   « c'était lent ce matin » est aussi un appel de support.

3. **Payloads : JSON masqué, tronqué, réponse seulement en erreur.** Tout champ dont le nom contient
   `password`, `secret`, `token`, `apikey`, `otp` ou `credential` est remplacé par `***`, à
   n'importe quelle profondeur. Un corps non-JSON (multipart, formulaire, binaire) n'est **pas**
   stocké du tout : ce qu'on ne sait pas masquer, on ne le garde pas. Les corps ne sont bufferisés
   que pour les écritures — envelopper chaque lecture dans un `ContentCachingResponseWrapper`
   coûterait de la mémoire sur tout le trafic pour un payload qu'on jette quand l'appel réussit.
   Conséquence assumée : une lecture en erreur est tracée sans corps de réponse (statut, durée,
   route et stack trace 5xx suffisent à ouvrir l'enquête).

4. **Écriture hors du chemin de requête**, sur un executor borné (1 thread, file 500,
   `DiscardPolicy`). Sous rafale on perd des traces plutôt que de ralentir un éleveur ;
   `CallerRunsPolicy` aurait remis l'insert dans la requête, soit exactement ce qu'on évite.

5. **Jointure trace ↔ audit.** `admin_audit_log` gagne une colonne `request_id` (nullable) remplie
   depuis le MDC. Il n'existe pas de table `activity_log` (l'activité ferme est dérivée à la volée
   par `reporting/ActivityService`) : le journal joignable est celui du back-office. Le trigger
   append-only refuse UPDATE/DELETE de **lignes** ; l'`ALTER TABLE` est du DDL et reste possible
   (vérifié en PSQL réel avant merge).

6. **Rétention 30 jours** (`RequestTracePurgeJob`, cron configurable). Une trace est un outil de
   débogage, pas une archive — et une copie fantôme des données de l'éleveur qui s'accumulerait
   serait un risque, pas un actif.

7. **Permission `metrics:read`** (existante) : c'est de l'observabilité plateforme, au même titre
   que le cockpit. La **consultation du détail** d'une trace est en revanche auditée
   (`trace.view`) : c'est le seul endroit de la console où un payload de ferme s'affiche.

## Conséquences

- Un incident se retrouve en une recherche : l'utilisateur lit la référence courte affichée dans son
  message d'erreur (5xx uniquement — un 4xx métier reste un message propre), le support la colle
  dans `/console/traces`.
- Le filtre et l'interceptor de tracing sont **enregistrés explicitement** (`TracingConfig`,
  `AdminAuditWebConfig`) plutôt que component-scannés : un `@Component` de type `Filter` est chargé
  par chaque `@WebMvcTest`, qui n'a pas de services — chaque slice aurait dû mocker un recorder dont
  elle n'a que faire.
- `RequestTraceRepository` est un nouveau repo JPA : il doit être `@MockitoBean` dans les six
  contextes DB-less (cf. `CONTRIBUTING.md`).
- Coupure possible sans redéploiement : `TRACING_ENABLED=false` n'éteint que la table — le
  `X-Correlation-Id`, les logs et le `traceId` des erreurs continuent de fonctionner.

## Alternatives écartées

- **OpenTelemetry / collecteur externe** : un backend de traces à héberger et à payer pour un
  serveur unique et un dev solo. À reconsidérer quand la plateforme sera distribuée.
- **Écrire toutes les requêtes** : volumétrie sans usage (cf. décision 2).
- **Nouvelle permission `traces:read`** : une permission de plus à distribuer pour la même
  population que `metrics:read`.
