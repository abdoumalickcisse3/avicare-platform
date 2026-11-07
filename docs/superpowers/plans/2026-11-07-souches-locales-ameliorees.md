# Souches locales améliorées — Plan d'exécution

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un éleveur déclare lui-même la souche qui manque (Goliath, Kuroiler, locale améliorée), elle apparaît aussitôt dans le sélecteur de lot, et la plateforme cesse d'afficher un objectif inventé sur une souche rustique.

**Architecture:** Le nom reste libre et saisi par l'éleveur ; le **profil de production** (`broiler_fast`, `broiler_rustic`, `layer_industrial`, `layer_rustic`) est une liste close dont les paramètres vivent dans `catalog_items`. Une nouvelle colonne `breeds.profile` porte le profil, le `code` est calculé **côté serveur** et la déduplication se fait sur `(species, code, profile)` dans l'ensemble visible, en préférant la ligne plateforme. La courbe attendue cesse d'être interpolée par les clients : elle est **servie par le serveur** sur `PoultryBatchResponse`, et vaut liste vide pour un profil rustique — ce qui supprime verdict et référence sans aucune logique conditionnelle dans le web ni le mobile.

**Tech Stack:** Spring Boot 4 / Hibernate 6 / Flyway / Postgres · Next.js 16 + MUI v9 + RTK Query (vitest) · Expo / React Native (jest)

**Spec:** `docs/superpowers/specs/2026-11-07-souches-locales-ameliorees-design.md`

## Global Constraints

