# Design — Ouvrir la porte : distribution, inscription, pays

> Spec de cadrage. Décidée le 2026-10-29 après un brainstorming sur la V2. **La V2 du doc 00
> (« Tabaski Edition », ovins + caprins) est reportée** : le cap retenu est *plus de fermes de
> volaille, sur plusieurs pays d'Afrique de l'Ouest*. Avant d'y aller, on lève les quatre verrous
> qui ferment aujourd'hui la porte de la V1 — ce document ne traite que ces quatre verrous.
>
> Le cinquième point du brainstorming (« garder l'inscription manuelle ? ») est tranché ici et non
> livré comme chantier séparé : il est le cœur du chantier B.

---

## 1. Pourquoi

Deux éleveurs pilotent la plateforme et en sont contents. La demande entrante existe : le
2026-10-24, un éleveur de pondeuses de **Côte d'Ivoire** (1 327 sujets) a écrit pour obtenir
l'application. Elle ne demande pas d'autres espèces — elle demande le produit actuel, ailleurs.

Or rien dans le produit n'est prêt à recevoir cette demande :

- l'application de terrain n'existe que sur iPhone, dans une région où le téléphone de l'ouvrier
  est un Android ;
- l'inscription est fermée : chaque ferme passe par une conversation WhatsApp où le porteur du
  projet crée le compte à la main ;
- la ferme n'a pas de pays : les valeurs par défaut sont sénégalaises ;
- l'accès est gratuit sans que rien ne dise jusqu'à quand, ni ne mesure ce qu'une ferme coûte.

Le but de ce chantier n'est pas d'ajouter une fonctionnalité métier. C'est de rendre **recevable**
une ferme qui arrive seule, d'un autre pays, avec un Android.

## 2. Ce qui existe aujourd'hui (relevé dans le code le 2026-10-29)

**Mobile / Android**
- `mobile/app.json` déclare déjà `android.package = "app.jawdi.mobile"` et les trois icônes
  adaptatives. Android est **configuré pour être construit, et ne l'a jamais été**.
- `mobile/eas.json` n'a **aucun** profil de soumission Android (`submit.production` ne porte que
  `ios.ascAppId`), et aucun profil ne force un `buildType`.
- `appVersionSource: remote` + `autoIncrement` sur `production` : le numéro de build s'incrémente
  côté EAS, la version marketing reste en dur dans `app.json` (cf. mémoire des builds).

**Landing**
- `landing/src/components/StoreLinks.astro` est la source unique des pastilles de téléchargement.
  Règle déjà posée : **sans URL, aucun lien n'est émis** (l'élément devient un `<span>`). Les URL
  viennent de `PUBLIC_APP_STORE_URL` / `PUBLIC_PLAY_STORE_URL`, injectées en build-args du job
  `landing` de `.github/workflows/deploy.yml`.
- Trois pages affichent « Bientôt sur l'App Store et Google Play » quand `storesLive` est faux :
  `AppSection.astro`, `pages/app.astro`, `pages/jawdi-ia.astro`.
- `PUBLIC_APP_SIGNUP_URL=/contact` (`landing/Dockerfile`, `landing/.env.example`) : les six
  composants qui portent un appel à l'action (`Hero`, `Header`, `FinalCta`, `MobileCta`,
  `DualPath`, …) pointent tous vers le formulaire de contact.

**Inscription**
- `web/src/app/(auth)/signup/page.tsx` existe et fonctionne.
- `AuthService.signup` (`identity`) crée **un compte USER seul** — pas de ferme. `SignupRequest` =
  email, mot de passe, nom complet, téléphone (obligatoire depuis le 2026-10-09). La ferme naît
  plus tard, dans l'onboarding guidé, via `CreateFarmRequest`.
