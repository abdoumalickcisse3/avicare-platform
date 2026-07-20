# B7 — Direction de design « mode terrain »

> Sprint B7, tâche 1. Direction visuelle et tokens de l'application mobile React Native.
> Implémentation : `mobile/src/theme/tokens.ts`, `mobile/src/theme/index.ts`.
>
> Socle porté sans discussion depuis `docs/10-design-system.md` : palette de marque,
> échelle 4dp, cibles 44×44, boutons 48dp, ratios de contraste mesurés.
> Ce document ne traite que **ce que doc 10 ne pouvait pas traiter**, parce qu'il a été
> écrit pour du web responsive assis, pas pour un poulailler.

---

## Table des matières

1. [Thèse visuelle](#1-thèse-visuelle)
2. [Les cinq décisions terrain](#2-les-cinq-décisions-terrain)
3. [Hiérarchie des écrans](#3-hiérarchie-des-écrans)
4. [Contraste — le modèle à deux portes](#4-contraste--le-modèle-à-deux-portes)
5. [Anatomie du compteur](#5-anatomie-du-compteur)
6. [Les trois états de synchronisation](#6-les-trois-états-de-synchronisation)
7. [Écarts assumés vis-à-vis de doc 10](#7-écarts-assumés-vis-à-vis-de-doc-10)
8. [Ce que ce document ne décide pas](#8-ce-que-ce-document-ne-décide-pas)

---

## 1. Thèse visuelle

### Le sujet

L'utilisateur n'est pas devant un tableau de bord. Il est debout dans un bâtiment
d'élevage, à Thiès ou à Sangalkam, une main sur un seau, de la poussière sur l'écran,
et il compte des bêtes mortes. Ce qu'il remplace en installant AviCare, ce n'est pas
un logiciel : c'est **la feuille de relevé scotchée à la porte du poulailler** —
un papier quadrillé, des colonnes tracées au marqueur, des chiffres écrits gros,
des bâtons pour compter.

C'est de là que vient la direction, et pas d'un langage d'app générique.

### La direction — « la feuille de poulailler »

**Filets noirs épais sur blanc, chiffres énormes, couleur seulement là où elle signale.**

- **Blanc plein**, pas de gris de fond, pas de cartes flottantes. Une feuille.
- **Filets structurels de 2dp en `neutral-700`**, pas des bordures de 1dp en gris clair.
  Un filet doit se voir comme un trait de marqueur, à bout de bras, dans la poussière.
- **Le chiffre est le héros.** 64dp, chasse fixe, graisse 700. Sur un écran de saisie,
  la seule chose que l'éleveur regarde est le nombre en cours ; tout le reste est
  du décor de service.
- **La couleur ne décore jamais.** Trois emplois autorisés : le vert d'accumulation,
  l'orange de validation, le rouge d'échec. Rien d'autre n'est coloré.

C'est le contraire d'un tableau de bord : pas de dégradé, pas d'ombre, pas de carte,
pas d'icône décorative. Le risque esthétique assumé est la **dureté** — l'interface
est franchement graphique, presque brutale, là où le web AviCare est chaleureux et
arrondi. Ce n'est pas une incohérence de marque : c'est le même produit dans deux
postures, le bureau et le terrain. La palette, elle, est rigoureusement identique.

### L'élément signature

**Le bandeau de synchronisation**, pleine largeur, sous le titre, présent sur tous
les écrans terrain, jamais réductible à une icône. C'est le seul élément qui ne
disparaît jamais, et c'est lui qui porte la promesse centrale de l'app : *ton travail
est parti, ou il est en sécurité chez toi en attendant*. Détail en §6.

### Voix

Reprise de doc 10 §1 (direct, concret), avec une contrainte de plus : **des phrases
lisibles d'un coup d'œil**, jamais deux lignes là où une suffit.

| Au lieu de | Écrire |
|---|---|
| « Enregistrement en cours de synchronisation » | « Envoi en cours » |
| « Aucune donnée disponible » | « Aucun lot actif » |
| « Erreur lors de la soumission » | « Refusé : effectif insuffisant » |
| « Voulez-vous vraiment supprimer ? » | « Supprimer cette saisie ? » |

Les échecs disent **ce qui s'est passé**, pas qu'ils sont désolés. Le `detail` du
Problem Details RFC 7807 (doc 08 §7.3) est affiché tel quel : le serveur sait mieux
que l'app pourquoi il a refusé.

---

## 2. Les cinq décisions terrain

### 2.1 Lisibilité en plein soleil

**La décision : pas de « mode haute luminosité ». La palette terrain *est* le mode
haute luminosité, et le critère de validation d'un couple de couleurs devient double.**

Pourquoi pas un mode : un basculement est une chose de plus à trouver avec des doigts
humides, il ne peut pas augmenter le rétroéclairage au-delà du maximum système, et il
crée deux palettes à maintenir dont une seule sera testée. Une app dont le mode par
défaut est illisible sur le terrain est une app ratée, pas une app à options.

Le fond technique, et c'est le point non évident. Sous forte lumière ambiante, l'écran
réfléchit une luminance parasite **constante** vers l'œil, qui s'ajoute *aux deux*
termes du rapport de contraste. Or ajouter une même constante `v` au numérateur et au
dénominateur **écrase le rapport vers 1**. Conséquence directe :

> Le ratio WCAG ordonne mal les couleurs en plein jour. Ce qui survit au voile solaire
> n'est pas le *rapport* de luminance, c'est l'**écart absolu** ΔL.

Modèle retenu : `v = (r · E / π) / L_max`, avec `r ≈ 0.05` (réflectance d'un écran
poussiéreux), `L_max ≈ 450 nits` (Android milieu de gamme, l'équipement réel de la
cible). Cela donne `v ≈ 0.18` en intérieur de bâtiment (5 000 lux), `v ≈ 0.40` sous
auvent ou porte de poulailler (11 000 lux), `v ≈ 0.53` en ombre ouverte (15 000 lux).
En plein soleil non ombragé (100 000 lux) `v ≈ 3.5` : **aucune palette ne sauve cette
situation**, l'éleveur se met à l'ombre, et c'est très bien — on ne conçoit pas pour ce cas.

**La cible de conception est `v = 0.40`.**

D'où la règle à deux portes, appliquée à chaque couple du thème :

| Porte | Critère | Justification |
|---|---|---|
| 1 — WCAG | ratio ≥ 4.5:1 (texte courant), ≥ 3:1 (≥ 18dp) | Accessibilité, doc 10 §9 |
| 2 — Soleil | **ΔL ≥ 0.75** | Survit au voile de `v = 0.40` avec un rapport résiduel ≥ 2.3:1 |

Le seuil ΔL ≥ 0.75 n'est pas normatif — il n'existe aucune norme pour ça. Il est calibré
sur la table du §4 : c'est la valeur qui sépare proprement les couples restant exploitables
à `v = 0.40` (≥ 2.3:1 résiduel) de ceux qui s'effondrent sous 2:1.

Corollaires opérationnels, tous vérifiables en revue :

- **`neutral-500` est banni du mode terrain** comme couleur de texte. Il passe WCAG
  (4.80:1) mais ne laisse que 2.34:1 sous voile. Le texte secondaire terrain est
  `neutral-700` (10.27:1, ΔL 0.948).
- **Le texte principal est `neutral-900` sur blanc pur**, pas `neutral-800` sur
  `neutral-50`. On dépense le maximum d'écart disponible : 17.49:1, ΔL 0.990.
- **Aucun filet de 1dp en gris clair.** `neutral-200` sur blanc, c'est 1.26:1 — un
  filet invisible. Les séparations structurelles sont des filets 2dp `neutral-700`,
  ou de l'espace blanc. Voir §7 sur l'abandon des cartes.
- **Graisse minimale 500** pour le corps de texte, 600 pour les libellés, 700 pour les
  chiffres. Un trait fin est la première victime de l'éblouissement.
- **Aucune information portée par la couleur seule.** La saturation se délave avant la
  luminance ; et cela règle le daltonisme au passage. Chaque état a icône + mot + couleur.

### 2.2 Mains gantées, sales ou humides

**La décision : trois paliers de cible, et une asymétrie délibérée entre l'incrément
et le décrément.**

44×44 est un plancher d'accessibilité, calibré sur un doigt nu et un usage occasionnel.
La pulpe d'un index adulte fait 10–14 mm ; sous gant elle s'élargit d'environ un quart
et perd en précision. Pour un bouton pressé cinquante fois d'affilée, le bon critère
n'est pas « atteignable » mais « atteignable sans regarder, cinquante fois de suite,
sans une seule erreur ».

| Token | Valeur | Usage |
|---|---|---|
| `touch.min` | 44 | Plancher, contrôles incidents (doc 10 §9) |
| `touch.button` | 48 | Bouton standard hors saisie (doc 10 §9) |
| `touch.field` | 64 | Tout contrôle d'un écran de saisie |
| `touch.counterPrimary` | **96** | Pavé `+1` — ≈ 15 mm, la largeur d'un pouce ganté |
| `touch.counterSecondary` | 64 | Pavé `−1` |
| `touch.keypadKey` | 64 | Touche du pavé numérique intégré |
| `touch.gapDanger` | 24 | Écart minimal entre cibles aux effets opposés |

**L'asymétrie 96 / 64 est le vrai contenu de cette décision.** Le `+1` est pressé des
dizaines de fois ; le `−1` est une correction rare. Leur donner la même taille et les
mettre côte à côte, c'est inviter l'erreur exactement là où elle est la plus coûteuse :
un `−1` accidentel corrompt le comptage **silencieusement**, sans rien qui alerte.
Différence de taille, différence de couleur, différence de position, et 24dp de vide
entre les deux : quatre signaux redondants pour une erreur qu'on ne peut pas rattraper.

Deux interdits qui découlent du même raisonnement :

- **Aucun geste de balayage pour une action destructive.** Un doigt humide génère des
  touchers fantômes et des glissements involontaires.
- **Aucun appui long comme chemin unique.** Il exige un contact soutenu et de qualité,
  précisément ce qu'un gant poussiéreux ne garantit pas. Tout est atteignable en un
  appui franc.

### 2.3 Usage à une main

**La décision : contrat de zone du pouce. Le tiers bas de l'écran porte toutes les
actions primaires ; le haut de l'écran est en lecture seule.**

L'autre main porte un seau. Sur un téléphone de 6,5 pouces tenu à une main, l'arc du
pouce couvre confortablement le bas et le centre, difficilement le haut, et pas du tout
le coin haut opposé à la main.

- `layout.thumbZoneRatio = 0.35` — les 35 % inférieurs sont la zone d'action.
- **Barre d'action basse persistante** (`layout.actionBarHeight = 88`, plus l'inset de
  sécurité système, jamais absorbé dedans) portant l'unique action de validation.
- **Le `+1` est aligné à droite, le `−1` à gauche.** Biais droitier assumé : le bas-droit
  est la région la plus confortable de l'arc pour un droitier. Effet secondaire heureux,
  cela sépare physiquement les deux contrôles et renforce §2.2.
- **Pas de bouton « Enregistrer » en haut à droite.** C'est le motif mobile le plus
  répandu, et c'est le point le moins accessible de l'écran à une main. Écart explicite
  vis-à-vis des conventions de dialogue de doc 10 §6.
- Le haut porte le titre, l'identité du lot et le bandeau de synchronisation.

**Exception unique et assumée** : le bandeau de synchronisation est tapable alors qu'il
est en haut. Justification — c'est une navigation non destructive, il est dimensionné à
44dp de haut sur toute la largeur (donc cible légale), et la file est de toute façon
accessible autrement depuis le layout `(field)`. Un raté d'appui ne coûte rien.

### 2.4 Ergonomie de la saisie numérique

**La décision : le compteur est le mode de saisie par défaut des quatre formulaires.
Le clavier est une issue de secours, jamais le chemin principal — et quand il faut
vraiment un clavier, c'est un pavé intégré à l'écran, pas celui du système.**

Le clavier numérique système masque la moitié basse de l'écran — exactement la zone du
pouce définie en §2.3 — et se referme mal avec des doigts humides. Il est structurellement
incompatible avec les deux décisions précédentes.

Le pas d'incrément suit **l'unité réelle de manipulation du métier**, pas l'entier :

| Formulaire | Saisie | Pas | Pourquoi ce pas |
|---|---|---|---|
| Mortalité | Compteur, départ 0 | `+1` | On trouve les bêtes une par une. Le compteur monte 1, 2, 3… et c'est exactement le cumul local du jour de doc 08 §10 |
| Journalier — aliment | Compteur | `+5 kg` | L'aliment se manipule en sacs et en seaux, jamais au gramme |
| Journalier — eau | Compteur | `+5 L` | Idem, abreuvoirs |
| Collecte d'œufs | Compteur double | `+30` (plateau) et `+1` | **Un plateau, c'est 30 œufs.** L'éleveur compte des plateaux, puis les unités du plateau entamé. Compter 187 œufs un par un serait absurde |
| Pesée | **Pavé numérique intégré** | — | Une pesée vaut ~1 850 g sans pas naturel. Le compteur est le mauvais outil ici, on l'assume |

La pesée est donc la seule exception, et elle utilise un **pavé numérique dessiné dans
l'écran**, dans la zone du pouce, touches de 64dp : toujours visible, aucun problème de
fermeture, touches 50 % plus grandes que celles du clavier système.

Deux règles transverses :

- **Jamais d'autofocus sur un champ texte au montage d'un écran** — cela fait surgir le
  clavier système par-dessus la zone du pouce.
- La lecture du compteur est en `typography.numeric` : 64dp, chasse fixe, graisse 700,
  chiffres tabulaires. Les chiffres ne doivent pas danser quand la valeur change.

### 2.5 Le statut de synchronisation comme élément de premier plan

**La décision : un bandeau permanent pleine largeur, qui fusionne connectivité et file
d'attente en une seule phrase, avec une priorité d'affichage explicite.**

Doc 08 §4 demande deux choses : un indicateur en ligne / hors ligne, et un compteur
d'actions en attente. Les afficher séparément serait fidèle au code et faux du point de
vue de l'utilisateur : **l'éleveur ne se demande pas s'il a du réseau, il se demande si
son travail est en sécurité.** « Hors ligne » et « 5 en attente » sont deux moitiés d'une
seule information. Le bandeau n'en affiche qu'une.

Traitement visuel détaillé en §6.

---

## 3. Hiérarchie des écrans

Les neuf écrans de doc 08 §4 se répartissent en trois postures, avec trois traitements
visuels distincts.

| Posture | Écrans | Traitement |
|---|---|---|
| **Vestibule** | Login, sélecteur de ferme | Seuls écrans autorisant une surface encartée et le logo. On n'y est pas encore dans le poulailler. Densité normale, corps 17dp |
| **Navigation** | Liste des lots, essentiels du lot, file de sync | Feuille blanche, lignes séparées par filets 2dp, chiffres clés en `numericSm` (32dp). Aucune carte |
| **Saisie** | Journalier, mortalité, pesée, œufs | Le compteur occupe le centre. Écran mono-tâche : une valeur, un compteur, un bouton de validation. Rien d'autre |

Structure commune d'un écran de saisie, du haut vers le bas :

```
┌──────────────────────────────────────────┐
│ ← Lot B-12 · Chair · J23                 │  identité, lecture seule
├──────────────────────────────────────────┤
│ ▌ Hors ligne — 5 en attente          ›   │  bandeau sync, 44dp
├──────────────────────────────────────────┤
│                                          │
│  MORTALITÉ DU JOUR                       │  label, 14dp capitales
│                                          │
│              7                           │  numeric, 64dp mono
│                                          │
│  Effectif après saisie : 1 243           │  bodyMd, neutral-700
│                                          │
│                                          │
├──────────────────────────────────────────┤
│  ┌────┐                      ┌────────┐  │
│  │ −1 │                      │  + 1   │  │  64dp / 96dp — zone pouce
│  └────┘                      └────────┘  │
├──────────────────────────────────────────┤
│  ┌────────────────────────────────────┐  │
│  │          Enregistrer               │  │  barre d'action, 88dp
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

L'ordre haut → bas suit le coût d'accès : ce qu'on lit est en haut, ce qu'on touche
le plus est en bas à droite.

---

## 4. Contraste — le modèle à deux portes

Ratios calculés selon WCAG 2.1 (luminance relative sRGB). Colonne `ΔL` = écart absolu
de luminance relative. Colonnes `v=` = rapport résiduel sous voile solaire selon le
modèle du §2.1.

| Couple | WCAG | ΔL | v=.18 | v=.40 | v=.53 | Verdict |
|---|---:|---:|---:|---:|---:|---|
| `neutral-900` sur blanc | **17.49** | 0.990 | 5.12 | 3.15 | 2.68 | ✅ Retenu — texte principal |
| `earth` sur blanc | **15.22** | 0.981 | 4.94 | 3.09 | 2.64 | ✅ Retenu — texte sur bandeau |
| `neutral-700` sur blanc | **10.27** | 0.948 | 4.36 | 2.89 | 2.50 | ✅ Retenu — texte secondaire, filets |
| `primary-800` sur `primary-50` | **10.86** | 0.875 | 4.26 | 2.79 | 2.41 | ✅ Retenu — badge succès |
| blanc sur `primary-600` | **6.44** | 0.887 | 3.59 | 2.58 | 2.28 | ✅ Retenu — pavé `+1` |
| `primary-600` sur blanc | **6.44** | 0.887 | 3.59 | 2.58 | 2.28 | ✅ Retenu — liens, liseré |
| `success-dark` sur `success-light` | **8.30** | 0.841 | 3.85 | 2.63 | 2.30 | ✅ Retenu — badges |
| `warning-dark` sur `warning-light` | **8.15** | 0.827 | 3.80 | 2.60 | 2.28 | ✅ Retenu — badges |
| `error-dark` sur `error-light` | **8.20** | 0.755 | 3.65 | 2.50 | 2.19 | ✅ Retenu — lignes en échec |
| blanc sur `error` #DC2626 | **4.83** | 0.833 | 3.09 | 2.35 | 2.11 | ✅ Retenu — bandeau échec |
| `earth` sur `accent-400` | **6.79** | **0.400** | 2.60 | **1.85** | 1.67 | ⚠️ **Restreint** — voir ci-dessous |
| `earth` sur `accent-500` | 5.33 | **0.299** | 2.20 | **1.64** | 1.50 | ⚠️ Restreint — état pressé uniquement |
| `neutral-500` sur blanc | 4.80 | 0.831 | 3.08 | 2.34 | 2.11 | ❌ **Rejeté en mode terrain** |
| blanc sur `primary-500` | **4.23** | 0.802 | 2.87 | 2.24 | 2.03 | ❌ **Rejeté — échoue WCAG** |
| `neutral-300` filet sur blanc | 1.49 | 0.345 | 1.31 | — | — | ❌ Rejeté — filet invisible |
| `neutral-200` filet sur blanc | 1.26 | 0.214 | 1.17 | — | — | ❌ Rejeté — filet invisible |
| blanc sur `accent-400` | **2.24** | 0.581 | 1.90 | 1.67 | 1.58 | ⛔️ **Interdit** (doc 10 §9) |

### Trois résultats qui méritent d'être soulignés

**1. Le classement WCAG et le classement soleil se contredisent.** `earth` sur
`accent-400` obtient 6.79:1 — niveau AAA — mais c'est l'un des **pires** couples de la
table en plein jour (1.85 résiduel), parce que les deux couleurs vivent dans la même
bande de luminance moyenne (ΔL = 0.400). À l'inverse, blanc sur `error` passe WCAG de
justesse (4.83:1) et se comporte **mieux** sous voile (2.35). C'est la démonstration
que la deuxième porte n'est pas une précaution rhétorique.

**2. Conséquence sur l'orange de marque, sans y toucher.** L'orange reste inchangé, et
la paire n'est jamais inversée (§interdit doc 10 §9). Ce qui change est **son périmètre
d'emploi** :

> L'orange peut porter un **libellé mémorisé par sa position** (le bouton « Enregistrer »
> en bas d'écran). Il ne peut **jamais** porter une **valeur à lire** — un nombre, un
> statut que l'utilisateur n'a pas déjà en tête.

Deux mitigations concrètes en découlent :
- Le bouton de validation reçoit une **bordure `earth` de 2dp**. La bordure rétablit une
  arête à fort ΔL (`earth` sur blanc, ΔL 0.981) : même si l'aplat orange se délave, la
  **forme** du bouton reste franche.
- Le bandeau « en attente » n'écrit pas son texte sur de l'orange. L'orange y devient un
  **liseré de 6dp**, et le texte est en `neutral-900` sur blanc. La couleur identifie
  l'état à la périphérie du regard, le texte se lit sur le meilleur couple disponible.
  C'est un meilleur design *et* il passe les deux portes.

**3. `primary-500` n'est pas un fond de texte.** Blanc dessus donne 4.23:1 — sous le
seuil AA. C'est `primary-600` qui est la couleur de fond des actions vertes. Ce point
n'était pas explicite dans doc 10 ; il l'est maintenant.

### Séparation sémantique des actions

La table ci-dessus produit une règle mémorisable, dérivée des mesures et non de l'habitude :

| Rôle | Couple | Sens |
|---|---|---|
| **Accumuler** | blanc sur `primary-600` | Répété, réversible, doit survivre au soleil → le meilleur couple fort disponible |
| **Valider** | `earth` sur `accent-400` | Une fois par écran, position fixe, libellé mémorisé → l'orange de marque est acceptable ici |
| **Échouer** | blanc sur `error` | Demande une action humaine → seul état en aplat plein |

Vert = j'ajoute. Orange = j'envoie. Rouge = ça a échoué.

---

## 5. Anatomie du compteur

Le composant `Compteur` est le cœur de l'app. Les tâches suivantes l'implémentent ;
voici son contrat visuel.

```
     ┌───────────────────────────────────────────────┐
  A  │  MORTALITÉ DU JOUR                            │  label 14/600 caps, neutral-700
     │                                               │
  B  │                    7                          │  numeric 64/700 mono tabulaire
     │                                               │  neutral-900
  C  │  Effectif après saisie : 1 243                │  bodyMd 15/500, neutral-700
     │                                               │
     │                                               │
     │   ┌──────┐                    ┌────────────┐  │
  D  │   │  −1  │                    │    + 1     │  │  E
     │   └──────┘                    └────────────┘  │
     └───────────────────────────────────────────────┘
         64×64                          96×96
         blanc, bordure 2dp             primary-600, texte blanc
         neutral-700                    bordure primary-800
         texte neutral-900

         └────────── ≥ 24dp d'écart ──────────┘
```

| Zone | Règle |
|---|---|
| **A — Libellé** | Ce qu'on compte. Toujours présent, jamais un placeholder dans le champ |
| **B — Valeur** | Le héros. Chiffres tabulaires : la valeur change sans que le chiffre bouge latéralement. Animation limitée à `motion.fast` (120 ms), une translation verticale courte. Rien de plus : cinquante appuis d'affilée avec une animation bavarde deviennent insupportables |
| **C — Conséquence** | **Obligatoire.** Le compteur affiche toujours l'effet de la saisie sur l'état du lot. C'est la seule protection contre une erreur de comptage : l'éleveur reconnaît « 1 243 » comme faux bien avant de reconnaître « 7 » comme faux |
| **D — Décrément** | 64dp, secondaire, à gauche. Désactivé à zéro (jamais de valeur négative). Un appui = un pas |
| **E — Incrément** | 96dp, `action.accumulate`, à droite dans l'arc du pouce. Un appui = un pas |

**Pas de saisie par maintien enfoncé** (« appui long qui accélère »). Elle produit des
valeurs fausses non détectables, exige un contact soutenu que le gant ne garantit pas,
et n'est pas nécessaire : le pas est déjà calibré sur l'unité métier (§2.4).

**Issue de secours clavier** : un lien discret « saisir la valeur » sous la zone C ouvre
le pavé numérique intégré, prérempli avec la valeur courante. Discret parce que c'est le
chemin de rattrapage, pas le chemin nominal — sauf pour la pesée, où le pavé est direct.

---

## 6. Les trois états de synchronisation

### Principe

Un bandeau, `layout.syncRibbonHeight = 44`, pleine largeur, sous le titre, sur tous les
écrans du groupe `(field)`. Il est **toujours là** : un indicateur qui apparaît et
disparaît apprend à l'utilisateur à ne pas le regarder.

Chaque état porte **trois signaux redondants** : un liseré de couleur de 6dp, une icône,
et un mot. La couleur seule ne suffit jamais — daltonisme, et délavage de la saturation
sous forte lumière (§2.1).

### Les trois traitements

| État | Liseré | Fond | Texte | Icône | Ratio |
|---|---|---|---|---|---|
| **Synchronisé** | `primary-600` | blanc | `neutral-900` | ✓ | 17.49:1 |
| **En attente** | `accent-400` | blanc | `neutral-900` | ↑ | 17.49:1 |
| **Échec** | `error-dark` | **`error` #DC2626** | blanc | ! | 4.83:1 |

**Pourquoi l'échec seul change de fond.** Synchronisé et en attente sont *informatifs* :
on les lit quand on y pense. L'échec est *impératif* : il exige une intervention humaine
et il ne doit pas pouvoir être manqué. C'est le seul état qui modifie le champ coloré de
l'écran, donc le seul que la vision périphérique attrape sans lecture. Cette hiérarchie
— calme / marqué / alarmant — est ce qui fait que l'alarme conserve sa valeur.

**Pourquoi « synchronisé » reste discret.** La tentation est d'afficher un grand bandeau
vert rassurant. C'est une erreur : si l'état normal, qui occupe 95 % du temps, crie, il
devient du bruit de fond, et l'état anormal ne se détache plus. On paie le rassurement
permanent par la perte du signal utile.

### La règle de fusion et sa priorité

Le bandeau ne montre qu'**une** phrase. Priorité stricte, du plus urgent au moins :

| # | Condition | État affiché | Texte |
|---|---|---|---|
| 1 | ≥ 1 ligne en `FAILED` | Échec | « 2 saisies refusées » |
| 2 | File non vide, hors ligne | En attente | « Hors ligne — 5 en attente » |
| 3 | File non vide, en ligne | En attente | « Envoi en cours — 3 restantes » |
| 4 | File vide, hors ligne | Synchronisé | « Hors ligne — tout est envoyé » |
| 5 | File vide, en ligne | Synchronisé | « À jour » |

L'échec l'emporte sur tout le reste, y compris si la synchronisation tourne par ailleurs :
une ligne en `FAILED` ne se débloquera jamais seule (doc 08 §7.3), elle réclame l'éleveur.

Le cas 4 mérite d'être noté : **hors ligne avec une file vide n'est pas un problème** et
ne doit pas être signalé comme tel. Beaucoup d'apps affichent une alerte rouge dès la
perte du réseau. Ici, être hors ligne sans travail en attente est un état parfaitement
sain — c'est même la situation normale d'un poulailler sans couverture.

Le bandeau est tapable et mène à l'écran file (`app/(field)/file.tsx`), où chaque ligne
en échec affiche le `detail` RFC 7807 du serveur et les actions « Corriger » / « Supprimer ».

---

## 7. Écarts assumés vis-à-vis de doc 10

Tout ce qui n'est pas listé ici est porté à l'identique.

| # | Doc 10 dit | Le mobile fait | Justification |
|---|---|---|---|
| 1 | Fond app `neutral-50`, cartes blanches bordées `neutral-200` r12 | **Surface unique blanche, pas de cartes** en mode terrain ; séparation par filets 2dp `neutral-700` et espace | La carte achète un groupement visuel au prix d'une bordure 1dp qui disparaît en plein jour (1.26:1) et d'un padding horizontal qui vole de la largeur aux cibles tactiles. Les deux coûts sont inacceptables ici. Cartes conservées sur login et sélecteur de ferme (§3) |
| 2 | Texte secondaire `neutral-500` | **`neutral-700`** | `neutral-500` passe WCAG (4.80) mais tombe à 2.34 sous voile (§4) |
| 3 | Texte principal `neutral-800` | **`neutral-900`** sur blanc pur | On dépense tout l'écart de luminance disponible : ΔL 0.990 contre 0.981 |
| 4 | Corps par défaut 14dp, graisse 400 | **17dp, graisse 500** ; plancher 13dp | Lecture à bout de bras, avec éblouissement, écran poussiéreux |
| 5 | Ombres `shadow-sm` → `shadow-xl` | **Aucune ombre** | Sans cartes, plus rien à surélever. Une ombre est invisible en plein jour de toute façon. `tokens` n'expose délibérément aucune ombre |
| 6 | Boutons mobile 48dp | 48 conservé hors saisie ; **64 / 96** en saisie | 48 est un plancher d'accessibilité, pas un confort de terrain (§2.2) |
| 7 | CTA primaire = `accent-400` partout | Orange réservé à **la validation** ; l'accumulation est en `primary-600` | L'orange échoue la porte soleil et ne peut porter une valeur à lire (§4) |
| 8 | Bouton de dialogue en haut à droite (conventions §6) | **Barre d'action basse persistante** | Zone du pouce (§2.3) |
| 9 | Lucide, icônes 20/24dp | Icônes **24dp minimum**, 28dp dans le bandeau sync | Même raison que l'écart 4 |
| 10 | Contraste = WCAG AA | **WCAG AA + ΔL ≥ 0.75** | §2.1 et §4 |

Aucun écart ne touche à la **palette de marque** : les hex de doc 10 §2 sont repris à
l'identique, y compris `accent-400` et `earth`. Les écarts portent sur l'emploi des
couleurs, jamais sur les couleurs elles-mêmes.

---

## 8. Ce que ce document ne décide pas

- **Les composants et les écrans** — tâches 3 → 14. Ce document fixe la direction et
  les tokens, pas le code d'interface.
- **Le chargement des polices.** `tokens.fontFamily` déclare les noms logiques
  `Outfit` et `JetBrainsMono` ; leur enregistrement via `expo-font` appartient à la
  tâche 3. Tant qu'elles ne sont pas chargées, React Native retombe sur la police
  système, ce qui reste lisible mais perd les chiffres tabulaires.
- **Le mode sombre.** Hors périmètre B7. La nuit dans un poulailler se règle avec une
  lampe, pas avec un thème. À reconsidérer si les ramassages nocturnes en ponte
  s'avèrent fréquents.
- **Les icônes métier custom** (poulet, œuf, lot) — doc 10 §5 les prévoit pour le web,
  le mobile les réutilisera.
- **L'internationalisation.** Wolof en V2 (doc 06). L'échelle typographique et les
  cibles tactiles n'en dépendent pas ; les longueurs de libellé, si — d'où la
  préférence pour les libellés courts (§1, voix).

---

## 9. Documents associés

- `docs/10-design-system.md` — socle : palette, typo, espacement, accessibilité
- `docs/08-mobile-react-native.md` — §4 écrans, §7.3 classification des échecs, §10 mortalité
- `mobile/src/theme/tokens.ts` — implémentation
- `mobile/src/theme/index.ts` — façade d'import

---

_Tâche 1 du Sprint B7. Les ratios de la §4 sont calculés selon WCAG 2.1 ; le modèle de
voile solaire de la §2.1 est un modèle de conception, pas une norme, et ses hypothèses
(réflectance 5 %, 450 nits) sont explicites pour pouvoir être contestées._
