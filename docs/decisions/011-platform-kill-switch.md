# ADR 011 — Kill switch plateforme (chantier P3)

**Date** : 2026-08-31
**Statut** : Accepté
**Auteur** : Abdou Malick Cisse

## Contexte

Le gating existant répond « cette ferme a-t-elle ce module ? ». Un bug détecté à 22h pose une
question différente : « ce module est-il en train de corrompre des données ? ». La seule réponse
disponible jusqu'ici était de désactiver le module **ferme par ferme**, ou de redéployer — une à
deux heures pendant lesquelles chaque écriture peut aggraver les dégâts.

Cf. `docs/roadmap-pre-first-client.md` §P3.

## Décisions

1. **Numérotation : V49, pas V50.** La roadmap réservait V49 à P2 et V50 à P3, mais l'ordre de merge
   est P1 → P3 → P2 et Flyway tourne sans `out-of-order` : une V49 appliquée après une V50 serait
   **refusée au démarrage** en production. P3 prend V49, P2 prendra V50. La règle générale est
   désormais : le numéro suit l'ordre de merge, pas l'ordre du plan.

2. **Deux interrupteurs distincts.** `enabled_globally` est une décision permanente (« on ne sert pas
   encore ça »). `killswitch_active` est une urgence : raison obligatoire, auteur, expiration
   automatique à 30 minutes. Les confondre reviendrait à laisser une coupure d'urgence devenir un
   état permanent que personne ne se rappelle avoir choisi.

3. **La coupure prime sur tous les bypass.** `FeatureChecker` la teste **avant** le bypass
   plateforme-admin et avant le bypass dev (ADR-004). Une coupure existe pour empêcher des écritures ;
   le personnel écrit les mêmes données par les mêmes endpoints. Vérifié par test et en conditions
   réelles : un token ADMIN reçoit 503 comme tout le monde.

4. **503, pas 403.** Un 403 dit « pas pour vous » — l'éleveur n'a rien à attendre. Un 503 dit « pas
   maintenant » : son abonnement est intact, la fonctionnalité revient, et un réessai plus tard est
   le bon comportement plutôt qu'un appel au support. Vérifié empiriquement : une
   `ServiceUnavailableException` levée depuis le SpEL `@PreAuthorize` remonte telle quelle et sort en
   RFC 7807 avec sa raison — aucun dé-enveloppage nécessaire.

5. **Deux points de contrôle, pas un.** `FeatureChecker` couvre les endpoints annotés ;
   `SubscriptionFacadeImpl.isModuleEnabled` couvre les appelants directs (reporting, alertes santé,
   **cascade D18**). Ne brancher que le premier aurait laissé tourner exactement les écritures
   cross-contexte qu'on veut le plus pouvoir arrêter.

6. **Cache 30 s qui échoue en position ouverte.** La lecture est sur le chemin de chaque requête
   gatée. Une table de flags illisible est traitée comme « rien n'est coupé » : un kill switch qui
   provoque une panne est pire que le bug qu'il devait contenir. Le coût est borné — chaque écriture
   invalide le cache, donc une coupure prend effet immédiatement.

7. **L'expiration est honorée à la lecture.** Le balayage cron (5 min) n'est que du rangement :
   `FeatureFlag.blocking()` cesse d'honorer une coupure échue à la seconde près. Sans cela, une
   coupure survivrait jusqu'à 5 minutes à sa fenêtre — une panne qu'on se serait infligée.

8. **Un port, pas un cross-import.** `FlagChangeRecorder` est déclaré côté gating et implémenté côté
   back-office. Le contexte qui possède les interrupteurs ne dépend pas du contexte qui tient le
   journal, et le balayage — qui agit sans requête ni utilisateur — reste tracé. En corollaire,
   `admin_audit_log.actor_user_id` devient **nullable** : acteur nul = la plateforme elle-même.
   Auparavant l'entrée du balayage aurait échoué et été silencieusement perdue, `AdminAuditService`
   avalant ses erreurs pour ne jamais casser l'action qu'il trace.

9. **Permission `flags:manage` dédiée.** C'est le seul écran de la console où un clic change ce que
   reçoit *toute* la plateforme. Ce n'est pas la même autorité que lire un tableau de bord, et elle
   doit pouvoir être accordée — ou refusée — séparément.

10. **Notification WhatsApp, pas Slack.** C'est le canal que la plateforme parle déjà (outbox Konekt,
    retry, dispatcher) et celui que l'astreinte lit à Dakar. Ajouter Slack aurait été une intégration
    hors périmètre. `ADMIN_ONCALL_PHONE` vide désactive la notification, jamais l'audit.

## Conséquences

- Couper un module prend un clic et se voit partout : 503 côté éleveur, bandeau et compte à rebours
  côté console, message WhatsApp à l'astreinte, entrée d'audit inaltérable.
- Une coupure oubliée se lève seule ; la prolonger est un geste explicite.
- `FeatureFlagRepository` est un nouveau repo JPA : `@MockitoBean` obligatoire dans les six contextes
  DB-less.
- `FLAGS_ENABLED=false` neutralise tout le mécanisme sans toucher au gating par ferme.

## Alternatives écartées

- **Filtre HTTP mappant route → module** pour produire le 503 : aurait exigé une table de préfixes
  d'URL à maintenir à la main, fausse au premier renommage de route.
- **Kill switch par ferme uniquement** (ce qui existait) : ne répond pas à « ce bug touche tout le
  monde ».
- **Table d'historique dédiée** : `admin_audit_log` est déjà append-only et déjà lue par la console.
  Un second journal à garder en phase avec le premier est un journal de moins.
