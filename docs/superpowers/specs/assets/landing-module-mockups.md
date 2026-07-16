# Mockups animés des sous-pages Fonctionnalités — valeurs figées

> Décision client (2026-07-16) : **pas de captures d'écran**. Les blocs « capacité »
> des 5 sous-pages sont des **recréations HTML/CSS** de l'UI réelle d'AviCare.
> Référence visuelle : `landing/src/assets/fonctionalités/*.png` (captures du produit réel).
>
> **Pourquoi** : les captures pèsent 2,9 Mo et sont illisibles à 375 px (dashboard 3024 px),
> alors que la cible est mobile-first. Et le jeu de démo affichait des chiffres impossibles
> (taux de ponte 231 %, IC 0.139) qui décrédibiliseraient la page.

## Règles

1. **Les libellés sont ceux de l'app réelle, verbatim** (colonne « Libellé UI » ci-dessous).
   Ne pas inventer de libellé : si un libellé manque ici, prendre celui de la capture.
2. **Les chiffres ci-dessous sont figés et réalistes** (benchmarks avicoles réels).
   Ne pas les modifier, ne pas en inventer d'autres.
3. Les nombres s'affichent en **JetBrains Mono** (règle : mono = chiffres uniquement).
4. Animation : compteurs au scroll (réutiliser `CountUp.astro` de la T2) + tracé de courbe.
   **Respecter `prefers-reduced-motion`** : valeur finale directement, courbe déjà tracée.
5. **Lisible à 375 px** : c'est le critère d'acceptation. Un mockup qui déborde ou
   devient illisible sur mobile est un échec, pas un détail.
6. Ces mockups représentent notre propre produit — ils doivent rester **fidèles à l'UI réelle**
   (mêmes composants, même hiérarchie). Ne pas inventer d'écran qui n'existe pas.

---

## 1. Élevage — mockup « fiche lot »

D'après `Capture d’écran 2026-07-16 à 18.37.38.png`. **Correction** : la capture montrait une
souche pondeuse (Lohmann Brown) classée en poulets de chair, et un IC de 0.139 (impossible).

En-tête : `Cobb 500 #2` · badge `Actif` · sous-titre `Cobb 500 · Jour 31 · 871 sujets`

| Libellé UI | Valeur | Note |
|---|---|---|
| Effectif actuel | `871` sujets | départ 900, mortalité 3,2 % |
| Progression (jour) | `31` / 42 | |
| GMQ (vs objectif) | `56` g/j | Cobb 500 réaliste (50-60) |
| IC (FCR) | `1.68` | Indice de consommation — réaliste (1,5-1,8) |

Carte verte foncée « PRÉVISION / Maturité estimée » : `26 juil. 2026` · `Jours restants : 10` ·
badge `Dans l'objectif`.

