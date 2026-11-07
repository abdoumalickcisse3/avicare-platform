# Design — Souches locales améliorées : le nom est libre, le profil est imposé

> Spec de cadrage. Décidée le 2026-11-07 après un brainstorming déclenché par le retour d'un
> éleveur malien, puis révisée le même jour après relecture par un constructeur.
>
> Ce document traite **un seul sujet** : comment une souche absente du catalogue entre dans la
> plateforme. Il ne traite ni la modélisation d'un troupeau à double fin, ni la construction d'une
> courbe de référence par souche — les deux sont explicitement hors périmètre (§5).
>
> La relecture a mis au jour **deux dettes préexistantes** qui n'ont rien à voir avec les souches
> locales mais qui rendraient ce chantier mensonger si on les laissait : les graphiques de
> croissance tracent encore une droite, et la console admin laisse ajouter une souche qui ne
> matérialise rien. **Décision du 2026-11-07 : ce lot les absorbe** (§7.6, §7.7).

---

## 1. Pourquoi

Le 2026-11-06, **Amadou Baboye Mohamed Ouattara** (Mali, +223 76638492, Android) demande à
s'inscrire. Il élève des poulets de chair et des pondeuses de **race locale améliorée**, organisés
en 4 bandes de 100 sujets d'âges échelonnés, plus une cinquantaine de pondeuses. On lui envoie le
lien d'inscription. Il répond :

> « Je remarque qu'au niveau de la sélection des souches les races locales améliorées n'y figurent
> pas. »

Il cite le **Goliath** et le **Kuroiler**. Il a raison : le catalogue ne contient que des souches
industrielles. Mais le vrai problème n'est pas qu'il manque trois lignes — c'est qu'**il n'existe
aucun moyen d'en ajouter une** sans migration Flyway et déploiement (§2).

Et ce blocage n'est pas malien. La plateforme vise les huit pays de la zone XOF (migration V67), et
chacun a ses noms : *poulet du pays* au Sénégal, *bicyclette* au Burkina, *Goliath* venu du Bénin,
*Sasso* au Mali et en Côte d'Ivoire, *Kuroiler* ailleurs, plus les croisements propres à chaque
couvoir. Cette liste ne se termine jamais. Chaque manque se paie au pire moment possible : un
éleveur bloqué **à l'inscription**, avant d'avoir saisi la moindre donnée.

La doctrine est déjà écrite dans le projet, par la migration V67 elle-même :

> « Un pays de plus doit être une ligne de catalogue modifiable par le super-admin, jamais une
> migration et un déploiement. »

Une souche de plus, c'est le même problème.

## 2. Ce qui existe aujourd'hui (relevé dans le code le 2026-11-07)

**Le catalogue est industriel et clos**
- `V4__seed_reference_data.sql:51-55` sème cinq souches, toutes industrielles : Cobb 500,
  Ross 308, ISA Brown, Lohmann Brown, Hy-Line W-36.
- `V5__init_livestock_socle.sql` recopie ces lignes dans la table `breeds`.
- **Aucun code de production n'écrit jamais une ligne dans `breeds`.** Seules la migration V5 et
  les tests le font (`ProductionUnitCreateIT`, `CrossFarmAccessIT`, `LivestockStatsIT`,
  `PoultryBatchServiceIT`, `LivestockMappingIT`).
- `BreedController` n'expose qu'un `GET`. Il n'y a ni `POST`, ni service d'écriture.

**Le chemin de lecture, lui, est complet**
- `breeds.farm_id` existe depuis V5, documenté « farm_id NULL = platform-level breed ; non-null =
  farm-custom ».
- `BreedRepository.findVisible(species, farmIds, activeOnly)` sert déjà les souches plateforme
  **plus** les souches propres aux fermes de l'appelant, et jamais celles d'une autre ferme
  (`BreedService.listVisible`). La contrainte `UNIQUE (species, code, farm_id)` est posée.
- Autrement dit : la souche propre à une ferme a été **conçue**, câblée en lecture, et jamais
  branchée en écriture.

**Il existe un faux espoir côté ferme, sur web et sur mobile**
- `web/src/constants/catalogCategories.ts:22-41` et `mobile/src/constants/catalogCategories.ts:18`
  déclarent une catégorie « Lots » (`backendCategory: "breeds"`) dans le gestionnaire de catalogue
  des Réglages. L'éleveur peut y taper « Goliath », avec un type chair/ponte.
