# Ouvrir la porte — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre la V1 recevable pour une ferme qui arrive seule, d'un autre pays d'Afrique de l'Ouest, avec un téléphone Android — sans dépenser un centime et sans que le porteur du projet soit au milieu du passage.

**Architecture:** Quatre sujets indépendants, quatre PR. (1) La gratuité devient bornée : un ADR écrit le déclencheur de la décision de prix, la landing dit « pendant la phase pilote ». (2) L'inscription prévient l'astreinte par WhatsApp, via le patron de couture `identity/spi` → `admin` déjà en place pour les connexions staff. (3) La ferme gagne un pays, dont découlent son fuseau et le libellé de son champ fiscal, la donnée de référence vivant dans `catalog_items` et le libellé étant résolu à la lecture comme l'est déjà celui d'une ligne de stock. (4) Android est distribué en APK direct, pas par le Play Store.

**Tech Stack:** Spring Boot 4 / Java 21 / Flyway / PostgreSQL ; Next.js 16 + MUI + RTK Query ; Expo React Native ; Astro pour la landing ; EAS pour les builds mobiles.

**Spec:** `docs/superpowers/specs/2026-10-29-ouvrir-la-porte-design.md`

## Global Constraints

- **1 PR = 1 sujet.** PR1 = tâche 1 (la tâche 2 s'est révélée sans objet) ; PR2 = tâche 3 ; PR3 = tâches 4-6 ; PR4 = tâche 7.
- Migration Flyway numérotée **à l'ordre de fusion** (`V67` si rien n'est fusionné entre-temps) ; aucune migration déjà fusionnée n'est modifiée.
- Périmètre pays = les huit de la zone XOF : `SN`, `CI`, `BJ`, `BF`, `ML`, `TG`, `NE`, `GW`. Les autres restent hors sujet (question de devise).
- Fuseaux : `SN→Africa/Dakar`, `CI→Africa/Abidjan`, `BF→Africa/Ouagadougou`, `ML→Africa/Bamako`, `TG→Africa/Lome`, `GW→Africa/Bissau` (UTC+0) ; `BJ→Africa/Porto-Novo`, `NE→Africa/Niamey` (UTC+1).
- Libellé fiscal : `NINEA` au Sénégal, `N° contribuable` pour les sept autres.
- Aucune valeur métier en dur : la table des pays est du **catalogue** (`catalog_items`, catégorie `countries`), pas une constante Java.
- `country` est **optionnel** sur le fil : une app iOS déjà installée ne l'envoie pas.
- Le nom de colonne `ninea` ne change pas.
- Portes : backend `cd backend && ./mvnw clean verify` ; web `npx tsc --noEmit` **et** `npx vitest run` ; mobile `npx tsc --noEmit` **et** `npx jest`. Testcontainers ne tourne pas sur cette machine — la CI tranche (ADR-003).
- La **landing n'est pas construite par la CI des PR** : `cd landing && npm run build` en local avant de fusionner toute PR qui y touche.
- Un nouveau dépôt JPA injecté dans un service déjà présent dans les contextes de test sans DB doit être ajouté en `@MockitoBean` aux six contextes (ancre : `FarmRepository`). Ce plan n'en ajoute aucun — vérifier quand même si un service change de constructeur.
- Commits : Conventional Commits, scope par contexte (`feat(backend:identity)`, `feat(backend:tenancy)`, `feat(web)`, `feat(mobile)`, `chore(landing)`, `docs`).

## Review Focus

Cinq conditions que la spec implique et qu'aucun chemin heureux n'exerce. Chaque ligne a son test, posé dans la tâche qui détient le code.

