# ADR 008 — Livestock comme super-context pour le pivot JPA JOINED (V1)

**Date** : 2026-06-15
**Statut** : Accepté
**Auteur** : Abdou Malick Cisse

## Contexte

Deux documents fondateurs entrent en tension directe :

- **Doc 00 §5 (Décision D5, verrouillée)** impose `ProductionUnit` comme pivot
  multi-espèces via **héritage JPA `@Inheritance(JOINED)`**. Les unités concrètes
  par espèce (V1 : `PoultryBatch`) **étendent** `ProductionUnit` :
  `class PoultryBatch extends ProductionUnit`. Hibernate JOINED **exige
  techniquement** cette relation d'héritage Java (`extends` la classe `@Entity`
  parente). Les espèces V2/V3 (`SmallRuminantAnimal`, `CattleAnimal`) feront de
  même.
- **Doc 03 §5 (architecture Spring Boot, STRICT)** interdit l'**import d'une
  `@Entity` d'un autre bounded context**.

Si `poultry`, `health`, `inventory`, `layer` étaient des **contextes racine
autonomes** (`com.avicare.poultry`, etc.), alors `poultry.PoultryBatch extends
livestock.ProductionUnit` constituerait un import + héritage d'`@Entity`
cross-context → **violation directe de doc 03 §5**, et Hibernate JOINED n'offre
aucun contournement. Les deux docs ne peuvent donc **pas** être satisfaits
littéralement en même temps.

Constat dans le code : il n'existe que **5 contextes racine** (`identity`,
`tenancy`, `subscription`, `parameters`, `livestock`). Tout le Phase B
(`poultry`, `health`, `inventory`, `layer`) vit déjà comme **sous-package de
`livestock`**, partageant un unique `livestock/domain` (≈ 32 entités).

## Décision

`livestock` est acté comme **super-context** du métier élevage. **D5 prime sur la
structure §3 de doc 03** (l'héritage JOINED impose un contexte de persistance
unique).

- `livestock` contient les **sous-domaines** : `poultry` (B1), `layer` (B2),
  `health` (B3), `inventory` (B4), puis `commercial` (B5) et `finance` (B6).
- Tous les sous-domaines partagent le bin JPA `livestock.domain.*` et les
  packages transverses `livestock.{repository,controller,service}`.
- **Communication intra-`livestock`** = appels de services directs autorisés
  (ex. `StockConsumptionService` orchestre le couplage daily-record / vaccination
  / treatment ↔ stock — cf. D18). Pas d'obligation de façade entre sous-domaines.
- **Communication vers les contextes racine** (`subscription`, `parameters`,
  `tenancy`) = **uniquement via leurs façades publiques** (`SubscriptionFacade`,
  `ParametersFacade`, `TenancyFacade`). Cette règle reste stricte.

## Justification

- **D5 est verrouillée** et structurante : le pivot `ProductionUnit` JOINED est
  ce qui rend l'ajout d'espèces (V2 ovins/caprins, V3 bovins) non-intrusif pour
  le code transverse (`health`, `inventory`…).
- **Contrainte technique non négociable** : Hibernate JOINED ⇒ `extends` ⇒
  même unité de persistance ⇒ même contexte.
- Doc 03 §5 **reste pleinement valable entre contextes racine** ; seule la
  frontière interne au métier élevage est assouplie, et de façon documentée.

## Conséquences

- ✅ D5 préservée (multi-espèces extensible V2/V3) et Hibernate JOINED
  fonctionnel.
- ✅ Doc 03 §5 conserve sa force pour les contextes racine.
- 🟡 `livestock` devient un gros contexte (≈ 32 fichiers `domain`). Accepté.
- 🟡 Doc 03 est **nuancée explicitement** (§3 contextes racine vs super-context,
  §4.6/4.7/4.8 reclassés en sous-domaines, §5 règle d'imports raffinée).

## Alternatives rejetées

- **Extraire `poultry`/`health`/`inventory` en contextes autonomes** :
  impossible techniquement (Hibernate JOINED nécessite `extends` la classe
  parente, donc l'import de l'`@Entity` `ProductionUnit`).
- **Renoncer à JPA JOINED** (table unique, ou composition par id) : casse D5
  (verrouillée) et toute la stratégie multi-espèces V2/V3.

## Liens

- Doc 00 §5 (D5), doc 03 §3/§4/§5 (nuancées par cette ADR).
- Sprint B4 (inventory) — `StockConsumptionService` (orchestrateur intra-livestock, D18).
- Contradiction soulevée puis arbitrée en discussion produit, formalisée à la
  clôture du Sprint B4 (tag `v0.9.0-inventory`).