- Ça atterrit dans `farm_catalog_items`, catégorie `breeds`, via `CatalogService.override`.
- **Rien ne lit cette ligne.** `GET /api/v1/breeds` interroge la table `breeds`. L'éleveur ajoute
  sa race, la sauvegarde, et elle reste absente du sélecteur de création de lot.
- C'est exactement la classe de bug de « catalogue ≠ stock » (PR #425) : une entrée de catalogue
  qui ne matérialise rien.

**Et le même faux espoir côté plateforme, un étage plus haut**
- `AdminCatalogService:47` : `READ_ONLY_CATEGORIES = Set.of("modules", "bundles", "admin")`. La
  catégorie `breeds` est donc **modifiable depuis la console admin**, et l'éditeur l'annonce
  (`web/src/components/admin/CatalogEditor.tsx:40` → `breeds: "Races et souches"`).
- Mais seule V5 a jamais recopié ces lignes vers la table `breeds`. Le super-admin peut donc créer
  une entrée de catalogue qui ne devient jamais une souche sélectionnable.

**Le modèle de croissance backend est déjà agnostique de la race — bonne nouvelle**
- `BroilerGrowthCurve` fige la **forme** de la courbe (part du gain total atteinte à chaque
  fraction du cycle) et prend l'**échelle** dans le `target_weight_g` / `target_age_days` du lot,
  saisis par l'éleveur. Son commentaire le dit : « Nothing is invented about a breed, and a farm's
  own strain is served as well as a catalogue one. »
- La forme a été calibrée le 2026-09-05 sur les standards publiés Cobb 500 et Ross 308, après
  l'incident de la courbe linéaire : la droite exigeait le double du poids réel pendant la première
  quinzaine et classait **tout** lot « en retard » au moment précis où un éleveur réagit, en
  sur-alimentant ou en médicamentant.
- `breeds.growth_curve` (JSONB, V5) devait porter les standards par souche. Elle est **vide sur
  toutes les lignes et personne ne la lit**.

**Mais la correction du 2026-09-05 n'a jamais atteint les graphiques**
- `web/src/components/poultry/charts/GrowthChart.tsx:25` — `targetAt()` interpole une **droite** du
  poussin d'un jour (40 g) jusqu'à la cible. La carte s'intitule « Poids moyen (g) réel vs objectif
  souche » (`BatchOverviewTab.tsx:216`).
- `mobile/src/components/charts/GrowthChart.tsx:54` — `ref = M(0,0) → L(targetAge, targetWeight)`,
  en pointillé.
- Conséquence **actuelle, et pas seulement pour les souches rustiques** : le backend classe un lot
  « dans la cible » pendant que le graphique le dessine loin sous le pointillé. L'appli se
  contredit elle-même. Sur un oiseau de 120 jours, l'écart devient énorme.

**Ce qui reste industriel dans les cibles**
- `web/src/constants/breedDefaults.ts` et `mobile/src/constants/breedDefaults.ts` (dupliqués,
  valeurs identiques) pré-remplissent : `cobb_500` → 2 100 g à 42 j, `ross_308` → 2 200 g à 42 j,
  **défaut 2 000 g à 42 j**. Une souche rustique hérite de ce défaut.
- Les deux fichiers portent la même dette assumée : « TECH DEBT: source these from the breed
  reference data once it carries a curve. »
- `mobile/app/(field)/lots/nouveau.tsx` a bien les champs de cible (pré-remplis via
  `targetsForBreed`), mais `mobile/src/components/onboarding/CreateLotSheet.tsx` n'en a **aucun** :
  un lot créé pendant l'inscription part avec `targetWeightG` nul, donc sans courbe ni score.

**`breeds.type` n'est pas porteur du métier, mais il est porteur de l'affichage**
- `breeds.type` (`broiler` | `layer`, colonne dénormalisée par V10) ne sert pas aux branchements
  métier : ceux-là se font sur `ProductType` (`BROILER` / `EGGS`) et sur la classe d'unité.
- Mais **quatre** chemins filtrent dessus, et l'un d'eux touche l'argent :
  `mobile/src/components/onboarding/CreateLotSheet.tsx:45`,
  `web/src/components/poultry-layer/CreateLayerBatchDialog.tsx:84`,
  `web/src/components/onboarding/steps/LivestockStep.tsx:49`, et surtout
  `web/src/components/commercial/useProductionAvailability.ts:32`, qui **exclut des têtes
  vendables** tout lot dont la souche est de type `layer`.
