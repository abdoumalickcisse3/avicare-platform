# ADR 004 — Bypass du feature gating en mode développement

**Date** : 2026-06-08
**Statut** : Accepté (temporaire — à lever en Phase C)
**Auteur** : Abdou Malick Cisse

## Contexte

Pendant la construction des bounded contexts métier (Sprints B2 → C5), tester une
feature en dev impose une friction lourde liée à l'abonnement / feature gating :

1. Signup via wizard 2 étapes (choix d'un bundle obligatoire)
2. Activation de N modules en POST sériels
3. Refresh JWT pour porter les memberships
4. `@features.isEnabled(module.X)` sur chaque endpoint protégé
5. Workflow change-request pour changer de plan

Cette friction est payée **à répétition** à chaque nouvelle feature, alors que la
mécanique d'abonnement n'a pas besoin d'être validée à chaque fois en dev.

Tout le gating converge vers **un point de contrôle unique** :
`FeatureChecker.isEnabled(farmId, moduleKey)` (bean SpEL `@features`), qui délègue à
`SubscriptionFacade` → `SubscriptionService` (présence d'une ligne `subscription_modules`
non expirée — Décisions 14/15).

## Décision

Introduire un **flag de configuration** `avicare.features.gating-enabled` (défaut `true`) :

- `true` (défaut) → comportement de production inchangé, gating appliqué.
- `false` → `FeatureChecker.isEnabled()` court-circuite à `true` : tous les modules sont
  considérés activés. **Réservé au développement.**

Le flag est activé (`false`) uniquement dans `application-dev.yml`.

### Garde-fous (ne jamais exposer le bypass en prod)

1. **Défaut sûr** : `gating-enabled=true`. Tout environnement qui ne l'active pas
   explicitement garde le gating.
2. **Refus de boot en prod** : `FeatureGatingGuard` (un `ApplicationRunner`) lève une
   `IllegalStateException` si `gating-enabled=false` **et** que le profil actif contient
   `prod`. L'application ne démarre pas.
3. **Log d'alarme** : sous tout autre profil, un bandeau WARN est loggé au démarrage.
4. **Observabilité** : l'état est exposé sous `/actuator/info` (`features.gatingEnabled`)
   pour audit par environnement (doc 06 §4).

### Périmètre

Le bypass ne touche **que le feature gating** (`@features`). Le **RBAC / tenancy**
(`@farmAccess`, memberships JWT) reste pleinement appliqué — c'est de la sécurité réelle,
pas de la friction de gating.

### Volet frontend (alignement des deux côtés)

Un flag front `NEXT_PUBLIC_FEATURES_GATING=off` (PR 2) :
- auto-sélectionne un bundle complet et saute l'étape 2 du wizard signup ;
- masque le nudge « Choisir un plan » du `TrialBanner`.

Le code du wizard et de la bannière reste en place — seulement court-circuité par le flag.

## Conséquences

### Positives

- Friction de gating supprimée bout en bout en dev (objectif zéro friction B2→C5).
- Un seul point de vérité backend, modification minimale (pas de refactor).
- Réversibilité totale : retrait de 2 env vars, aucun code à défaire.
- Le gating reste **testé en permanence** (les ITs forcent `gating-enabled=true`).

### Négatives

- Deux flags (back + front) à garder cohérents.
- Risque théorique d'oubli en Phase C → mitigé par le refus de boot en prod + checklist.

## Tests

- `FeatureCheckerTest` : `gating-enabled=false` → `isEnabled` renvoie `true` sans toucher
  la façade (`verifyNoInteractions`) ; `true` → délègue.
- `FeatureGatingGuardTest` : `false` + profil `prod` → refus (exception) ; `false` + `dev`
  → OK ; `true` → no-op.
- `FeatureGatingIT` et `PoultryFlowIT` : forcent `avicare.features.gating-enabled=true` via
  `@DynamicPropertySource` → le vrai gate reste exercé même si un dev a exporté le flag.

## Checklist de réactivation Phase C

- [ ] Retirer `avicare.features.gating-enabled: false` de `application-dev.yml` (et de tout
      env staging).
- [ ] Retirer `NEXT_PUBLIC_FEATURES_GATING=off` des environnements front.
- [ ] Vérifier `/actuator/info` → `features.gatingEnabled=true` sur chaque environnement.
- [ ] Confirmer `FeatureGatingGuardTest` (prod refuse le bypass) toujours vert.
- [ ] Re-run manuel : endpoint poultry sans module activé → **403** attendu.

## Alternatives écartées

- **Bean `@Profile("dev")` qui bypass** : `dev` étant le profil par défaut, un déploiement
  sans `SPRING_PROFILES_ACTIVE=prod` exposerait le bypass silencieusement. Bypass implicite
  (lié au profil) au lieu d'explicite, loggé et fail-fast.
- **Claim JWT `dev_god_mode`** : touche le minting de tokens (sécurité-critique), peut fuiter
  dans des tokens prod, mélange gating et identité.

## Référence

- `FeatureChecker`, `FeaturesProperties`, `FeatureGatingGuard`, `FeaturesInfoContributor`
  (package `com.avicare.subscription.access`)
- Décisions 14/15 — `docs/00-vision-strategique.md`
- doc 06 §3 (paramétrage) et §4 (observabilité)
