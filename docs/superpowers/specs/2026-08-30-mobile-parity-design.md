# Design — Parité mobile (application de terrain Jawdi)

> Spec de cadrage. Rédigée après mesure, pas après supposition : trois explorations
> exhaustives du dépôt ont produit les chiffres ci-dessous avant qu'une seule ligne de
> plan ne soit écrite.
>
> **Statut : validé le 2026-08-30.** Les six décisions du §3 sont verrouillées. Le §6 ne
> détaille que le premier lot ; les suivants seront détaillés à mesure, comme pour la
> console.

---

## 1. Le point de départ, mesuré

### 1.1 Surface d'API

| | Web | Mobile |
|---|---|---|
| Endpoints RTK Query | **240** sur 33 slices | **99** sur 29 slices |
| Chemins partagés | — | **97** |
| Endpoints web absents du mobile | — | **143** |
| Endpoints mobile absents du web | — | 2 |

### 1.2 Ce que le mobile a déjà, et que je croyais absent

Le mobile n'est pas une esquisse. Il porte déjà le commerce complet (commandes, ventes,
factures, encaissement), la finance, les stocks, les bons d'achat, les formules, les
réglages, le réseau partenaire, l'onboarding en sept étapes.

Et sur cinq points il **dépasse** le web :

- file d'attente hors-ligne durable (SQLite) avec écran de résolution,
- capture sans réseau sur les quatre saisies de terrain,
- assistant vocal avec parseurs d'intentions **locaux** (le web dépend du backend),
- écran de notifications dédié (le web n'a qu'un menu déroulant),
- indicateur de synchronisation.

Toute décision qui traiterait le mobile comme « le web en retard » serait fausse.

### 1.3 Trois bugs trouvés pendant la mesure — corrigés (PR #249)

| Bug | Effet |
|---|---|
| `recordMovement` postait sur une route inexistante | **Aucun mouvement de stock ne partait** |
| `(field)/file.tsx` atteignable depuis nulle part | Une saisie en échec définitif était invisible et incorrigible |
| `clearTokens()` sans purge | Le compte suivant héritait du cache du précédent |

Même forme pour les trois : du code fini que **rien n'exerçait de bout en bout**. Le
premier avait un test vert qui mockait le hook de mutation — un mock du mauvais chemin
reste un mock. C'est le mode de défaillance à surveiller pendant tout ce chantier.

---

## 2. Périmètre

### 2.1 Hors périmètre, et pourquoi

**La console admin — 49 endpoints.** Purge de fermes, anonymisation de comptes,
campagnes WhatsApp, gestion du personnel. La mettre dans une application qui vit dans un
poulailler, sur un téléphone qui se prête et se perd, serait une régression de sécurité,
pas une parité. La console reste web-seule, délibérément.

**Le portail partenaire — 7 endpoints.** Authentification isolée de la session éleveur,
audience différente. Il a déjà sa place.

**Le fichier `baseApi` du web.** Le socle mobile porte la file hors-ligne, un stockage
de jetons asynchrone (`expo-secure-store`) et une logique de rejeu. On porte des
**endpoints**, greffés sur le socle mobile — jamais le socle.

### 2.2 Dans le périmètre : 87 endpoints, 18 manques fonctionnels