- Donc une souche à double fin mal typée fait apparaître des pondeuses comme poulets à vendre.
  C'est ce qui dicte la clé de déduplication (§7.2).

**Côté ponte, il n'existe aucune cible**
- `CreateLayerBatchDialog` ne poste que souche / nom / effectif / date / notes : aucune cible.
- Il n'y a aucune courbe de ponte de référence, et `daily_egg_productions.laying_rate_pct` est
  calculé sans être comparé à quoi que ce soit.

**La comparaison entre fermes ne segmente pas encore**
- `BenchmarkService` publie une mortalité moyenne plateforme, sans découpage par souche, avec un
  plancher de cohorte (`min_cohort`, 5 par défaut, fonctionnalité désactivée par défaut, V47).
- Donc aujourd'hui elle mélange déjà du Cobb de 42 jours et du local de 4 mois. Le jour où il
  faudra la segmenter — et il le faudra, sinon elle ne veut rien dire — la clé de regroupement
  devra exister.

## 3. Ce que dit le terrain

Recherche faite le 2026-11-07. Elle tranche une question de conception, elle n'alimente aucune
valeur par défaut.

**Kuroiler** (sources convergentes) : ~400 g à 5 semaines, ~850 g à 10 semaines, ~1 355 g à
16 semaines ; 2 kg en 3 mois en intensif mais **4 à 5 mois** en semi-extensif ; entrée en ponte à
20–24 semaines ; 180 à 250 œufs par an. Taux de survie observé de 84 % en conditions villageoises
ougandaises.

**Goliath** : les chiffres vendeurs sont **incohérents entre eux** — 2,5 kg à 3 mois, puis 9 à
12 kg à 7–8 mois, et 320 œufs par an pour une poule. Ces annonces ne sont pas utilisables.

**Conclusion de conception, et elle est structurante :** il n'existe **aucun standard publié
fiable** pour ces souches, contrairement aux guides d'élevage Cobb et Ross. La plateforme ne peut
donc pas livrer une courbe de référence pour une souche rustique sans inventer des nombres — ce que
la règle d'or n°0 du doc 00 interdit, et ce que l'incident du 2026-09-05 a déjà fait payer.

La référence, pour ces souches, ne peut venir que de l'historique de la ferme elle-même. Les
4 bandes échelonnées d'Amadou sont le cas idéal pour ça — mais c'est le chantier suivant (§5).

## 4. La décision centrale

`breeds` confond aujourd'hui deux choses de nature opposée :

| | Nature | Conséquence |
|---|---|---|
| **Le nom commercial** — « Goliath », « Ross 308 », « locale améliorée du couvoir de Ségou » | Traîne infinie, dépendante du pays, du couvoir, de l'année | Ne peut pas être une liste close. Purement cosmétique pour la plateforme. |
| **Le profil de production** — chair rapide, chair rustique, ponte industrielle, ponte rustique | Liste **courte, close, identique dans les huit pays** | Pilote la forme de la courbe, les cibles par défaut, et demain la cohorte de comparaison. |

**Décision : le nom est libre et saisi par l'éleveur, le profil est imposé et appartient à la
plateforme.**

Ce que ça achète :
- **Zéro migration par pays.** Un nom qui manque n'est plus un blocage, c'est une saisie.
- **La clé de jointure survit.** Deux orthographes de « Goliath » portant le même profil tombent
  dans la même cohorte. Le problème des doublons cesse donc d'être un problème de données
  partagées — il redevient un simple désagrément d'affichage dans une ferme.
- **Le faux signal disparaît.** Choisir « chair rustique » pré-remplit des cibles plausibles pour
  un oiseau lent, au lieu des 2 000 g à 42 j hérités aujourd'hui.

Ce que ça coûte, dit franchement : c'est beaucoup plus qu'ajouter trois lignes de seed. Il faut le
chemin d'écriture qui n'existe pas, la notion de profil, l'écran sur web **et** sur mobile, la
reprise des cinq souches existantes, et les deux dettes préexistantes du §2 (§7.6, §7.7).

## 5. Buts, non-buts, anti-buts

**Buts**
1. Un éleveur OWNER/MANAGER peut déclarer une souche absente du catalogue, depuis son écran, sur
   web et sur mobile, et elle apparaît immédiatement dans le sélecteur de création de lot.
