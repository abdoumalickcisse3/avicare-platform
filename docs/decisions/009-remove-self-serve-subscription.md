# ADR 009 — Retrait du self-serve d'abonnement (pilote gratuit)

**Date** : 2026-07-14
**Statut** : Accepté
**Auteur** : Abdou Malick Cisse

## Contexte

AviCare V1 (volaille) est fonctionnellement complet mais sans fermes en production. La priorité
est l'adoption et la preuve de ROI, pas la monétisation. Le modèle « modules vendus à la carte »
en self-serve (doc 00 §7, D13-D16) impose une friction inadaptée à la réalité ouest-africaine :
mobile money (pas de carte), trésorerie des éleveurs en dents de scie (cycle chair ~45 j), et une
distribution qui passe par des canaux (coopératives, provendiers, couvoirs, vétos).

## Décision

1. **Pilote gratuit, tous modules actifs.** `SubscriptionService.getOrCreate` provisionne les 12
   modules de vague V1 à la création d'un abonnement (source : catalogue `modules`, `wave == "V1"`).
   Le gating (`@features`) reste **enforced** ; ce sont les fermes complètes qui rendent tout actif.
2. **Retrait du self-serve de l'expérience** (frontend) : page/onglet abonnement, `TrialBanner`,
   étape de choix de plan au signup, `bundles.ts`, mutations de management de `subscriptionApi`.
3. **Mécanisme conservé dormant** (approche lean) : aucun endpoint/service backend supprimé
   (`applyPlan`, plans, change-requests restent injoignables depuis l'UI mais présents), la table
   `subscription_modules` et `FeatureChecker` intacts. **Levier de monétisation future** = restreindre
   le provisioning V1 + réactiver le self-serve.

## Thèse de monétisation (différée, hors code)

- **Primaire : B2B2C canal.** Un partenaire (coopérative / provendier / couvoir) paie ou subventionne
  AviCare pour son réseau d'éleveurs — il porte la relation, la confiance et le rail de paiement.
- **Secondaire : mobile money par cycle** (Wave / Orange Money) pour la ferme semi-industrielle
  indépendante — aligné sur le cash-flow (« payer quand la bande est vendue »).
- **Écartés** : prélèvement mensuel fixe au petit éleveur (friction max) ; tout flux carte bancaire.

## Conséquences

- Zéro friction d'onboarding ; toute la valeur produit est démontrable en pilote.
- On ne collecte pas encore de signal de willingness-to-pay in-app → à valider via le canal.
- Superseded : le **volet friction** d'ADR-004 (bypass dev) — le provisioning complet couvre l'usage
  courant ; le flag `avicare.features.gating-enabled` + le garde-fou prod restent pour le dev.
- Réversible : re-restreindre `provisionV1Modules` et remonter le self-serve rétablit le modèle payant.