- **Le patron d'alerte vers l'astreinte existe déjà** :
  `admin/audit/AdminIntegrityAlerter.java` implémente l'interface `IntegrityAlerter` (déclarée dans
  `integrity`), écrit au journal d'audit via `AdminAuditService.record(...)` puis appelle
  `WhatsAppOutboxFacade.enqueue(phone, message)` avec `${avicare.admin.oncall-phone}`. C'est
  exactement la forme à reproduire : l'interface vit dans le contexte émetteur, l'implémentation
  dans `admin`, et aucun contexte ne gagne de dépendance vers `notification`.

**Pays**
- `farms` (V1) porte `timezone VARCHAR(50) NOT NULL DEFAULT 'Africa/Dakar'`,
  `currency VARCHAR(3) NOT NULL DEFAULT 'XOF'`, `ninea`, `rccm` — et **aucune colonne pays**.
- `CreateFarmRequest` accepte `timezone` et `currency`, pas de pays.
- La liste des pays existe côté client : `web/src/lib/phone/countries.ts` et
  `mobile/src/phone/countries.ts`, **16 lignes, volontairement dupliquées** (le dossier `shared/`
  n'est câblé ni dans Metro ni dans Next ; le fichier le documente et impose : une ligne ajoutée
  ici s'ajoute là-bas). Chaque entrée porte `iso`, `name`, `dial`, `flag`, `example`, `trunkZero`.
- `ninea` est rendu à trois endroits : `web/src/components/settings/FarmIdentityCard.tsx`,
  `web/src/components/commercial/InvoicePdfDocument.tsx`, et
  `mobile/src/commerce/invoiceHtml.ts` (qui écrit littéralement `NINEA : …`).

**Abonnement et mesure du coût**
- ADR-009 a retiré le self-serve : gratuit, tous les modules V1, mécanisme de gating dormant.
- `V45__whatsapp_outbox_accounting.sql` a ajouté `source` (`ALERT`/`INTERACTIVE`/`BROADCAST`) et
  `farm_id` (`ON DELETE SET NULL`) **explicitement pour que « le coût par ferme » soit
  répondable**. `WhatsAppLedger.Usage` expose déjà `bySource` et **`byFarm`**, et
  `AdminMetricsService` sert `whatsappUsage(days)` et un compteur de fermes actives (MAU).

### Correction à une affirmation du brainstorming

J'ai dit que « la donnée est sénégalaise en dur », catalogue compris. **C'est faux pour le
catalogue**, vérifié ligne à ligne :

- V4 sème des races internationales (`cobb_500`, `ross_308`, `isa_brown`, `lohmann_brown`,
  `hyline_w36`) et des catégories de dépenses génériques (`feed`, `veterinary`, `staff`, `energy`,
  `equipment`, `transport`, `other`) ;
- V12 sème des souches vaccinales et des molécules internationales (`newcastle_la_sota`,
  `gumboro_d78`, `marek_hvt`, `amprolium`, `enrofloxacin_10`, …) ;
- V15 sème des articles génériques (`feed_starter_broiler`, `corn_crushed`, `litter_wood_chips`, …)
  et **aucun fournisseur** — les fournisseurs sont créés par la ferme.

**L'audit du catalogue que j'avais proposé est donc retiré du périmètre : il n'y a rien à
neutraliser.** Ce qui est réellement sénégalais se réduit à trois choses : le fuseau par défaut, le
champ `ninea`, et la devise par défaut.

## 3. Objectifs, non-objectifs, anti-objectifs

**Objectifs**
1. Un éleveur sous Android peut installer l'application de terrain sans qu'un centime soit dépensé.
2. Un éleveur qui arrive seul sur `jawdi.app` crée son compte et s'en sert **immédiatement**, et le
   porteur du projet le sait par WhatsApp dans les deux minutes (cf. §8.3).
3. Une ferme sait dans quel pays elle est, et ses valeurs par défaut en découlent.
4. Personne ne peut croire que la gratuité est définitive, et la décision de prix a un déclencheur
   écrit.

**Non-objectifs** (volontairement hors de ce chantier)
- Publier sur le Google Play Store (25 $ une fois — plus tard, décision séparée).
- Les mises à jour automatiques de l'APK.
- Toute espèce autre que la volaille. Toute activation du gating. Tout prix.
- Les pays hors zone XOF (`GN`, `MR`, `GM`, `CM`, `FR`, `BE`, `CA`, `LB` de la liste existante) :
  ils posent une question de **devise**, traitée séparément.
- Une **colonne** pays sur `catalog_items`, c'est-à-dire un catalogue dont chaque ligne (race,
  article, vaccin) serait propre à un pays. À ne pas confondre avec la **catégorie** `countries`
  ajoutée par §4.C.4, qui est la donnée de référence des pays eux-mêmes.