2. Le catalogue plateforme s'enrichit d'une poignée de souches de la zone, pour que l'éleveur n'ait
   pas à affronter un champ vide — 11 éleveurs sur 17 de l'enquête terrain tiennent encore un
   cahier papier.
3. Toute souche, semée ou saisie, porte un profil de production tiré d'une liste close.
4. Les cibles par défaut proposées à la création d'un lot **de chair** découlent du profil, et non
   plus d'un défaut industriel unique. *(Restreint à la chair après relecture : côté ponte il
   n'existe aucune cible à pré-remplir — §2, §7.1.)*
5. Aucun écran — ferme ou console admin — ne laisse croire qu'une souche a été ajoutée sans qu'elle
   apparaisse dans le sélecteur.
6. Le graphique de croissance et le score backend disent la même chose, sur web comme sur mobile.

**Non-buts** (hors de ce chantier, assumé)
- Scoper la liste des souches par pays. Ces noms circulent dans toute la zone ; `farms.country`
  servira à **trier** par pertinence, pas à filtrer. À reconsidérer quand une ferme hors XOF
  arrivera. Le **tri** lui-même n'est pas dans ce lot : il exigerait une donnée de pertinence par
  pays et par souche, qui n'existe pas.
- Peupler `breeds.growth_curve` avec des standards par souche. Il n'existe pas de données fiables
  (§3).
- Construire la courbe de référence d'une ferme à partir de ses bandes clôturées. C'est le chantier
  suivant, et c'est lui qui rendra son verdict au profil rustique (§7.4).
- Segmenter la comparaison entre fermes par profil. Ce chantier **prépare la clé**, il ne touche
  pas `BenchmarkService`.
- La boucle de promotion super-admin (voir une souche saisie par plusieurs fermes et la hisser au
  catalogue plateforme). La donnée doit la rendre possible ; l'écran n'est pas dans ce lot.
- Doter la ponte de cibles et d'une courbe de référence. Les profils de ponte ne portent donc
  **aucun paramètre** dans ce lot (§7.1).
- Permettre à une ferme de masquer une souche plateforme qu'elle n'utilise pas. Le geste existe
  aujourd'hui dans le gestionnaire générique (`CatalogManager.tsx:62`) mais `breeds` n'a qu'un
  `is_active` **global** et `findVisible` n'interroge pas `farm_catalog_items`. Reconstruire un
  masquage par ferme ferait lire une liste `parameters` depuis `livestock` — le piège de façade du
  §6. Avec une dizaine de souches au catalogue, le besoin n'est pas établi.
- Modéliser un troupeau à double fin — un même lot produisant viande **et** œufs. Le Goliath et le
  Kuroiler sont génétiquement à double fin, mais Amadou gère deux groupes séparés (4 bandes de
  chair, ~50 pondeuses). Ce que ce lot fait, c'est permettre à **une même race** d'être déclarée
  des deux côtés (§7.2) — pas à un même lot de produire les deux.

**Anti-buts** (ce qui ferait de ce chantier un échec, même livré et vert)
- **Inventer des nombres** pour une souche dont on n'a pas de données. Mieux vaut ne rien afficher
  qu'un verdict faux.
- Livrer un écran où l'éleveur crée une souche **qui n'apparaît pas dans le sélecteur** — c'est le
  bug d'aujourd'hui, répété.
- Reconduire une liste qui exige une migration à chaque nouveau pays.
- Produire des alertes ou des dessins « en retard sur la cible » sur des bandes rustiques saines.
  Ça pousse à sur-alimenter ou médicamenter, ça coûte de l'argent à l'éleveur, et ça brûle sa
  confiance dans toutes les autres alertes.
- Faire apparaître des pondeuses comme poulets vendables (§2, `useProductionAvailability`).

## 6. Contraintes

- **Règle d'or n°0 (doc 00 §4)** : aucune valeur métier en dur. Les paramètres d'un profil (cibles
  par défaut, forme de courbe) sont de la donnée de catalogue, pas des constantes Java ou
  TypeScript. Le super-admin doit pouvoir corriger « 2 500 g à 90 j » sans déploiement.
- **Web implique mobile.** Règle permanente du projet. Les deux `breedDefaults.ts`, les deux
  `catalogCategories.ts` et les deux `GrowthChart` sont déjà dupliqués ; ce chantier doit laisser
  les deux plateformes au même niveau.