- Aucune valeur métier en dur : les paramètres de profil sont des lignes `catalog_items`, catégorie `breed_profiles` (doc 00 §4, règle d'or n°0).
- Web implique mobile : aucune tâche web ne se fusionne sans sa jumelle mobile.
- Pas de cross-import entre bounded contexts : la lecture d'un profil passe par `ParametersFacade`. Cette dépendance ne doit **pas** entrer dans `BreedService` (piège de slice `@DataJpaTest`) — elle vit dans `BreedProfileDefaults`, consommé par le contrôleur.
- Immuabilité Flyway : le numéro de migration est attribué à **l'ordre de fusion**, pas à l'ordre d'écriture. Le plan l'écrit `V<n>` ; le renommer au moment du rebase.
- Le client envoie un **nom**, jamais un code (leçon PR #491 : `slugify` divergeait web/mobile).
- Lombok `@RequiredArgsConstructor` sur les services, DTO en records Java 21, AssertJ dans les tests, Spotless Google Java Format (2 espaces), `@Transactional` sur écriture / `(readOnly = true)` sur lecture.
- Tout nouveau repository JPA doit être ajouté en `@MockitoBean` dans les **six** contextes DB-less — greper l'ancre `FarmRepository` dans les tests, ne jamais se fier au compte. Ce plan n'en crée aucun.
- Commits en Conventional Commits, scope par contexte : `feat(livestock):`, `feat(web):`, `feat(mobile):`.

## Review Focus

Classes d'entrée que la spec implique et qu'aucune tâche n'exercerait sans ces lignes. Chacune a son test ajouté dans la tâche qui possède le code.

1. **Un nom qui se réduit à rien** (`"???"`, `"— —"`) : le code calculé serait vide et la souche inutilisable. Attendu : 422, pas de ligne créée. → Tâche 2.
2. **Un nom déjà utilisé par une *autre* ferme** : la déduplication ne doit jamais renvoyer la souche d'une autre ferme, sinon une ferme hérite du profil d'une inconnue. Attendu : une ligne propre est créée. → Tâche 2.
3. **Un lot dont la souche n'a pas de profil** (lignes non-volaille, `profile` nul) : score et courbe attendue doivent se comporter comme aujourd'hui, sans NPE. → Tâches 4 et 5.
4. **`targetAgeDays` nul, zéro ou négatif** sur un lot : la courbe attendue ne doit ni diviser par zéro ni émettre une suite infinie de points. Attendu : liste vide. → Tâche 5.
5. **Le même nom déclaré ensuite sous un profil de ponte** : la ligne chair existante ne doit pas voir son `type` basculer, sinon les poulets d'Amadou disparaissent du sélecteur de vente. Attendu : deux lignes indépendantes. → Tâche 2.

---

## Structure des fichiers

**Backend — créés**
- `livestock/domain/BreedProfile.java` — l'enum clos, et la dérivation du `type`.
- `livestock/service/BreedCodes.java` — le slug serveur (miroir de `web/src/lib/slug.ts`).
- `livestock/service/BreedWriteService.java` — déclaration d'une souche + déduplication.
- `livestock/service/BreedProfileDefaults.java` — lit `catalog_items/breed_profiles` via `ParametersFacade`.
- `livestock/poultry/GrowthReferenceService.java` — la courbe attendue, publique, profil-consciente.
- `livestock/dto/request/DeclareBreedRequest.java`, `livestock/dto/response/ExpectedWeightPoint.java`.
- `db/migration/V<n>__breed_profiles.sql`.

**Backend — modifiés**
- `BreedController` (POST), `BreedResponse` (+profil, +cibles), `Breed` (+profile), `BreedRepository` (lookup de dédup), `GrowthAnalysisService` (verdict + prévision), `PoultryBatchResponse`/`PoultryBatchController` (+courbe attendue), `AdminCatalogService` (matérialisation).

**Front — modifiés**
- `web/src/components/poultry/charts/GrowthChart.tsx` + `mobile/src/components/charts/GrowthChart.tsx` : consomment la série serveur.
- `web/src/constants/breedDefaults.ts` + jumeau mobile : **supprimés**.
- Écran de déclaration : `web/src/components/settings/BreedDialog.tsx`, `mobile/app/(field)/reglages/souches.tsx`.
- `catalogCategories.ts` (web + mobile) : retrait de l'entrée « Lots ».

---

## Task 1: Migration — profil, unicité, catalogue, seed

**Files:**
- Create: `backend/avicare-app/src/main/resources/db/migration/V<n>__breed_profiles.sql`
- Create: `backend/avicare-app/src/main/java/com/avicare/livestock/domain/BreedProfile.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/domain/Breed.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/livestock/BreedProfileMigrationIT.java`

**Interfaces:**
- Consomme : rien.
- Produit : `BreedProfile` (enum `BROILER_FAST`, `BROILER_RUSTIC`, `LAYER_INDUSTRIAL`, `LAYER_RUSTIC`) avec `String type()` → `"broiler"` pour les deux premiers, `"layer"` pour les deux derniers. `Breed.getProfile() / setProfile(BreedProfile)`.

- [ ] **Step 1: Écrire le test qui échoue**

```java
// BreedProfileMigrationIT (@DataJpaTest + PostgreSQLContainer, patron de LivestockMappingIT)
@Test void les_cinq_souches_semees_portent_un_profil() {
  assertThat(breedRepository.findBySpecies(Species.POULTRY))
      .filteredOn(b -> b.getFarmId() == null)
      .allSatisfy(b -> assertThat(b.getProfile()).isNotNull());
}

@Test void cobb_est_rapide_et_isa_brown_est_industrielle() {
  assertThat(byCode("cobb_500").getProfile()).isEqualTo(BreedProfile.BROILER_FAST);
  assertThat(byCode("isa_brown").getProfile()).isEqualTo(BreedProfile.LAYER_INDUSTRIAL);
}

@Test void goliath_et_kuroiler_sont_au_catalogue_en_chair_rustique() {
  assertThat(byCode("goliath").getProfile()).isEqualTo(BreedProfile.BROILER_RUSTIC);
  assertThat(byCode("kuroiler").getType()).isEqualTo("broiler");
}

@Test void locale_amelioree_existe_en_chair_et_en_ponte_sous_le_meme_code() {
  assertThat(breedRepository.findBySpecies(Species.POULTRY))
      .filteredOn(b -> "locale_amelioree".equals(b.getCode()))
      .extracting(Breed::getProfile)
      .containsExactlyInAnyOrder(BreedProfile.BROILER_RUSTIC, BreedProfile.LAYER_RUSTIC);
}

@Test void les_quatre_profils_sont_parametres_au_catalogue() {
  assertThat(catalogItemRepository.findByCategory("breed_profiles")).hasSize(4);
}
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `cd backend && ./mvnw -pl avicare-app test -Dtest=BreedProfileMigrationIT`
Expected: FAIL — `getProfile()` n'existe pas (compilation).

- [ ] **Step 3: Écrire l'enum `BreedProfile` et la colonne**

`BreedProfile` dans `com.avicare.livestock.domain`, quatre constantes, méthode `public String type()`.
Sur `Breed` : `@Enumerated(EnumType.STRING) @Column(name = "profile") private BreedProfile profile;`

- [ ] **Step 4: Écrire la migration**

Dans cet ordre, un sujet par bloc, en commentant **pourquoi** (convention du dépôt, cf. V67) :

1. `ALTER TABLE breeds ADD COLUMN profile VARCHAR(30)` + `CHECK (profile IS NULL OR profile IN ('BROILER_FAST','BROILER_RUSTIC','LAYER_INDUSTRIAL','LAYER_RUSTIC'))`.
2. Reprise des cinq souches : `cobb_500`/`ross_308` → `BROILER_FAST` ; `isa_brown`/`lohmann_brown`/`hyline_w36` → `LAYER_INDUSTRIAL`.
3. **Remplacer l'unicité.** `UNIQUE (species, code, farm_id)` de V5 ne protège rien au niveau plateforme (`farm_id` nul, et sous Postgres `NULL <> NULL` dans un UNIQUE) et interdit le même nom sous deux profils. La remplacer par un index unique sur l'expression :
   `CREATE UNIQUE INDEX uq_breeds_identity ON breeds (species, code, COALESCE(profile, ''), COALESCE(farm_id, 0))`, après `ALTER TABLE breeds DROP CONSTRAINT` de la contrainte V5 (récupérer son nom généré : `breeds_species_code_farm_id_key`).
4. Catalogue `breed_profiles`, quatre lignes. Les deux profils de chair portent des cibles, les deux de ponte **rien** (spec §7.1) :
   - `broiler_fast` : `{"label":"Chair à croissance rapide","type":"broiler","default_target_weight_g":2100,"default_target_age_days":42,"reference_curve":true}`
   - `broiler_rustic` : `{"label":"Chair rustique (croissance lente)","type":"broiler","default_target_weight_g":2000,"default_target_age_days":90,"reference_curve":false}`
   - `layer_industrial` : `{"label":"Ponte industrielle","type":"layer"}`
   - `layer_rustic` : `{"label":"Ponte rustique (locale améliorée)","type":"layer"}`
   Les cibles rustiques partent des chiffres Kuroiler convergents de la spec §3 (2 kg en 3 mois en intensif, 4–5 mois en semi-extensif) ; la spec laisse leur validation par un éleveur au constructeur.
5. Seed plateforme : `goliath`, `kuroiler`, `sasso`, `poulet_local`, `locale_amelioree` en `BROILER_RUSTIC`, plus `locale_amelioree` en `LAYER_RUSTIC`. `type` dérivé, `farm_id` nul, `catalog_item_id` nul (ces souches ne viennent pas du catalogue `breeds`).

- [ ] **Step 5: Lancer le test pour vérifier qu'il passe**

Run: `cd backend && ./mvnw -pl avicare-app test -Dtest=BreedProfileMigrationIT`
Expected: PASS

- [ ] **Step 6: Mettre à jour l'entité et vérifier le reste du module**

Retirer `@UniqueConstraint` de `@Table` sur `Breed` (l'unicité est désormais un index d'expression, non déclarable en JPA).
Run: `cd backend && ./mvnw -pl avicare-app test -Dtest='*Breed*,*Livestock*,*Poultry*'`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/avicare-app/src/main/resources/db/migration backend/avicare-app/src/main/java/com/avicare/livestock/domain backend/avicare-app/src/test/java/com/avicare/livestock/BreedProfileMigrationIT.java
git commit -m "feat(livestock): donner un profil de production a chaque souche"
```

---

## Task 2: Le slug serveur et la déclaration d'une souche

**Files:**
- Create: `backend/avicare-app/src/main/java/com/avicare/livestock/service/BreedCodes.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/livestock/service/BreedWriteService.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/repository/BreedRepository.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/livestock/BreedWriteServiceIT.java`, `backend/avicare-app/src/test/java/com/avicare/livestock/BreedCodesTest.java`

**Interfaces:**
- Consomme : `BreedProfile` (Tâche 1).
- Produit :
  - `BreedCodes.slugify(String name) -> String` (statique) : minuscules, accents retirés, non-alphanumériques repliés en `_`, tronqué à 100.
  - `BreedWriteService.declare(Long farmId, Species species, String name, BreedProfile profile) -> Breed`.
  - `BreedRepository.findVisibleByCodeAndProfile(Species, String code, BreedProfile, Collection<Long> farmIds) -> List<Breed>`, triée `farmId` nuls d'abord.

- [ ] **Step 1: Écrire les tests qui échouent**

```java
// BreedCodesTest (unitaire, pas de contexte Spring)
@Test void les_accents_et_les_espaces_tombent() {
  assertThat(BreedCodes.slugify("Locale améliorée")).isEqualTo("locale_amelioree");
}
@Test void un_nom_sans_aucune_lettre_donne_une_chaine_vide() {
  assertThat(BreedCodes.slugify("— ??? —")).isEmpty();
}
```

```java
// BreedWriteServiceIT (@DataJpaTest + PostgreSQLContainer + @Import(BreedWriteService.class))
@Test void une_souche_declaree_est_visible_par_la_ferme() { /* declare -> findVisible contient le code */ }

@Test void un_nom_deja_au_catalogue_plateforme_renvoie_la_ligne_plateforme() {
  Breed b = service.declare(farmId, POULTRY, "Goliath", BROILER_RUSTIC);
  assertThat(b.getFarmId()).isNull();
}

@Test void le_meme_nom_sous_deux_profils_donne_deux_souches() {
  Breed chair = service.declare(farmId, POULTRY, "Ma race", BROILER_RUSTIC);
  Breed ponte = service.declare(farmId, POULTRY, "Ma race", LAYER_RUSTIC);
  assertThat(ponte.getId()).isNotEqualTo(chair.getId());
  assertThat(chair.getType()).isEqualTo("broiler");   // Review Focus #5 : inchangé
  assertThat(ponte.getType()).isEqualTo("layer");
}

@Test void une_seconde_declaration_identique_ne_cree_rien() { /* même id deux fois */ }

@Test void un_nom_vide_apres_slug_est_refuse() {
  assertThatThrownBy(() -> service.declare(farmId, POULTRY, "— ??? —", BROILER_RUSTIC))
      .isInstanceOf(ValidationException.class);   // Review Focus #1
}

@Test void la_souche_dune_autre_ferme_nest_jamais_reutilisee() {
  // une souche 'ma_race' existe sur farmB ; declare(farmA, ...) crée une ligne portée par farmA
  assertThat(service.declare(farmA, POULTRY, "Ma race", BROILER_RUSTIC).getFarmId()).isEqualTo(farmA);
}
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `cd backend && ./mvnw -pl avicare-app test -Dtest='BreedCodesTest,BreedWriteServiceIT'`
Expected: FAIL — classes absentes.

- [ ] **Step 3: Implémenter `BreedCodes.slugify`**

Miroir exact de `web/src/lib/slug.ts`, au séparateur près : ce dépôt utilise `_` dans les codes de souche (`cobb_500`), pas `-`. Normaliser en NFD, retirer les diacritiques, minuscules, replier `[^a-z0-9]+` en `_`, élaguer les `_` de bord, tronquer à 100.

- [ ] **Step 4: Implémenter `BreedWriteService.declare`**

`@Service @RequiredArgsConstructor`, `@Transactional`. Séquence : calculer le code ; refuser le code vide (`ValidationException`, message technique en anglais) ; chercher via `findVisibleByCodeAndProfile` dans `{plateforme} ∪ {farmId}` et renvoyer le premier (plateforme d'abord) ; sinon créer avec `farmId`, `type = profile.type()`, `active = true`.

Ajouter la requête au repository :

```java
@Query("select b from Breed b where b.species = :species and b.code = :code"
    + " and b.profile = :profile and (b.farmId is null or b.farmId in :farmIds)"
    + " and b.active = true order by b.farmId nulls first")
List<Breed> findVisibleByCodeAndProfile(...);
```

- [ ] **Step 5: Lancer les tests pour vérifier qu'ils passent**

Run: `cd backend && ./mvnw -pl avicare-app test -Dtest='BreedCodesTest,BreedWriteServiceIT'`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/avicare-app/src/main/java/com/avicare/livestock backend/avicare-app/src/test/java/com/avicare/livestock
git commit -m "feat(livestock): declarer une souche propre a la ferme, sans doublon"
```

---

## Task 3: L'endpoint de déclaration et les cibles sur `BreedResponse`

**Files:**
- Create: `backend/avicare-app/src/main/java/com/avicare/livestock/dto/request/DeclareBreedRequest.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/livestock/service/BreedProfileDefaults.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/controller/BreedController.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/dto/response/BreedResponse.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/livestock/controller/BreedDeclarationIT.java`

**Interfaces:**
- Consomme : `BreedWriteService.declare` (Tâche 2), `ParametersFacade.listPlatform` (existant).
- Produit :
  - `BreedResponse(Long id, Species species, String code, String name, String type, String profile, Integer defaultTargetWeightG, Integer defaultTargetAgeDays, Long farmId, boolean active)`.
  - `BreedProfileDefaults.targetsFor(BreedProfile) -> Optional<Targets>` avec `record Targets(Integer weightG, Integer ageDays)`.
  - `POST /api/v1/farms/{farmId}/breeds`, corps `DeclareBreedRequest(@NotBlank String name, @NotNull BreedProfile profile, Species species)` (`species` par défaut `POULTRY`), réponse 201 `BreedResponse`.

- [ ] **Step 1: Écrire le test qui échoue**

```java
// BreedDeclarationIT (@SpringBootTest + @AutoConfigureMockMvc + Testcontainers, patron de ApiIT :
// onboarder un vrai utilisateur, cf. mémoire « ApiIT non-owner write needs real user »)
@Test void un_owner_declare_une_souche_et_la_retrouve_dans_la_liste() { /* 201 puis GET /api/v1/breeds la contient */ }
@Test void un_farmer_ne_peut_pas_declarer() { /* 403 */ }
@Test void la_reponse_porte_les_cibles_du_profil() {
  // broiler_rustic -> defaultTargetWeightG = 2000, defaultTargetAgeDays = 90
}
@Test void un_profil_de_ponte_ne_porte_aucune_cible() {
  // layer_rustic -> les deux champs nuls
}
@Test void un_nom_vide_apres_slug_repond_422() { }
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `cd backend && ./mvnw -pl avicare-app test -Dtest=BreedDeclarationIT`
Expected: FAIL — route absente (404/405).

- [ ] **Step 3: Implémenter `BreedProfileDefaults`**

`@Service @RequiredArgsConstructor`, lit `parametersFacade.listPlatform("breed_profiles")`, indexe par clé minuscule du profil, extrait `default_target_weight_g` / `default_target_age_days`, `Optional.empty()` quand la ligne ne les porte pas. **Ne pas** injecter `ParametersFacade` dans `BreedService` (contrainte globale : slice `@DataJpaTest`).

- [ ] **Step 4: Implémenter l'endpoint**

Sur `BreedController`, ajouter le `POST` sous `/api/v1/farms/{farmId}/breeds` (classe séparée ou `@RequestMapping` additionnel — au choix du constructeur), gardé par la garde de réglages du dépôt :
`@PreAuthorize("@farmAccess.hasRole(#farmId, T(com.avicare.common.security.principal.FarmRole).OWNER, T(com.avicare.common.security.principal.FarmRole).MANAGER)")`, `@ResponseStatus(CREATED)`.
Enrichir `toResponse` avec le profil et les cibles résolues.

- [ ] **Step 5: Lancer le test pour vérifier qu'il passe**

Run: `cd backend && ./mvnw -pl avicare-app test -Dtest=BreedDeclarationIT`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/avicare-app/src/main/java backend/avicare-app/src/test/java
git commit -m "feat(livestock): exposer la declaration d'une souche et les cibles du profil"
```

---

## Task 4: Aucun verdict, et aucune date, sur une souche rustique

**Files:**
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/poultry/GrowthAnalysisService.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/livestock/poultry/GrowthAnalysisRusticTest.java`

**Interfaces:**
- Consomme : `Breed.getProfile()` (Tâche 1).
- Produit : `computePerformance` laisse `performanceScore` **et** `forecastedTargetDate` nuls quand le profil de la souche du lot est `BROILER_RUSTIC`. Signatures internes : `score(PoultryBatch, BigDecimal, int, BreedProfile)` et `forecast(PoultryBatch, BigDecimal, LocalDate, BreedProfile)`.

- [ ] **Step 1: Écrire le test qui échoue**

```java
// GrowthAnalysisRusticTest — étend le patron de GrowthAnalysisTargetScoreTest (mocks, pas de DB)
@Test void un_lot_rustique_ne_recoit_aucun_verdict() {
  assertThat(perf.getPerformanceScore()).isNull();
}
@Test void un_lot_rustique_ne_recoit_aucune_date_de_livraison_prevue() {
  assertThat(perf.getForecastedTargetDate()).isNull();   // part au portail partenaire via BatchCycleInfo
}
@Test void un_lot_a_croissance_rapide_garde_son_verdict_et_sa_date() { /* ON_TARGET + date non nulle */ }
@Test void une_souche_sans_profil_se_comporte_comme_avant() { /* profile null -> verdict calculé */ }
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `cd backend && ./mvnw -pl avicare-app test -Dtest=GrowthAnalysisRusticTest`
Expected: FAIL — le verdict rustique vaut `BEHIND` ou `ON_TARGET`.

- [ ] **Step 3: Implémenter la garde**

Injecter `BreedRepository` dans `GrowthAnalysisService` (repository existant — aucun nouveau `@MockitoBean` à poser). Dans `computePerformance(PoultryBatch, LocalDate)`, charger le profil via `batch.getBreedId()`, le passer à `score` et `forecast`, qui renvoient `null` d'emblée pour `BROILER_RUSTIC`. Un profil nul ne change rien au comportement actuel (Review Focus #3).

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `cd backend && ./mvnw -pl avicare-app test -Dtest='GrowthAnalysis*,BroilerGrowthCurveTest'`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/avicare-app/src/main/java/com/avicare/livestock/poultry backend/avicare-app/src/test/java/com/avicare/livestock/poultry
git commit -m "fix(livestock): ne rien pretendre savoir de la croissance d'une souche rustique"
```

---

## Task 5: Une seule forme de courbe, servie par le serveur

**Files:**
- Create: `backend/avicare-app/src/main/java/com/avicare/livestock/poultry/GrowthReferenceService.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/livestock/dto/response/ExpectedWeightPoint.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/dto/response/PoultryBatchResponse.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/controller/PoultryBatchController.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/livestock/poultry/GrowthReferenceServiceTest.java`

**Interfaces:**
- Consomme : `BroilerGrowthCurve.weightAt` (package-privé, même paquet), `Breed.getProfile()`.
- Produit :
  - `record ExpectedWeightPoint(int ageDays, int weightG)`.
  - `GrowthReferenceService.expectedCurve(PoultryBatch batch) -> List<ExpectedWeightPoint>`.
  - `PoultryBatchResponse` gagne `List<ExpectedWeightPoint> expectedCurve` (jamais nul, liste vide quand il n'y a rien à dessiner).

*Pourquoi sur `PoultryBatchResponse` et non sur `/performance` : les deux clients y lisent déjà `targetWeightG`/`targetAgeDays` pour tracer leur droite, et cette ressource est disponible même sans aucune pesée — un lot neuf doit pouvoir afficher sa référence.*

- [ ] **Step 1: Écrire le test qui échoue**

```java
// GrowthReferenceServiceTest (unitaire, mocks)
@Test void la_courbe_suit_la_forme_calibree_et_non_une_droite() {
  // cible 2100 g à 42 j : au 7e jour la forme donne ~5,5 % du gain, pas 1/6
  assertThat(pointAt(curve, 7).weightG()).isLessThan(500);
}
@Test void la_courbe_part_du_poussin_et_finit_sur_la_cible() {
  assertThat(curve.get(0).ageDays()).isZero();
  assertThat(curve.get(curve.size() - 1).weightG()).isEqualTo(2100);
}
@Test void un_profil_rustique_ne_donne_aucune_courbe() { assertThat(curve).isEmpty(); }
@Test void une_souche_sans_profil_garde_la_forme_calibree() { assertThat(curve).isNotEmpty(); }   // RF #3
@Test void un_age_cible_nul_ou_negatif_ne_donne_aucune_courbe() { assertThat(curve).isEmpty(); }  // RF #4
@Test void une_cible_absente_ne_donne_aucune_courbe() { assertThat(curve).isEmpty(); }
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `cd backend && ./mvnw -pl avicare-app test -Dtest=GrowthReferenceServiceTest`
Expected: FAIL — classe absente.

- [ ] **Step 3: Implémenter `GrowthReferenceService`**

`@Service @RequiredArgsConstructor` dans `com.avicare.livestock.poultry` (même paquet que `BroilerGrowthCurve`, qui reste package-privé). Échantillonner tous les 7 jours de 0 à `targetAgeDays`, en incluant toujours `targetAgeDays` comme dernier point. Liste vide si : profil `BROILER_RUSTIC`, `targetWeightG` nul, `targetAgeDays` nul ou `<= 0`.

- [ ] **Step 4: Brancher sur la réponse du lot**

Ajouter le champ à `PoultryBatchResponse` et le remplir dans `PoultryBatchController.toResponse`. Garder `targetWeightG`/`targetAgeDays` : ils restent la saisie de l'éleveur, affichée telle quelle.

- [ ] **Step 5: Lancer les tests pour vérifier qu'ils passent**

Run: `cd backend && ./mvnw -pl avicare-app test -Dtest='GrowthReference*,Poultry*'`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/avicare-app/src/main/java backend/avicare-app/src/test/java
git commit -m "feat(livestock): servir la courbe attendue au lieu de la laisser interpoler"
```

---

## Task 6: Web — la courbe du serveur, et l'écran de déclaration

**Files:**
- Modify: `web/src/components/poultry/charts/GrowthChart.tsx` (+ son test)
- Modify: `web/src/components/poultry/BatchOverviewTab.tsx:216-227`
- Delete: `web/src/constants/breedDefaults.ts`
- Modify: `web/src/components/poultry/CreateBatchDialog.tsx` (+ son test), `web/src/store/api/breedsApi.ts`, `web/src/types/index.ts`
- Create: `web/src/components/settings/BreedDialog.tsx` + `web/src/components/settings/BreedDialog.test.tsx`

**Interfaces:**
- Consomme : `BreedResponse` enrichi (Tâche 3), `PoultryBatchResponse.expectedCurve` (Tâche 5).
- Produit : `useDeclareBreedMutation` dans `breedsApi` ; `GrowthChart({ weighings, expectedCurve })` — les props `targetWeightG` / `targetAgeDays` **disparaissent**.

- [ ] **Step 1: Écrire les tests qui échouent**

```tsx
// GrowthChart.test.tsx
it("ne dessine aucune référence quand la courbe attendue est vide", ...)
it("dessine la référence aux points fournis par le serveur, sans interpoler", ...)

// CreateBatchDialog.test.tsx
it("pré-remplit les cibles depuis le profil de la souche choisie", ...)   // 2000 / 90 sur une rustique

// BreedDialog.test.tsx
it("déclare la souche saisie avec le profil choisi", ...)
it("n'envoie aucun code, seulement le nom", ...)
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `cd web && npx vitest run src/components/poultry src/components/settings/BreedDialog.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implémenter**

Supprimer `targetAt()` et le fichier `breedDefaults.ts` ; `CreateBatchDialog` lit `defaultTargetWeightG` / `defaultTargetAgeDays` sur la souche sélectionnée. `BreedDialog` : champ nom + sélecteur des quatre profils, monté dans les Réglages.

- [ ] **Step 4: Lancer les tests et la porte de type**

Run: `cd web && npx vitest run && npx tsc --noEmit`
Expected: PASS les deux. *(La porte `tsc` est obligatoire : vitest vert a déjà laissé passer une rupture de build — cf. mémoire `vitest_mock_calls_tuple_tsc`.)*

- [ ] **Step 5: Commit**

```bash
git add web/src
git commit -m "feat(web): declarer une souche, et tracer la courbe que le serveur donne"
```

---

## Task 7: Mobile — la même chose, à parité

**Files:**
- Modify: `mobile/src/components/charts/GrowthChart.tsx` (+ test), `mobile/app/(field)/lots/[unitId]/index.tsx`
- Delete: `mobile/src/constants/breedDefaults.ts`
- Modify: `mobile/app/(field)/lots/nouveau.tsx:39-58` (+ test), `mobile/src/components/onboarding/CreateLotSheet.tsx` (+ test), `mobile/src/store/api/breedsApi.ts`, `mobile/src/constants/navigation.ts`
- Create: `mobile/app/(field)/reglages/souches.tsx` + `mobile/app/(field)/reglages/__tests__/souches.test.tsx`

**Interfaces:**
- Consomme : identique à la Tâche 6.
- Produit : `GrowthChart({ data, expectedCurve })` — la prop `target` disparaît.

- [ ] **Step 1: Écrire les tests qui échouent**

```tsx
it("ne trace aucun pointillé quand la courbe attendue est vide", ...)
it("pré-remplit 2000 g / 90 j sur une souche rustique", ...)        // remplace le '2000'/'42' en dur
it("déclare une souche et la retrouve dans le sélecteur", ...)
it("l'écran Souches n'est pas accessible à FARMER", ...)            // table navigation.ts, pas un grep router.push
it("la feuille d'inscription envoie les cibles du profil, pas un lot sans cible", ...)
```

*La spec §8 laissait ouvert le cas de `CreateLotSheet.tsx`, qui crée aujourd'hui un lot sans aucune cible — donc sans courbe ni score. Décision de ce plan : lui donner les cibles du profil, parce que le critère de terminé n°1 passe par ce chemin (Amadou déclare sa souche puis crée une bande depuis l'inscription).*

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `cd mobile && npx jest src/components/charts app/\(field\)/reglages`
Expected: FAIL

- [ ] **Step 3: Implémenter**

Le `ref` du SVG se construit à partir de `expectedCurve` (chemin lissé par les points reçus), vide si la liste est vide. Ajouter la ligne « Souches » à `constants/navigation.ts`, gardée par `settings:write`. Ajouter le `jest.mock` du nouvel appel RTK Query **dans le même commit** que le composant qui le monte (piège récurrent : un hook ajouté casse tous les tests qui rendent le composant).

- [ ] **Step 4: Lancer les portes mobiles**

Run: `cd mobile && npx tsc --noEmit && npx jest`
Expected: PASS les deux. *(`render`/`renderHook` sont asynchrones sous RNTL 14 — les attendre.)*

- [ ] **Step 5: Commit**

```bash
git add mobile
git commit -m "feat(mobile): declarer une souche, et tracer la courbe que le serveur donne"
```

---

## Task 8: La console admin matérialise une vraie souche

**Files:**
- Modify: `backend/avicare-app/src/main/java/com/avicare/admin/service/AdminCatalogService.java:47`
- Test: `backend/avicare-app/src/test/java/com/avicare/admin/AdminBreedMaterializationIT.java`

**Interfaces:**
- Consomme : `BreedWriteService` (Tâche 2) — en version plateforme (`farmId` nul).
- Produit : une écriture super-admin sur la catégorie `breeds` crée une souche plateforme sélectionnable, auditée via `AdminAuditService` comme les autres écritures admin.

- [ ] **Step 1: Écrire le test qui échoue**

```java
@Test void une_souche_ajoutee_par_le_super_admin_apparait_dans_le_selecteur() {
  // POST console catalog 'breeds' { key, label, profile } puis GET /api/v1/breeds la contient
}
@Test void lecriture_est_auditee() { }
@Test void une_entree_sans_profil_est_refusee() { }   // sinon on devine, contre l'anti-but n°1
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `cd backend && ./mvnw -pl avicare-app test -Dtest=AdminBreedMaterializationIT`
Expected: FAIL — la ligne de catalogue ne matérialise rien.

- [ ] **Step 3: Implémenter**

Matérialiser côté `breeds` à l'upsert de la catégorie `breeds`. **Repli explicite si cela s'avère trop coûteux** (spec §7.7) : ajouter `"breeds"` à `READ_ONLY_CATEGORIES` et retirer l'entrée de `CatalogEditor.tsx:40` — mais pas de troisième voie, l'écran ne reste pas menteur.

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `cd backend && ./mvnw -pl avicare-app test -Dtest='Admin*,Breed*'`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/avicare-app/src backend/avicare-app/src/test
git commit -m "feat(admin): une souche ajoutee en console devient selectionnable"
```

---

## Task 9: Le gestionnaire « Lots » cesse de mentir

**Files:**
- Modify: `web/src/constants/catalogCategories.ts:22-41` (+ `catalogCategories.test.ts`)
- Modify: `mobile/src/constants/catalogCategories.ts:18`
- Create: `scripts/audit-farm-breed-catalog-entries.sql`

**Interfaces:**
- Consomme : l'écran de déclaration des Tâches 6 et 7, qui le remplace.
- Produit : plus aucune catégorie `breeds` dans le gestionnaire générique.

- [ ] **Step 1: Écrire le test qui échoue**

```ts
it("aucune catégorie du gestionnaire générique n'écrit dans breeds", () => {
  expect(CATALOG_CATEGORIES.map((c) => c.backendCategory)).not.toContain("breeds");
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `cd web && npx vitest run src/constants/catalogCategories.test.ts`
Expected: FAIL

- [ ] **Step 3: Retirer l'entrée des deux côtés**

Supprimer le bloc `slug: "lots"` dans les deux `catalogCategories.ts`, et `'lots'` de l'union de types mobile. Vérifier qu'aucune route `reglages/[category]` ne la référence encore.

- [ ] **Step 4: Relever ce que les pilotes ont déjà tapé**

Écrire la requête d'audit (`farm_catalog_items` où `category = 'breeds'`) et la **jouer en lecture sur la production** avant la fusion, par `ssh deploy@VPS` + `docker exec` avec le SQL en stdin. La migration ne devine aucun profil (spec §7.3) : la sortie sert à prévenir les fermes concernées, pas à écrire.

- [ ] **Step 5: Lancer les portes des deux côtés**

Run: `cd web && npx vitest run && npx tsc --noEmit` puis `cd mobile && npx tsc --noEmit && npx jest`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add web/src mobile/src scripts
git commit -m "fix(web,mobile): retirer l'ecran qui pretendait ajouter une souche"
```

---

## Clôture

- [ ] `cd backend && ./mvnw clean verify` vert (réacteur complet, pas d'incrémental : un merge remet les mtimes à zéro et Maven sert du bytecode périmé).
- [ ] `make backend-run` démarre, `curl localhost:8080/actuator/health` → `{"status":"UP"}`.
- [ ] `gh pr checks` vertes avant toute fusion.
- [ ] Rejouer les six points de la définition de terminé de la spec §9, en particulier le n°2 : déclarer « Locale améliorée » en chair **et** en ponte, puis vérifier que les pondeuses n'apparaissent pas dans le sélecteur de vente de poulets.