1. **L'alerte échoue ou le numéro d'astreinte est vide** → l'inscription doit réussir et renvoyer ses jetons (tâche 3).
2. **Une requête de création de ferme sans `country`** (ancienne app iOS) → ferme créée, `country = 'SN'`, aucun 400 (tâche 4).
3. **Un pays absent du catalogue** (`FR` déduit d'un numéro français) → pas d'exception, fuseau et libellé de repli (tâche 4).
4. **Une ferme sénégalaise existante relue après migration** → `taxIdLabel = "NINEA"`, facture inchangée (tâches 4, 5, 6).
5. **`PUBLIC_ANDROID_APK_URL` non posée** → aucun lien émis, aucune pastille Android, et la phrase « Bientôt sur l'App Store et Google Play » reste cohérente (tâche 7).

---

## PR 1 — La gratuité reçoit un déclencheur

### Task 1: ADR-019 — le déclencheur de la décision de prix

**Files:**
- Create: `docs/decisions/019-declencheur-decision-prix.md`
- Modify: `docs/decisions/009-remove-self-serve-subscription.md` (un renvoi vers 019)
- Modify: `docs/00-vision-strategique.md` (§7, une ligne de renvoi)

- [ ] **Step 1: Écrire l'ADR**

Suivre la forme des ADR existants (contexte / décision / conséquences / alternatives écartées). Contenu à fixer :
- la gratuité reste **sans date de fin**, et c'est volontaire : un prix posé en phase pilote est un prix inventé ;
- le **déclencheur** qui oblige à rouvrir le sujet : **la 10ᵉ ferme ayant au moins une saisie dans les 30 derniers jours** ;
- pourquoi ce seuil : c'est là que l'accompagnement personnel d'un solo dev cesse de tenir ;
- **où se lisent les deux chiffres, aujourd'hui, sans rien construire** : le compteur de fermes actives de `AdminMetricsService` et `WhatsAppLedger.Usage.byFarm` (posé par `V45__whatsapp_outbox_accounting.sql` pour exactement cette question) ;
- alternative écartée : fixer un prix maintenant ; alternative écartée : un seuil de temps (« dans six mois »), qui ne mesure rien.

- [ ] **Step 2: Renvoyer depuis ADR-009 et depuis le doc 00 §7**

Une ligne dans chacun, pas un copier-coller du contenu.

- [ ] **Step 3: Commit**

```bash
git add docs/decisions/019-declencheur-decision-prix.md docs/decisions/009-remove-self-serve-subscription.md docs/00-vision-strategique.md
git commit -m "docs(decisions): écrire le déclencheur de la décision de prix (ADR-019)"
```

### Task 2: La landing borne la gratuité — **VÉRIFIÉ LE 2026-10-29 : RIEN À FAIRE**

Relevé avant d'écrire la moindre ligne : `grep -rniE "gratuit" landing/src` donne 20 occurrences, et
**chaque page qui revendique la gratuité en donne déjà la borne** — « Gratuit pendant le pilote »
(`Hero.astro:29`, `index.astro:24`), « Gratuit pendant la phase pilote » (`index.astro:53`),
« Rejoignez le pilote gratuit » (`partenaires.astro:124`, `index.astro:157`), et la page `/tarifs`
en porte quatre. Les seules occurrences sans borne sont le **libellé de bouton** « Commencer
gratuitement » — un libellé n'est pas une promesse de durée, et sur chaque page qui le porte la
borne est énoncée à côté. Les trois pages sans borne (`confidentialite`, `mentions-legales`,
`contact`) ne revendiquent **aucune** gratuité.

L'anti-objectif « écrire *gratuit* sans borne quelque part où un futur client le lira » est donc
**déjà tenu** sur la landing. La tâche disparaît, et la PR 1 se réduit à l'ADR.

Ce qui reste utile, déplacé au chantier B (tâche 3) : la **page d'inscription web** ne dit rien de
la gratuité (`grep` sur `web/src/app/(auth)/signup/page.tsx` : aucune mention). Elle devient la
porte publique — c'est là qu'une ligne « Gratuit pendant la phase pilote » a un lecteur.

- [ ] **Step 1: Ouvrir la PR 1 (ADR seul), attendre les checks verts, fusionner en rebase**

```bash
gh pr create --title "docs(decisions): écrire le déclencheur de la décision de prix (ADR-019)" --body "..."
gh pr checks --watch && gh pr merge --rebase --delete-branch
```

---

## PR 2 — L'inscription prévient l'astreinte

### Task 3: Alerte WhatsApp à l'inscription

**Files:**
- Create: `backend/avicare-app/src/main/java/com/avicare/identity/spi/SignupAlerter.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/identity/spi/NoSignupAlerter.java`
- Create: `backend/avicare-app/src/main/java/com/avicare/admin/audit/SignupAlerterImpl.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/identity/service/AuthService.java` (injection + appel dans `signup`)
- Modify: `web/src/app/(auth)/signup/page.tsx` (une ligne « Gratuit pendant la phase pilote » — la page devient la porte publique et n'en dit rien aujourd'hui)
- Test: `backend/avicare-app/src/test/java/com/avicare/identity/service/AuthServiceTest.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/admin/audit/SignupAlerterImplTest.java` (créer)

**Interfaces:**
- Consumes: `AdminAuditService.record(Long actorUserId, String action, String targetType, Long targetId, Long tenantId, Map<String,Object> metadata)` ; `WhatsAppOutboxFacade.enqueue(String rawPhone, String message)` (contrat : ne lève jamais) ; `${avicare.admin.oncall-phone:}`.
- Produces: `SignupAlerter.accountCreated(Long userId, String fullName, String email, String phone)` — « Must never throw », comme `StaffLoginAuditor`.

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `AuthServiceTest` :

```java
@Test
void signup_alerte_le_staff_du_nouveau_compte() {
  // given un dépôt qui renvoie l'utilisateur sauvé avec id=7
  authService.signup(new SignupRequest("a@b.c", "motdepasse", "Awa Diop", "+2250102030405"));
  verify(signupAlerter).accountCreated(7L, "Awa Diop", "a@b.c", "+2250102030405");
}

@Test
void signup_reussit_meme_si_l_alerte_echoue() {
  doThrow(new RuntimeException("konekt down"))
      .when(signupAlerter).accountCreated(anyLong(), any(), any(), any());
  assertThat(authService.signup(/* même requête */)).isNotNull();
}
```

Dans `SignupAlerterImplTest` :

```java
@Test
void ecrit_au_journal_d_audit_et_met_en_file_un_whatsapp() {
  // oncallPhone = "+221770000000"
  alerter.accountCreated(7L, "Awa Diop", "a@b.c", "+2250102030405");
  verify(auditService).record(eq(7L), eq("signup.created"), eq("User"), eq(7L), isNull(), anyMap());
  verify(whatsApp).enqueue(eq("+221770000000"), contains("Awa Diop"));
}

@Test
void ne_met_rien_en_file_sans_numero_d_astreinte() {
  // oncallPhone = ""
  alerter.accountCreated(7L, "Awa Diop", "a@b.c", "+2250102030405");
  verifyNoInteractions(whatsApp);
  verify(auditService).record(anyLong(), any(), any(), any(), any(), anyMap());
}
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `cd backend && ./mvnw -pl avicare-app test -Dtest='AuthServiceTest,SignupAlerterImplTest'`
Expected: échec de compilation — `SignupAlerter` n'existe pas.

- [ ] **Step 3: Écrire la couture et son repli**

`SignupAlerter` dans `identity/spi/`, une seule méthode, javadoc disant qu'elle ne doit jamais lever. `NoSignupAlerter` : `@Configuration` + `@Bean @ConditionalOnMissingBean(SignupAlerter.class)` renvoyant une lambda vide — **sans ce repli les contextes de test sans DB ne démarrent plus**.

- [ ] **Step 4: Écrire l'implémentation admin**

`SignupAlerterImpl` : `@Component @RequiredArgsConstructor`, dépend de `AdminAuditService` et `WhatsAppOutboxFacade`, lit `@Value("${avicare.admin.oncall-phone:}")`. Journalise `signup.created` ; met en file un message sobre portant nom, e-mail et numéro en E.164 — son indicatif dit le pays, donc aucun champ pays n'est nécessaire. Numéro d'astreinte vide : journaliser un `warn` et ne rien mettre en file, comme le fait `AdminIntegrityAlerter`.

- [ ] **Step 5: Brancher dans `AuthService.signup`**

Injecter `SignupAlerter`, appeler `accountCreated(...)` après `issueTokens`… non : après `loginAttempts.accountCreated(...)` et **avant** le `return`, dans un `try/catch (RuntimeException)` qui journalise et continue. Le contrat dit « ne lève jamais » ; le `try` est la ceinture, parce que l'anti-objectif n°2 interdit qu'une alerte fasse échouer une inscription.

- [ ] **Step 6: Lancer les tests**

Run: `cd backend && ./mvnw -pl avicare-app test -Dtest='AuthServiceTest,SignupAlerterImplTest'`
Expected: PASS

- [ ] **Step 7: Vérification complète**

Run: `cd backend && ./mvnw clean verify`
Expected: SUCCESS (dont les six contextes de test sans DB)

- [ ] **Step 8: Commit, PR 2, fusion**

```bash
git add backend/avicare-app/src/main/java/com/avicare/identity/spi backend/avicare-app/src/main/java/com/avicare/admin/audit/SignupAlerterImpl.java backend/avicare-app/src/main/java/com/avicare/identity/service/AuthService.java backend/avicare-app/src/test/java/com/avicare
git commit -m "feat(backend:identity): prévenir l'astreinte par WhatsApp à chaque inscription"
```

- [ ] **Step 9: Poser la Variable de dépôt (action du porteur du projet, pas du code)**

`PUBLIC_APP_SIGNUP_URL=https://app.jawdi.app/signup` dans les Variables du dépôt, puis redéploiement de la landing. À **confirmer avec lui** avant de l'exécuter : c'est le geste qui ouvre réellement la porte au public, et le même geste la referme.

---

## PR 3 — Le pays de la ferme

### Task 4: Pays côté backend — colonne, catalogue, fuseau, libellé

**Files:**
- Create: `backend/avicare-app/src/main/resources/db/migration/V67__farms_country.sql`
- Modify: `backend/avicare-app/src/main/java/com/avicare/tenancy/domain/Farm.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/tenancy/dto/request/CreateFarmRequest.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/tenancy/dto/request/UpdateFarmRequest.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/tenancy/dto/response/FarmResponse.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/tenancy/mapper/TenancyMapper.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/tenancy/service/FarmService.java` (`create`, `update`, `respond`)
- Test: `backend/avicare-app/src/test/java/com/avicare/tenancy/service/FarmServiceTest.java`

**Interfaces:**
- Consumes: `ParametersFacade.resolve(Long userId, Long farmId, String category, String key)` → `Optional<Map<String,Object>>` ; `FarmService` l'injecte déjà.
- Produces: `FarmResponse` gagne `String country` et `String taxIdLabel` ; `CreateFarmRequest` **et** `UpdateFarmRequest` gagnent `String country` (optionnel, `@Size(max = 2)`).
- **Piège du PUT de remplacement** : `UpdateFarmRequest` efface les champs omis (c'est écrit pour `ninea`). `country` étant `NOT NULL`, son `null` vaut **« ne pas changer »**, comme `productionFocus` — et la javadoc du champ doit le dire, sinon un client qui l'omet ramène la ferme au Sénégal.

- [ ] **Step 1: Écrire la migration**

`V67__farms_country.sql` : `ALTER TABLE farms ADD COLUMN country VARCHAR(2) NOT NULL DEFAULT 'SN'` + `CHECK (country ~ '^[A-Z]{2}$')`, puis les huit `INSERT` de `catalog_items` (`category = 'countries'`, `key` = ISO-2, `value` JSONB `{"name":…,"timezone":…,"tax_id_label":…}`) avec les valeurs exactes des Global Constraints. Un commentaire en tête dit pourquoi ce n'est pas un enum : la liste est de la donnée de référence, un pays de plus doit être une ligne de catalogue et non une migration.

- [ ] **Step 2: Écrire les tests qui échouent**

```java
@Test
void create_sans_pays_reste_au_senegal() {
  FarmResponse r = farmService.create(1L, requestSansPays());
  assertThat(r.country()).isEqualTo("SN");
  assertThat(r.taxIdLabel()).isEqualTo("NINEA");
}

@Test
void create_avec_CI_prend_le_fuseau_et_le_libelle_ivoiriens() {
  FarmResponse r = farmService.create(1L, requestAvecPays("CI"));
  assertThat(r.country()).isEqualTo("CI");
  assertThat(savedFarm().getTimezone()).isEqualTo("Africa/Abidjan");
  assertThat(r.taxIdLabel()).isEqualTo("N° contribuable");
}

@Test
void un_fuseau_explicite_gagne_sur_celui_du_pays() { /* timezone="Europe/Paris" + country="CI" */ }

@Test
void un_pays_absent_du_catalogue_ne_leve_pas() {
  // ParametersFacade.resolve renvoie Optional.empty() pour "FR"
  FarmResponse r = farmService.create(1L, requestAvecPays("FR"));
  assertThat(savedFarm().getTimezone()).isEqualTo("Africa/Dakar");
  assertThat(r.taxIdLabel()).isEqualTo("NINEA");
}
```

- [ ] **Step 3: Lancer les tests pour vérifier qu'ils échouent**

Run: `cd backend && ./mvnw -pl avicare-app test -Dtest=FarmServiceTest`
Expected: échec de compilation.

- [ ] **Step 4: Implémenter**

`Farm.country` (`@Column(nullable = false)`, défaut applicatif `"SN"`). Dans `FarmService` : une méthode privée qui lit le catalogue `countries` pour un code et renvoie fuseau + libellé, avec repli `Africa/Dakar` / `NINEA` quand la clé est absente. `create` pose le pays, puis le fuseau **seulement si la requête n'en porte pas** (l'explicite gagne). `respond` ajoute `country` et `taxIdLabel`. `update` accepte un changement de pays (`null` = inchangé) sans retoucher au fuseau déjà choisi.

**Attention au défaut en Java.** `Farm.java` initialise `private String timezone = "Africa/Dakar";` dans le champ : le défaut SQL n'est **jamais** atteint, et un fuseau déduit du pays serait écrasé si on se contente de la migration. Retirer cette valeur du champ (ou la poser explicitement depuis le pays) fait partie de cette étape — sans quoi la tâche passe ses tests unitaires et ne change rien en production.

- [ ] **Step 5: Lancer les tests**

Run: `cd backend && ./mvnw -pl avicare-app test -Dtest=FarmServiceTest`
Expected: PASS

- [ ] **Step 6: Vérification complète**

Run: `cd backend && ./mvnw clean verify`
Expected: SUCCESS

- [ ] **Step 7: Commit**

```bash
git add backend/avicare-app/src/main/resources/db/migration/V67__farms_country.sql backend/avicare-app/src/main/java/com/avicare/tenancy backend/avicare-app/src/test/java/com/avicare/tenancy
git commit -m "feat(backend:tenancy): donner un pays à la ferme, et en déduire fuseau et libellé fiscal"
```

### Task 5: Pays côté web

**Files:**
- Modify: `web/src/types/index.ts` (`Farm` gagne `country`, `taxIdLabel`)
- Modify: `web/src/app/(auth)/signup/page.tsx` (déduire le pays du téléphone, l'envoyer à `createFarm`)
- Modify: `web/src/components/settings/FarmIdentityCard.tsx` (sélecteur de pays + libellé dynamique)
- Modify: `web/src/components/commercial/InvoicePdfDocument.tsx` (libellé dynamique)
- Modify: `web/src/components/farms/CreateFarmDialog.tsx` (sélecteur de pays)
- Modify: `web/src/components/onboarding/steps/FarmStep.tsx` (sélecteur de pays — c'est le vrai moment où l'éleveur décrit sa ferme)
- Modify: `web/src/store/api/farmsApi.ts` si le type de la requête y est déclaré
- Test: les fichiers `.test.tsx` voisins de chacun

**Interfaces:**
- Consumes: `splitE164(value)` de `web/src/lib/phone/countries.ts` → `{ country, local }` ; `FarmResponse.taxIdLabel` de la tâche 4.

- [ ] **Step 1: Écrire les tests qui échouent**

- `signup/page.test.tsx` : une inscription avec un numéro ivoirien appelle `createFarm` avec `country: "CI"`.
- `FarmIdentityCard.test.tsx` : une ferme dont `taxIdLabel` vaut `"N° contribuable"` rend ce libellé ; une ferme sans `taxIdLabel` rend `"NINEA"` ; **changer le pays dans ce formulaire l'envoie** (sinon une ferme reste prisonnière du pays déduit à l'inscription — y compris les deux fermes pilotes, bloquées sur `SN`).
- `FarmStep.test.tsx` : le pays choisi part dans `updateFarm`, et le formulaire se préremplit sur le pays actuel de la ferme.
- `InvoicePdfDocument` : même paire d'assertions sur la ligne légale.

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `cd web && npx vitest run src/app/\(auth\)/signup src/components/settings/FarmIdentityCard.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implémenter**

Le sélecteur de pays réutilise `COUNTRIES` déjà importé par `PhoneField`, filtré sur les huit codes XOF. Le libellé affiché est toujours `farm.taxIdLabel ?? "NINEA"` — aucun écran ne reconstruit la table des pays.

- [ ] **Step 4: Portes web**

Run: `cd web && npx tsc --noEmit && npx vitest run`
Expected: PASS des deux (le `tsc` est une porte à part entière : vitest vert ne le garantit pas)

- [ ] **Step 5: Commit**

```bash
git add web/src
git commit -m "feat(web): choisir le pays de la ferme et afficher son libellé fiscal"
```

### Task 6: Pays côté mobile

**Files:**
- Modify: `mobile/app/(auth)/signup.tsx` (déduire le pays, l'envoyer à `createFarm`)
- Modify: `mobile/src/commerce/invoiceHtml.ts` (libellé dynamique au lieu de `NINEA :` littéral)
- Modify: `mobile/app/(field)/commerce/factures/[id].tsx` (passer le libellé)
- Modify: `mobile/src/components/onboarding/steps/FarmStep.tsx` (sélecteur de pays, parité avec le web)
- Modify: `mobile/app/(field)/fermes.tsx` si l'écran crée ou édite une ferme
- Test: `mobile/src/commerce/__tests__/invoiceHtml.test.ts`, `mobile/app/(auth)/__tests__/` le cas échéant

- [ ] **Step 1: Écrire les tests qui échouent**

`invoiceHtml.test.ts` : un émetteur portant `taxIdLabel: "N° contribuable"` rend `N° contribuable : …` ; sans `taxIdLabel`, rend `NINEA : …`.

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `cd mobile && npx jest src/commerce/__tests__/invoiceHtml.test.ts`
Expected: FAIL

- [ ] **Step 3: Implémenter**

Même règle que le web : `issuer.taxIdLabel ?? 'NINEA'`. Attention au piège connu : ajouter un hook d'API à un composant casse tous les tests qui le rendent — poser le `jest.mock` dans le même commit.

- [ ] **Step 4: Portes mobile**

Run: `cd mobile && npx tsc --noEmit && npx jest`
Expected: PASS des deux

- [ ] **Step 5: Commit, PR 3, fusion**

```bash
git add mobile
git commit -m "feat(mobile): afficher le libellé fiscal du pays de la ferme"
gh pr create --title "feat: donner un pays à la ferme (fuseau + libellé fiscal)" --body "..."
gh pr checks --watch && gh pr merge --rebase --delete-branch
```

---

## PR 4 — Android en APK

### Task 7: Un APK installable, annoncé honnêtement

**Files:**
- Modify: `mobile/eas.json` (profil produisant un APK visant la production)
- Modify: `landing/src/components/StoreLinks.astro` (troisième pastille, conditionnelle)
- Modify: `landing/Dockerfile`, `landing/.env.example`, `.github/workflows/deploy.yml` (`PUBLIC_ANDROID_APK_URL`)
- Modify: `landing/src/pages/app.astro` (encart « source inconnue »), `landing/src/components/AppSection.astro` et `landing/src/pages/jawdi-ia.astro` (la phrase « Bientôt… » doit rester vraie)
- Test: `cd landing && npm run build`

- [ ] **Step 1: Ajouter le profil de build Android**

Un profil produisant un **APK** (`android.buildType: "apk"`) et portant `EXPO_PUBLIC_API_URL=https://app.jawdi.app`. Choix laissé : étendre `preview` ou créer un profil dédié — ce qui compte est qu'un AAB ne soit jamais produit, il ne sert qu'au Play Store.

- [ ] **Step 2: Fixer et sauvegarder la clé de signature**

Android n'a jamais été construit : **aucun keystore n'existe** pour `app.jawdi.mobile`. Laisser EAS le générer et le garder (`eas credentials`), puis **exporter et sauvegarder** les identifiants hors d'EAS. Conséquence irréversible à écrire dans les notes de release : si cette clé est perdue ou régénérée, un APK suivant **ne s'installera pas par-dessus** le précédent — il faut désinstaller, ce qui efface la base SQLite locale et **la file de synchronisation hors-ligne de l'ouvrier**. C'est le seul risque de ce chantier qui ne se répare pas.

- [ ] **Step 3: Construire l'APK**

Run: `cd mobile && npx eas build --platform android --profile <profil>`
Expected: build réussi, artefact téléchargeable. Noter le numéro de build.

- [ ] **Step 4: Publier l'artefact en asset de Release GitHub**

Run: `gh release create mobile-v<version> <chemin/apk> --title "Jawdi Android <version>" --notes "..."`
Les notes disent les trois contreparties : pas de mise à jour automatique, avertissement « source inconnue » à l'installation, URL de l'API figée à la construction.

- [ ] **Step 5: Câbler la variable et la pastille**

`PUBLIC_ANDROID_APK_URL` suit **exactement** le chemin des deux URL de stores : build-arg du job `landing`, Variable de dépôt, repli vide. `StoreLinks.astro` gagne une pastille Android rendue **seulement** si la variable est posée ; sans elle, aucun lien n'est émis (règle déjà en place). La phrase « Bientôt sur l'App Store et Google Play » devient fausse dès que l'APK existe. `storesLive` est aujourd'hui un booléen (`appStoreUrl || playStoreUrl`) ; il devient un état à **trois** branches — iOS en boutique, Android en APK, Play encore absent — écrit une fois dans `StoreLinks.astro` et consommé par les trois pages, plutôt qu'une phrase retouchée trois fois.

- [ ] **Step 6: Écrire l'encart d'installation**

Sur `/app`, trois ou quatre lignes : ce que l'avertissement Android veut dire, comment l'autoriser, et le fait que l'application ne se mettra pas à jour toute seule.

- [ ] **Step 7: Construire la landing**

Run: `cd landing && npm run build`
Expected: build réussi

- [ ] **Step 8: Vérifier la pastille dans les deux états**

Run: `cd landing && PUBLIC_ANDROID_APK_URL= npm run build` puis `cd landing && PUBLIC_ANDROID_APK_URL=https://example.test/jawdi.apk npm run build`
Expected: sans variable, aucune occurrence de pastille Android dans `dist/` ; avec, un `<a href>` vers l'URL.

- [ ] **Step 9: Commit, PR 4, fusion**

```bash
git add mobile/eas.json landing .github/workflows/deploy.yml
git commit -m "feat(mobile): distribuer Android en APK direct, et l'annoncer sur la landing"
gh pr create --title "feat: distribuer l'application Android en APK" --body "..."
gh pr checks --watch && gh pr merge --rebase --delete-branch
```

- [ ] **Step 10: Poser la Variable `PUBLIC_ANDROID_APK_URL` et redéployer (action du porteur du projet)**

À confirmer avec lui : c'est ce geste qui rend le téléchargement public.

---

## Ce qui reste hors de ce plan

- Publier sur le Google Play Store (25 $ une fois).
- Les mises à jour automatiques de l'APK (`expo-updates` n'est pas dans le projet).
- Les pays hors zone XOF, qui posent une question de devise.
- **Les notifications push sur Android.** Expo Push exige une clé de service FCM déposée sur EAS ; sans elle `obtainPushToken.ts` avale l'erreur et l'ouvrier Android n'enregistre aucun appareil, **silencieusement**. Dégradation assumée : le rail d'alerte principal de ce produit est WhatsApp, pas le push. À écrire dans les notes de release, et à reprendre dans un chantier séparé.
- Une alerte sur la **première saisie réelle** d'une nouvelle ferme (« celle-là est vraie ») : utile, mais c'est un scan de notification, pas une couture d'inscription.