- **Pas de cross-import entre bounded contexts.** `breeds` vit dans `livestock`, les catalogues
  dans `parameters` : la lecture d'un profil passe par `ParametersFacade`. Attention au piège
  connu : ajouter une dépendance à une façade que des `@DataJpaTest` importent casse la slice
  (vert en local, rouge en CI Testcontainers) — garder le graphe de dépendances de la façade serré.
- **Immuabilité Flyway.** Nouvelle migration ; le numéro est attribué à **l'ordre de fusion**, pas
  à l'ordre d'écriture.
- **Le `code` d'une souche se calcule côté serveur.** Leçon de la PR #491 : le `slugify` divergeait
  entre web et mobile (`amine-totale` vs `amine_totale`), ce qui fabriquait deux entrées pour un
  même produit dans une même ferme. Le client envoie un nom, jamais un code.
- **Permissions.** L'écriture est une opération de réglage : OWNER/MANAGER. FARMER (l'ouvrier)
  n'a même pas `settings:read`, donc l'écran de déclaration ne doit pas apparaître dans sa
  navigation — la navigation mobile est une table (`constants/navigation.ts`), pas une collection
  de `router.push`. Mais FARMER a `poultry:write` et **crée des lots** : les cibles résolues d'un
  profil doivent donc lui parvenir sans passer par un endpoint de réglages (§7.1).
- **Hors ligne (mobile).** Déclarer une souche est un geste de bureau, pas de terrain. Il est
  acceptable qu'il exige le réseau, à condition de le dire honnêtement plutôt que d'échouer en
  silence.

## 7. Le modèle retenu

### 7.1 Les profils de production

Liste close, quatre valeurs, identique dans tous les pays :

| Clé | Libellé | Pour qui | Ce qu'il porte dans ce lot |
|---|---|---|---|
| `broiler_fast` | Chair à croissance rapide | Cobb 500, Ross 308 | Cibles ~2 100 g / 42 j ; la forme de courbe calibrée existante |
| `broiler_rustic` | Chair rustique, croissance lente | Goliath, Kuroiler, Sasso, locale améliorée | Cibles par défaut en catalogue ; **aucune forme de courbe, aucun verdict** (§7.4) |
| `layer_industrial` | Ponte industrielle | ISA Brown, Lohmann Brown, Hy-Line W-36 | **Rien** — seulement la dérivation du `type` et la clé de cohorte |
| `layer_rustic` | Ponte rustique ou locale améliorée | Locale améliorée, bicyclette | **Rien** — idem |

Les **paramètres** des profils de chair vivent dans `catalog_items`, nouvelle catégorie
`breed_profiles` — pas dans le code (règle d'or n°0). La liste des quatre clés, elle, est close :
elle peut être un enum.

Les deux profils de ponte ne portent aucun paramètre, et c'est délibéré : il n'existe côté ponte ni
champ de cible, ni courbe de référence, ni comparaison du taux de ponte (§2). Écrire en catalogue
des valeurs que personne ne lit serait refaire exactement #425. *(Choix du rédacteur, après
relecture.)*

`breeds.type` (`broiler` | `layer`) **reste** : il porte le filtre de quatre écrans dont le
sélecteur de vente. Il se déduit du profil à l'écriture. *(Choix du rédacteur : garder les deux
colonnes plutôt que dériver `type` à la lecture, pour ne pas toucher les requêtes existantes.)*

Les cibles résolues d'un profil voyagent sur **`BreedResponse`**, et non via un endpoint de
catalogue : FARMER crée des lots sans avoir `settings:read`, et un appel à
`/farms/{id}/catalog/breed_profiles` lui répondrait 403 dans son propre formulaire. *(Choix du
rédacteur.)*

### 7.2 Le chemin d'écriture côté ferme, qui n'existe pas

- `POST /api/v1/farms/{farmId}/breeds` — crée une souche propre à la ferme. Entrée : un nom et un
  profil. OWNER/MANAGER. Le `code` est calculé côté serveur depuis le nom.