- Une validation manuelle des inscriptions (explicitement écartée par le porteur du projet :
  « utilisable tout de suite »).

**Anti-objectifs** — ce qui ferait échouer le chantier même s'il fonctionne
- Émettre un lien de téléchargement mort, ou une pastille « Google Play » qui ne mène nulle part :
  la landing a déjà corrigé ce défaut une fois, le reproduire serait une régression.
- Qu'une inscription échoue parce que l'alerte WhatsApp a échoué.
- Qu'un ajout de pays casse l'affichage des factures d'une ferme sénégalaise existante.
- Écrire « gratuit » sans borne quelque part où un futur client le lira.

## 4. Les quatre chantiers

### A — Android sans payer

**Décidé :** distribution **par APK direct**, pas par le Play Store. Motif : le compte Play coûte
25 $ une seule fois mais demande une décision commerciale (fiche, captures, politique de
confidentialité) ; l'APK coûte 0 F et se distribue par WhatsApp, canal normal de la région.

À livrer :
1. Un profil de construction Android qui produit un **APK** (et non un AAB, inutile hors Play),
   visant l'API de production. Le profil `preview` existant porte déjà
   `EXPO_PUBLIC_API_URL=https://app.jawdi.app` : l'étendre ou en dériver un profil dédié.
2. Un APK construit, et **hébergé en asset de Release GitHub** — pas dans l'image Docker de la
   landing (une image qui grossit de ~100 Mo se déploie plus lentement à chaque fois, pour un
   fichier qui ne change qu'à chaque build).
3. Côté landing : une variable `PUBLIC_ANDROID_APK_URL` suivant **exactement** le mécanisme des
   deux URL de stores (build-arg du job `landing`, Variable de dépôt), et une troisième pastille
   dans `StoreLinks.astro` rendue **seulement** si la variable est posée. La règle « sans URL,
   aucun lien » s'applique telle quelle.
4. Un encart court sur `/app` expliquant l'avertissement « source inconnue » d'Android et comment
   le passer — sans lui une installation sur deux s'arrête là.
5. La phrase « Bientôt sur l'App Store et Google Play » doit rester **vraie** : si l'APK est
   disponible mais pas le Play Store, elle ne peut plus s'afficher telle quelle.

**Conséquences à assumer, écrites dans le document de release :** pas de mise à jour automatique
(l'APK doit afficher sa version, et l'URL de l'API y est figée à la construction) ; l'avertissement
d'installation ; et un APK périmé continuera de parler à l'API de production.

### B — Inscription ouverte + alerte WhatsApp

**Décidé par le porteur du projet :** le compte est **utilisable tout de suite**, sans validation.
`/contact` reste comme seconde porte pour qui préfère parler d'abord.

À livrer :
1. `PUBLIC_APP_SIGNUP_URL` pointe vers l'inscription web (`https://app.jawdi.app/signup`).
   **Aucune ligne de code** : c'est déjà une Variable de dépôt avec `/contact` en repli
   (`.github/workflows/deploy.yml:132`). Poser la Variable et redéployer la landing suffit — et
   refermer la porte coûte le même geste.
2. **Une** alerte WhatsApp vers l'astreinte, à l'inscription : nom, e-mail, et le numéro au
   format E.164 — son indicatif dit le pays, aucun autre champ n'est nécessaire pour rappeler la
   personne.
   *Révision du 2026-10-29, après relevé du code* : j'avais prévu une seconde alerte à la création
   de la première ferme, pour distinguer « quelqu'un frappe » de « quelqu'un est entré ». Ça ne
   marche pas ici — `web/src/app/(auth)/signup/page.tsx` et `mobile/app/(auth)/signup.tsx`
   appellent tous deux `createFarm({ name: defaultName })` **dans la foulée de l'inscription**, la
   ferme étant nommée plus tard à l'étape 2 du wizard. Une alerte « ferme créée » arriverait donc
   une seconde après la première et n'apprendrait rien. Et la fin de l'onboarding n'a **aucun
   signal serveur** : `OnboardingWizard` pose un drapeau `localStorage` et redirige. En fabriquer
   un est hors périmètre. Une seule alerte, donc, émise par `AuthService.signup` — qui ne connaît
   aucune ferme, la création venant d'un second appel HTTP du client. « Est-ce que cette ferme est
   réelle » se lit dans la console (fermes actives, saisies), pas dans un WhatsApp.
3. L'interface d'alerte est déclarée dans `identity/spi/` et implémentée dans `admin` — exactement
   le patron de `StaffLoginAuditor` / `StaffLoginAuditorImpl`, y compris le repli no-op
   (`@Bean @ConditionalOnMissingBean`) qui garde `identity` démarrable sans le contexte admin : sans
   ce repli, les contextes de test sans DB tombent. L'implémentation écrit aussi au journal d'audit,
   comme le fait l'alerte d'intégrité.
4. **Une alerte qui échoue ne fait pas échouer l'inscription.** C'est l'anti-objectif n°2 : le
   chemin d'alerte est enveloppé, son échec est journalisé, la réponse HTTP reste un succès.
5. Les textes : partout où la landing dit « gratuit », elle dit désormais « gratuit **pendant la
   phase pilote** ».

**Abus.** L'alerte est aussi le détecteur : une inscription de spam se voit tout de suite. Refermer
la porte coûte une Variable de dépôt et un redéploiement de la landing ; le kill switch de la
plateforme (V49) reste la mesure brutale si nécessaire. On n'ajoute **pas** de captcha maintenant.

### C — Le pays de la ferme

À livrer :
1. Migration `farms.country VARCHAR(2) NOT NULL DEFAULT 'SN'`, contrainte
   `CHECK (country ~ '^[A-Z]{2}$')`. Pas d'énumération fermée : la liste des pays est de la donnée
   de référence, pas un enum métier, et un pays de plus ne doit pas demander une migration.
   Le défaut `'SN'` rend les fermes existantes correctes sans reprise de données.
2. `CreateFarmRequest` accepte `country`. Deux points de saisie, et ils ne se ressemblent pas :
   - **à l'inscription**, `createFarm({ name: defaultName })` est appelé sans rien demander : le
     pays y est **déduit du téléphone saisi juste au-dessus** (`splitE164` existe des deux côtés) et
     envoyé sans question. L'information est déjà là, on ne la redemande pas ;
   - **à l'étape 2 du wizard** et dans les réglages de la ferme, le pays est **affiché et
     modifiable** — c'est là qu'on le corrige si la déduction était fausse (un éleveur ivoirien
     avec un numéro français).
3. `timezone` **déduit du pays** quand le client n'en envoie pas, au lieu de `Africa/Dakar` en
   dur — lu dans le catalogue des pays (§4.C.4). Il n'est pas uniforme : le Bénin et le Niger sont
   à UTC+1, les six autres pays XOF à UTC+0.
4. La donnée de référence des pays vit dans **`catalog_items`**, catégorie `countries`, clé = code
   ISO-2, valeur JSONB `{ name, timezone, tax_id_label }`, semée par la migration pour les huit
   pays de la zone XOF. C'est la règle d'or appliquée telle quelle : un pays de plus est une ligne
   de catalogue modifiable par le super-admin, pas une migration ni un déploiement.
   *Révision du 2026-10-29* : j'avais d'abord proposé une table de libellés côté client, à côté de
   `countries.ts`. Le catalogue est meilleur, et il a un précédent dans le code :
   `StockItemResponse` ne stocke aucun libellé et le **résout depuis le catalogue à la lecture**
   (« a stock row carries no label snapshot »).
5. Le **libellé du champ fiscal** suit le même chemin : `FarmResponse` gagne `country` et
   `taxIdLabel`, résolu côté serveur à la lecture. Les trois points de rendu (réglages, facture web,
   facture mobile — règle « ce qui part sur le web part aussi sur le mobile ») affichent
   `taxIdLabel` avec « NINEA » en repli, et ne connaissent aucune table de pays. La facture
   imprimée ne fait donc **aucun** appel supplémentaire : le libellé voyage avec la ferme qu'elle
   affiche déjà.
   Le nom de colonne `ninea` ne change pas : renommer une colonne lue par trois écrans et deux
   générateurs de PDF coûterait plus que ce que la clarté rapporte, et la migration serait
   irréversible.
6. La devise reste `XOF`, et le périmètre reste les huit pays UEMOA. Un pays hors XOF choisi dans
   le sélecteur ne doit pas produire une ferme incohérente : à défaut de gérer sa devise, le
   formulaire doit soit le refuser avec un message clair, soit assumer XOF de façon visible. **À
   trancher par le constructeur**, mais pas à ignorer.

### D — L'abonnement : pas de prix, un déclencheur

Rien à construire : la mesure existe déjà (`whatsapp_outbox.farm_id` + `WhatsAppLedger.Usage.byFarm`
depuis V45, plus le compteur de fermes actives de `AdminMetricsService`).

À livrer, en documentation seule :
1. Un amendement à ADR-009 (ou un ADR court qui le complète) écrivant **le déclencheur** de la
   décision de prix — la condition qui obligera à rouvrir le sujet, pas le prix lui-même.
   *Proposition, à confirmer* : la **10ᵉ ferme ayant au moins une saisie dans les 30 derniers
   jours**. Motif : c'est le seuil où l'accompagnement personnel d'un solo dev cesse de tenir, et
   les deux chiffres nécessaires sont déjà dans la console.
2. La mention « pendant la phase pilote » (partagée avec le chantier B).

## 5. Contraintes

- **1 PR = 1 sujet** → quatre PR au minimum (A, B, C, D). Le texte « gratuit pendant la phase
  pilote » appartient à B ; D ne le redemande pas.
- Migration Flyway : **numérotée à l'ordre de fusion**, jamais une migration fusionnée modifiée.
- ADR-003 : valider en local (`cd backend && ./mvnw clean verify`, démarrage de l'app,
  `/actuator/health`), Testcontainers ne tourne pas sur cette machine — la CI tranche.
- Portes web : `npx tsc --noEmit` **et** vitest. Portes mobile : `tsc` et jest.
- La landing **n'est pas construite par la CI des PR** : une erreur de build Astro ne se voit qu'au
  déploiement. Construire la landing en local avant de fusionner A ou B.
- Tout nouveau dépôt JPA injecté dans un service déjà présent dans les contextes de test sans DB
  doit être ajouté en `@MockitoBean` aux six contextes concernés (chercher l'ancre
  `FarmRepository`, ne pas faire confiance au nombre).
- Les commits ne portent aucune valeur métier en dur ; les libellés utilisateur passent par les
  mécanismes existants.

## 6. Ce qui reste au constructeur

- Le découpage exact des PR et leur ordre (A et B sont indépendants ; C touche backend + web +
  mobile ; D est du document).
- La forme des messages WhatsApp (longueur, emoji, lien console) — sobres, et sans donnée
  personnelle au-delà de ce qu'il faut pour rappeler la personne.
- Le choix entre étendre le profil `preview` et créer un profil `apk` dédié.
- Le comportement exact du formulaire de ferme pour un pays hors XOF (§4.C.5).
- Le texte de l'encart « source inconnue ».
- Les tests : au minimum, l'inscription qui réussit alors que l'alerte échoue, le libellé `ninea`
  qui change avec le pays sur les trois points de rendu, et une ferme créée sans `country` qui
  reste en `SN`.

## 7. Comment on saura que c'est fait

1. Un téléphone Android installe l'APK depuis `jawdi.app/app` et se connecte à la production.
2. Une inscription faite depuis un navigateur neuf donne un compte utilisable sans intervention, et
   un WhatsApp arrive sur le numéro d'astreinte, portant le nom, l'e-mail et le numéro en E.164.
3. Une ferme créée avec `CI` porte `country = 'CI'`, un fuseau ivoirien, et sa facture imprimée dit
   « N° contribuable » et non « NINEA » — sur le web **et** sur le mobile.
4. Les fermes existantes sont inchangées : `country = 'SN'`, fuseau `Africa/Dakar`, « NINEA ».
5. Aucune page publique ne dit « gratuit » sans borne.
6. ADR-009 porte le déclencheur écrit.

---

## 8. Révisions après relecture (2026-10-29)

Un relecteur a lu ce document avec le code sous les yeux. Quatre points sont tranchés ici, les
autres sont partis en question au porteur du projet.

1. **Le pays doit être corrigeable.** `UpdateFarmRequest` est le vrai chemin d'écriture de
   l'identité d'une ferme (il porte déjà `ninea` et `rccm`) et n'était pas dans le périmètre. Sans
   lui, une ferme reste prisonnière du pays déduit à l'inscription — **y compris les deux fermes
   pilotes, bloquées sur `SN` à jamais**, et sur l'écran même où le libellé fiscal changerait.
   `country` entre donc dans `UpdateFarmRequest` et dans les quatre surfaces d'édition (étape
   « ferme » du wizard web et mobile, réglages web, écran fermes mobile). Ce PUT remplace les
   champs omis : `country` à `null` vaut **« ne pas changer »**, jamais « remettre au Sénégal ».
2. **Le fuseau par défaut est en Java, pas en SQL.** `Farm.java` initialise
   `private String timezone = "Africa/Dakar";` dans le champ : le défaut SQL n'est jamais atteint et
   un fuseau déduit du pays serait écrasé. Le retirer fait partie du chantier C, sinon celui-ci
   passe ses tests et ne change rien en production.
3. **« Dans la minute » est faux : c'est dans les deux.** Le vidage de la file WhatsApp est
   planifié toutes les deux minutes. L'objectif n°2 se lit donc « il le sait dans les deux
   minutes » — ce qui ne change rien à sa valeur, mais une promesse fausse dans un document de
   conception finit par être tenue pour vraie.
4. **Android n'aura pas les notifications push**, et c'est assumé. Expo Push exige une clé de
   service FCM déposée sur EAS ; sans elle `obtainPushToken.ts` avale l'erreur et l'appareil ne
   s'enregistre jamais, **silencieusement**. Le rail d'alerte principal de ce produit est WhatsApp,
   pas le push : la dégradation est acceptable, à condition d'être écrite dans les notes de release
   et reprise dans un chantier séparé.

Et un risque que ce document avait manqué : **la clé de signature Android**. Aucun keystore n'existe
pour `app.jawdi.mobile`. Si elle est perdue ou régénérée, un APK suivant ne s'installe pas par-dessus
le précédent — il faut désinstaller, ce qui efface la base locale **et la file de synchronisation
hors-ligne de l'ouvrier**. C'est le seul geste irréversible de tout le chantier ; il prend une étape
dédiée dans le plan.

Deux affirmations du document ont été vérifiées comme justes : le catalogue n'a rien de sénégalais,
et `WhatsAppOutboxFacade.enqueue` ne lève jamais par contrat — l'anti-objectif n°2 est déjà tenu par
le rail existant, tant qu'on ne sort pas de ce facade.