Courbe de croissance : « Poids moyen (g) réel vs objectif souche ». Réel J0→J31 : 42 → 1 750 g,
**collé à la courbe objectif, légèrement au-dessus en fin** (la capture montrait un réel
absurdement au-dessus de l'objectif). Objectif J42 ≈ 2 800 g. Axe Y : 0 / 700 / 1400 / 2100 / 2800 g.

## 2. Sanitaire — mockup « suivi sanitaire »

D'après `Capture d’écran 2026-07-16 à 18.38.08.png` — **la seule capture exploitable telle quelle**.
Reprendre ses valeurs.

| Libellé UI | Valeur | Accent |
|---|---|---|
| Vaccins en attente | `3` — Doses en retard | rouge |
| Traitements actifs | `0` — Aucun | bleu |
| Délais d'attente | `—` — Aucun délai | orange |
| Prochaine visite véto | `—` — Aucun suivi | violet |

Liste « Historique sanitaire récent » (3 lignes, verbatim de la capture) :
- `Vaccin Newcastle Clone30 en retard` · `Lot Mbour · 2 j de retard` · `14 juil. 2026`
- `Vaccin Gumboro 228e en retard` · `Mbalo · 3 j de retard` · `13 juil. 2026`
- `Vaccin Gumboro D78 en retard` · `Lot Mbour · 9 j de retard` · `07 juil. 2026`

## 3. Stocks — mockup « formules d'aliment »

D'après `Capture d’écran 2026-07-16 à 18.39.06.png`. **Correction** : les formules s'appelaient
« Dem » et « finition » (données de test). Noms propres ici.

Titre : `Formules d'aliment` · sous-titre `Composez vos rations et optimisez vos coûts de production.`

| Formule | Étiquette | Coût | Ingrédients |
|---|---|---|---|
| `Démarrage poulet chair – Cobb 500` | `Démarrage` | `45 000` F CFA / 100 kg | `3 ingrédients · 100%` |
| `Croissance poulet chair – Cobb 500` | `Croissance` | `42 700` F CFA / 100 kg | `3 ingrédients · 100%` |
| `Finition poulet chair – Cobb 500` | `Finition` | `40 400` F CFA / 100 kg | `3 ingrédients · 100%` |
| `Ponte pondeuse – Lohmann Brown` | `Ponte` | `42 150` F CFA / 100 kg | `4 ingrédients · 100%` |

Optionnel (renforce le bloc 2 du copy « ingrédient par ingrédient ») : détail d'une formule —
`Maïs 60%` · `Tourteau d'arachide 32%` · `Prémix ponte 8%`.

## 4. Ventes — mockup « fiche client »

D'après `Capture d’écran 2026-07-16 à 18.39.25.png`. **Correction** : l'encours était à 0 F CFA,
ce qui vide la page de son argument. Client fictif (pas de PII réelle).

En-tête : `Fatou Ndiaye` · badge `Particulier` · badge `Actif`

- **Encours actuel** : `145 000` F CFA · barre de progression à **29 %** ·
  légende `29 % de la limite de 500 000 F CFA`
- Contact : `Thiès` (ne pas afficher de numéro ni d'e-mail réels)

« Historique commercial » (montants cohérents avec un encours de 145 000) :
- `ORD-2026-014` · `12 juil. 2026` · `85 000` F CFA
- `F-2026-011` · `10 juil. 2026` · `145 000` F CFA
- `P-2026-009` · `05 juil. 2026` · `60 000` F CFA
- `F-2026-008` · `03 juil. 2026` · `60 000` F CFA

## 5. Finance — mockup « analytique »

D'après `Capture d’écran 2026-07-16 à 18.39.41.png`. **Correction** : la marge affichée était de
75 % (invraisemblable en aviculture, réel 10-20 %), une ligne « Revenu par lot » était sans nom,
et les catégories manquaient d'accents.

Titre : `Analytique`

| Libellé UI | Valeur |
|---|---|
| Total revenus | `1 240 000` F CFA |
| Total dépenses | `1 012 000` F CFA |
| Marge | `228 000` F CFA (vert) — **18,4 %, réaliste** |

« Détail du revenu » : `Ventes directes` `495 000` F CFA · `Commandes payées` `745 000` F CFA
(somme = 1 240 000 ✓)

« Dépenses par catégorie » (somme = 1 012 000 ✓, **avec accents**) :
- `Aliment` — `742 000` F CFA
- `Poussins` — `180 000` F CFA
- `Vétérinaire / médicaments` — `45 000` F CFA
- `Matériel` — `45 000` F CFA

« Revenu par lot » (**chaque ligne a un nom de lot**) :
- `Cobb 500 #2` — `745 000` F CFA
- `Bâtiment 1 – Lot 12` — `495 000` F CFA

---

## Note produit (hors périmètre landing)

Le taux de ponte à 231,3 % de la capture n'est **pas** un bug de calcul : la formule
(`EggProductionService.java:151`) est juste. C'est le jeu de démo (~680 œufs pour 294 pondeuses).
Mais l'app **accepte et affiche sans avertissement un taux physiquement impossible** (une poule
pond au maximum 1 œuf/jour → plafond 100 %). Un éleveur qui saisit 680 au lieu de 68 n'est alerté
par rien. À considérer : garde-fou de saisie ou avertissement au-delà de 100 %.