- **La clé de déduplication inclut le profil.** Si une souche déjà *visible* par cette ferme
  (plateforme **ou** propre à elle) porte le même code calculé **et le même profil**, l'appel
  renvoie celle-là au lieu d'en créer une seconde. Un éleveur qui tape « Goliath » alors que la
  plateforme a déjà Goliath atterrit donc sur la ligne **plateforme** — c'est ce qui préserve la
  clé de jointure partagée. Même logique que `MedicationCatalogService` (PR #491).
- **Pourquoi le profil dans la clé, et pas le seul nom.** Amadou élève la même race en chair *et*
  en ponte. Avec une clé sur le seul nom, sa deuxième déclaration lui renverrait la première, son
  troupeau de pondeuses serait typé chair, et `useProductionAvailability` proposerait ses pondeuses
  comme poulets à vendre (§2). Il doit donc pouvoir déclarer « Locale améliorée » **une fois par
  profil**. Conséquence : la contrainte `UNIQUE (species, code, farm_id)` de V5 ne suffit plus, et
  le code calculé doit se distinguer entre deux profils d'un même nom.
- Désactivation plutôt que suppression : `breeds.is_active` existe, et des lots passés référencent
  la souche.

### 7.3 Le seed, volontairement court

Une poignée de souches de la zone, au niveau plateforme, pour la découvrabilité : Goliath,
Kuroiler, Sasso, « Locale améliorée » (sans souche précise), « Locale / bicyclette ». La migration
affecte aussi un profil aux **cinq souches existantes**.

Le périmètre s'arrête là volontairement : l'objectif n'est pas d'énumérer le marché, c'est que le
champ ne soit pas vide. Tout le reste passe par la saisie.

**La migration ne devine jamais un profil.** Les entrées « Lots » que des fermes pilotes ont
peut-être déjà tapées dans le gestionnaire menteur (`farm_catalog_items`, catégorie `breeds`)
portent un type chair/ponte mais **rien** qui dise rapide ou rustique. Les matérialiser
automatiquement obligerait à deviner, contre l'anti-but n°1. Elles sont donc laissées en place et
listées pour re-déclaration. Vérifier en production ce qui existe avant d'écrire la migration.
*(Choix du rédacteur.)*

### 7.4 L'honnêteté sur la croissance rustique

Pour `broiler_rustic`, on ne dispose d'aucune forme de courbe validée (§3). Trois voies, et une
seule est honnête :

- Réutiliser la forme industrielle : **non**. Elle place 5 % du gain dans le premier sixième du
  cycle et un quart dans le dernier ; rien ne dit qu'un oiseau de 120 jours suit ce rythme.
- Revenir à la droite : **non**. C'est l'incident du 2026-09-05.
- **Retenu** : afficher la courbe de poids réelle du lot, **sans aucune référence et sans verdict**
  pour ce profil.

La suppression est **inconditionnelle** dans ce lot, et non « jusqu'à ce que la ferme ait une bande
clôturée » comme l'écrivait la première version de ce document : cette condition exigeait la
référence tirée de l'historique, qui est un non-but explicite (§5). Le verdict reviendra avec ce
chantier-là. *(Choix du rédacteur, après relecture.)*

Et la suppression couvre **aussi `forecastedTargetDate`**, pas seulement `performance_score`. Cette
date n'est pas calculée depuis la courbe mais par extrapolation directe du GMQ
(`GrowthAnalysisService:285`), et elle **quitte la ferme** : `LivestockFacadeImpl.cycleOf()` la
passe à `BatchCycleInfo`, donc à la fenêtre de livraison du portail partenaire. Une date de
livraison extrapolée au GMQ d'un oiseau de 120 jours pesé au 20ᵉ jour est une invention montrée à
un provendier. L'argument d'honnêteté vaut autant pour elle que pour l'étiquette. *(Choix du
rédacteur, après relecture.)*

### 7.5 Le gestionnaire « Lots » des Réglages

Il mentit aujourd'hui, sur web et sur mobile. Deux issues, à trancher par le constructeur selon ce
que coûte la première : soit l'entrée « Lots » écrit désormais une vraie souche (et devient l'écran
de déclaration), soit elle est retirée de `catalogCategories.ts` au profit d'un écran dédié. Ce qui
n'est pas négociable, c'est qu'après ce chantier aucun écran ne laisse croire qu'une souche a été
ajoutée sans qu'elle apparaisse dans le sélecteur.

### 7.6 Une seule forme de courbe pour le backend, le web et le mobile

**Dette préexistante absorbée par ce lot** (décision du 2026-11-07).

Les deux graphiques tracent une droite (§2). Supprimer le verdict rustique ne suffirait donc pas :
une bande saine *paraîtrait* en retard, et l'anti-but n°4 tomberait. Et pour les lots industriels,
l'appli se contredit déjà.