| Domaine | Endpoints | Ce que l'éleveur ne peut pas faire |
|---|---|---|
| **Sanitaire** | 24 | Traitements, visites vétérinaires, programmes de vaccination, annuaire véto, catalogue vaccins/traitements |
| **Finance** | 11 | Avances sur salaire, paramètres de salaire, génération mensuelle, modifier/supprimer une dépense |
| **Stocks** | 8 | Détail d'un article, historique des mouvements, consommation par lot, seuils |
| **Œufs** | 6 | Ajuster le stock de plateaux, calibres, réglages plateaux |
| **Clients** | 5 | Créer, modifier, désactiver un client ; encours détaillé |
| **Membres** | 4 | Ajouter un membre, changer un rôle, réinitialiser son mot de passe |
| **Formules** | 3 | Composer une formule (éditeur d'ingrédients) |
| **Fournisseurs** | 3 | Modifier, supprimer |
| **Fermes** | 2 | Créer, supprimer une ferme |
| Divers | 21 | Détails, annulations, réinitialisation de mot de passe par WhatsApp |

### 2.3 Neuf écrans qu'il faut repenser, pas porter

Un port fidèle donnerait exactement ce que la demande exclut. Ces neuf-là exigent une
conception mobile propre :

1. **Détail d'un article de stock** — un graphe et trois tableaux denses.
2. **Analytique financière** — comparaison multi-colonnes revenus/charges/marge.
3. **Facture et bon de livraison PDF** — reposent sur `window.print()`.
4. **Éditeur de formule** — pourcentages qui doivent sommer à 100, coût recalculé en direct.
5. **Réception partielle d'un bon d'achat** — saisie ligne par ligne dans un tableau éditable.
6. **Onglet Équipe** — matrice membres × rôles × permissions.
7. **Réglages ponte** — trois sous-catalogues corrélés côte à côte.
8. **Clients / Commandes** — tableaux à 6–8 colonnes (le mobile a déjà choisi les cartes).
9. **Tableau de bord** — grille multi-panneaux ; le mobile a sa propre composition.

---

## 3. Décisions à verrouiller

### D1 — Périmètre hors-ligne

Aujourd'hui : **4 écrans sur ~50** passent par la file. Huit `MutationKind` existent,
quatre sont utilisés. Tout le reste est online-only et échoue sans réseau.

| Option | Coût | Conséquence |
|---|---|---|
| **A. Statu quo** — seule la saisie de terrain | nul | Un éleveur hors réseau ne peut ni encaisser, ni vendre, ni ajuster un stock |
| **B. Saisie de terrain + écritures simples** (dépense, mouvement de stock, client, observation) | moyen | Couvre ce qui se fait debout dans un poulailler |
| **C. Tout ce qui écrit** | élevé | Encaissements et ventes rejoués à l'aveugle : un paiement rejoué deux fois est un vrai problème d'argent |

**Verrouillé : B.** L'option C n'est pas seulement chère — elle est dangereuse pour les
écritures qui touchent à l'argent, et c'est précisément pourquoi `ONLINE_KINDS` existe
déjà pour les exclure.

Rejoignent donc la file : **dépense, mouvement de stock, création de client, observation
sanitaire, vaccination, traitement**. Restent en ligne : encaissement, vente directe, bon
d'achat, génération de facture, création de ferme, gestion d'équipe. Le serveur ne
déduplique aujourd'hui que la mortalité et la pesée (`client_ref`) ; étendre le hors-ligne
aux écritures d'argent supposerait d'abord un chantier d'idempotence backend.

### D2 — Les neuf écrans « de bureau »

| Option | Conséquence |
|---|---|
| **A. Refonte mobile propre** de chacun | Le mobile n'est plus le web en plus petit ; coût de conception réel |
| **B. Version réduite** (l'essentiel seulement) | Plus rapide, mais l'éleveur revient au web pour finir |
| **C. Renvoi explicite au web** | Honnête, mais c'est le trou d'aujourd'hui rebaptisé |

**Verrouillé : A, sauf les PDF.** Chacun repensé pour le doigt et l'écran de cinq
pouces — le chiffre d'abord, un axe à la fois, flux pas-à-pas. Générer un PDF sur mobile
demande soit une génération serveur, soit une impression Bluetooth : chantier distinct,
hors parité.

### D3 — Convention de formulaire

`react-hook-form` + `zod` ne sont utilisés **que sur les 3 écrans d'authentification**.
Tous les autres formulaires sont du `useState` manuel avec validation par regex. Il faut
en choisir un, sinon quinze nouveaux écrans figeront l'incohérence.

**Verrouillé : `useState` manuel**, conforme à l'existant majoritaire, et suffisant pour
des formulaires courts au doigt. `zod` reste pour l'authentification.

### D4 — Les primitives de design non construites

Trois éléments sont **définis dans les tokens et jamais implémentés** :

- `touch.counterPrimary` (96 dp) et `counterSecondary` — l'« anatomie du compteur »,
- `touch.keypadKey` (64 dp) — le clavier numérique intégré,
- `layout.thumbZoneRatio` et `actionBarHeight` — la zone de pouce.

Les écrans de saisie utilisent aujourd'hui un `TextInput` ordinaire. Ce sont exactement
les briques d'« UX facile à comprendre » demandée.

**Verrouillé : construits dans le lot 1**, avant les écrans qui s'en serviront.

### D5 — Règle de navigation

`SCREEN_TO_TAB` est une **étape d'enregistrement cachée** : un écran de la pile `(field)`
qui n'y figure pas s'affiche **sans barre de navigation**. C'est ce mécanisme qui a
orphelin `file.tsx`.

**Règle proposée, non négociable pour ce chantier :** tout nouvel écran est ajouté au
même commit à `DRAWER_ITEMS` (lu à la fois par le tiroir des propriétaires et par
l'écran Menu des autres rôles) **et** à `SCREEN_TO_TAB`. Un test vérifiera que toute
route de `app/(field)/**` est atteignable depuis l'une des deux structures.

### D6 — Ordre des lots

**Verrouillé : socle d'abord, puis par métier.** Porter « tous les endpoints » puis
« tous les écrans » livrerait des mois de code non utilisable. Chaque lot livre un
domaine complet — endpoints, écrans, tests — mergeable et déployable seul.

---

## 4. Architecture

### 4.1 Port des endpoints

Un slice mobile par slice web, mêmes chemins, `transformResponse: r => r.data`,
`tagTypes` ajoutés au `baseApi` mobile (12 manquent : `User`, `Permission`, `Setting`,
`UnitEvent`, `Treatment`, `Veterinarian`, `VetVisit`, `HealthProgram`, `HealthSchedule`,
`StockMovement`, `Advance`, `Subscription`).

**Chaque nouvel endpoint reçoit un test d'URL** contre un vrai store, sur le modèle de
`productionUnitsApi.test.ts`. C'est la seule protection contre le bug du chemin de
mouvement de stock — un test qui mocke le hook ne peut pas le voir.

### 4.2 Extension de la file hors-ligne

Pour chaque nouveau `MutationKind` (selon D1) :
1. l'ajouter à `MutationKind` dans `sync/types.ts`,
2. ajouter son libellé à `KIND_LABELS` dans `file.tsx` — sinon l'écran affiche `undefined`,
3. choisir une stratégie de `client_ref` parmi les trois existantes (aléatoire,
   miroir du payload, clé naturelle déterministe),
4. écrire le test de rejeu.

### 4.3 Primitives de design (D4)

- `Counter` — pavés +/− à `counterPrimary`, valeur en `typography.numeric` (64 dp).
- `NumericKeypad` — clavier intégré à `keypadKey`, pour ne pas dépendre du clavier système.
- `ActionBar` — barre d'action fixe dans la zone de pouce, un seul bouton `commit`.

Ces trois-là respectent les deux portes de contraste (WCAG AA **et** écart de luminance
≥ 0,75) et la règle « un seul orange par écran ».

### 4.4 Ce qu'on ne touche pas

Le socle de synchronisation, le décodage de session (avec son piège `base64url` sur
Hermes), la persistance imbriquée et sa liste noire `mutations`. Ce sont des morceaux
délicats, documentés, qui fonctionnent.

---

## 5. Roadmap par lots

| Lot | Contenu | Pourquoi cet ordre |
|---|---|---|
| **1 — Socle** | Primitives de design (D4), règle de navigation (D5) + son test, 12 `tagTypes`, extension de la file | Tout le reste s'appuie dessus ; le construire après serait le reconstruire |
| **2 — Sanitaire** | 24 endpoints, traitements, visites véto, programmes, annuaire, catalogue | Le plus gros manque, et le plus proche du terrain |
| **3 — Ferme & équipe** | Créer une ferme, modifier, supprimer ; ajouter un membre, rôles, mot de passe | Débloque l'autonomie complète d'un propriétaire |
| **4 — Stocks** | Détail article repensé, mouvements, seuils, réception partielle, éditeur de formule | Contient trois des neuf écrans à repenser |
| **5 — Commerce & clients** | CRUD client, livraisons, paiements, annulations | |
| **6 — Finance** | Avances, paramètres de salaire, génération mensuelle, édition de dépense | |
| **7 — Œufs & réglages** | Stock de plateaux, calibres, créneaux, réglages ponte | |
| **8 — Finitions** | Sélecteur de période, visite guidée, `SyncStatusBar` monté | |

---

## 6. Détail — Lot 1 (socle)

### 6.1 Primitives

| Composant | Fichier | Contrat |
|---|---|---|
| `Counter` | `src/components/field/Counter.tsx` | `value`, `onChange`, `step`, `min`, `max`, `label`. Pavés 96 dp, valeur 64 dp mono, appui long = ×10 |
| `NumericKeypad` | `src/components/field/NumericKeypad.tsx` | `value`, `onChange`, `maxLength`, `allowDecimal`. Touches 64 dp, effacement, pas de clavier système |
| `ActionBar` | `src/components/field/ActionBar.tsx` | Un seul enfant `commit`, hauteur `actionBarHeight`, ancrée en zone de pouce |

### 6.2 Règle de navigation

- Ajout de `assertEveryScreenIsReachable` — un test qui parcourt `app/(field)/**`,
  extrait les routes, et vérifie que chacune figure dans `DRAWER_ITEMS` ou
  `SCREEN_TO_TAB`, ou est explicitement listée comme sous-écran (détail d'un parent).
- Ce test aurait attrapé `file.tsx`.

### 6.3 `tagTypes`

Les 12 manquants ajoutés au `baseApi` mobile, sans endpoint encore — ils sont la
condition d'invalidation correcte des lots suivants.

### 6.4 Critères d'acceptation du lot 1

1. Les trois primitives existent, testées, et respectent les deux portes de contraste.
2. Le test de navigation passe, et échoue si on ajoute un écran sans l'enregistrer.
3. `npx tsc --noEmit` propre, suite mobile verte.
4. Un écran de saisie existant (`mortalite.tsx`) est migré sur `Counter` +
   `NumericKeypad` + `ActionBar` — preuve que les primitives tiennent en usage réel,
   et pas seulement en test.

---

## 7. Ce que cette spec ne décide pas

- **La génération de PDF sur mobile** (D2) — chantier distinct, dépend d'un choix
  serveur ou Bluetooth.
- **Le déclenchement du portage vers le hors-ligne des écrans d'argent** — exclu par D1
  option B, à reconsidérer seulement avec une stratégie d'idempotence côté serveur.
- **`SyncStatusBar`** — construit, testé, monté nulle part. La direction de design le
  veut « toujours visible » ; le monter change la mise en page de chaque écran. Reporté
  au lot 8, délibérément.