Retenu : **la série attendue est servie par le serveur**, pour qu'une seule forme gouverne le
score, le graphique web et le graphique mobile. Les clients cessent d'interpoler. Pour
`broiler_rustic`, le serveur ne renvoie **aucune** série attendue, et le graphique ne dessine donc
aucune référence — ce qui réalise §7.4 sans logique conditionnelle dans les clients.

### 7.7 La console admin doit matérialiser, elle aussi

**Dette préexistante absorbée par ce lot** (décision du 2026-11-07).

Sans ça, ajouter la souche n°11 exigerait encore une migration et un déploiement, et le critère de
terminé n°2 serait faux. Le chemin d'écriture super-admin sur la catégorie `breeds` doit donc créer
une vraie souche plateforme (`farm_id` nul), auditée comme les autres écritures admin
(`AdminAuditService`). Si cela s'avère trop coûteux, l'alternative n'est pas de laisser l'écran
tel quel : c'est de rendre `breeds` lecture seule dans la console en l'ajoutant à
`READ_ONLY_CATEGORIES`.

## 8. Ce qui reste au constructeur

- Le découpage en PR, et l'ordre. Une suggestion : (a) migration profils + seed + reprise des cinq
  souches, (b) chemin d'écriture ferme + déduplication, (c) série attendue servie par le serveur +
  les deux graphiques, (d) web, (e) mobile, (f) console admin, (g) retrait ou rebranchement du
  gestionnaire « Lots ».
- Les valeurs par défaut concrètes des deux profils de chair, à poser **en catalogue** et à faire
  valider par un éleveur avant de les figer. Pour `broiler_rustic`, partir des chiffres Kuroiler
  convergents du §3 plutôt que des annonces Goliath.
- La forme du code calculé quand deux profils partagent un nom (suffixe, ou profil en colonne de la
  contrainte d'unicité) — §7.2 fixe l'exigence, pas la mécanique.
- La forme exacte de l'écran de déclaration (dialogue dans les Réglages, ou création à la volée
  depuis le sélecteur de souche au moment où l'éleveur ne trouve pas la sienne — cette seconde
  option supprime un détour, mais mélange deux gestes).
- Le libellé exact des quatre profils, en français, compréhensible par un éleveur et non par un
  zootechnicien.
- Le cas de `CreateLotSheet.tsx`, qui crée un lot sans aucune cible : lui donner les cibles du
  profil, ou l'exclure du critère de terminé n°1.
- Les tests : au moins un qui prouve qu'une souche créée **apparaît dans le sélecteur** (le bug
  d'aujourd'hui), un qui prouve qu'un nom déjà présent au catalogue plateforme ne crée pas de
  doublon, un qui prouve que le **même nom sous deux profils** donne bien deux souches et que les
  pondeuses ne deviennent pas vendables, un qui prouve qu'une ferme ne voit pas la souche d'une
  autre, et un qui prouve que FARMER ne peut pas écrire.

## 9. Définition de terminé

1. Amadou crée « Goliath » depuis son téléphone Android et l'utilise dans la minute pour déclarer
   une de ses 4 bandes, avec des cibles plausibles pré-remplies.
2. Il déclare « Locale améliorée » en chair et en ponte, et ses pondeuses n'apparaissent **pas**
   dans le sélecteur de vente de poulets.
3. Aucune souche nouvelle n'a exigé de migration ni de déploiement — ni pour une ferme, ni pour le
   super-admin.
4. Aucune bande rustique saine n'est affichée « en retard », ni par une étiquette, ni par un
   pointillé, ni par une date de livraison annoncée au portail partenaire.
5. Sur un lot de Cobb 500, le graphique et le score backend disent la même chose.
6. `cd backend && ./mvnw clean verify` vert, application démarrée, `/actuator/health` à UP,
   `gh pr checks` vertes avant fusion, couverture du module tenue.

## 10. Question ouverte, non bloquante

**Amadou comprendra-t-il qu'il doit déclarer deux fois ce qu'il vit comme une seule race ?** §7.2
règle le problème technique : « Locale améliorée » existe une fois en chair, une fois en ponte. Mais
c'est une question de terrain, pas de code. À poser lors de la démo Meet qui lui a été proposée. Si
la réponse est non, la conception ne change pas — c'est le libellé de l'écran qui doit travailler
plus dur.
