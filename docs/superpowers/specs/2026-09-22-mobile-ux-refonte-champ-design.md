# Design — Refonte UX des écrans de terrain (mobile)

> Spec de cadrage. Sept écrans de référence ont été maquettés et validés un par un avec
> l'utilisateur (Stitch, design system « AviCare Mobile » — vert #3D8B3D, orange #F8961E,
> Outfit/JetBrains Mono, cibles tactiles 48-56dp), après un premier aller-retour raté sur une
> direction trop éloignée de la marque (éditorial/instrument/carnet). Cette spec fige la recette
> commune et couvre, module par module, quel écran est la référence et quels écrans doivent la
> suivre sans repasser par une maquette dédiée.
>
> Origine : plainte concrète sur l'écran d'accueil (« trop de texte », « trop de blocs empilés »,
> « manque de personnalité ») — généralisée aux six autres modules listés par l'utilisateur, dans
> l'ordre où ils ont été traités : Accueil, Ma Ferme, Élevage/lots, Commerce, Stocks, Sanitaire,
> Finance.
>
> Ce qui a déjà été livré séparément et n'est **pas** repris ici : la barre d'onglets en verre
> dépoli façon iOS (`feat/mobile-tabbar-native-blur`, mergée) — gardée telle quelle, avec sa
> logique de rôle (`getVisibleTabs`) et d'onglet actif hors `(tabs)` (`SCREEN_TO_TAB`).

---

## 1. Le point de départ, mesuré

Les sept écrans actuels partagent le même défaut structurel : chaque indicateur individuel
(effectif, mortalité, encours, valeur de stock…) vit dans sa propre carte bordée à ombre
(`borderWidth: 1, borderColor: neutral[200], shadowOpacity`), avec jusqu'à trois lignes de texte
par carte (icône + libellé + valeur + sous-texte). Empilées, ces cartes forment 4 à 9 blocs à
faire défiler avant d'atteindre le contenu réel — mesuré à la lecture de chaque fichier :

| Écran | Fichier | Blocs avant refonte |
|---|---|---|
| Accueil | `app/(field)/(tabs)/home.tsx` | 9 (héros, alertes, 4 tuiles, actions, activité, stock, réseau, comparatif) |
| Ma Ferme | `app/(field)/fermes.tsx` | Héros + 4 cartes KPI + activité en cartes |
| Élevage — liste | `app/(field)/(tabs)/elevage.tsx` | 1 carte bordée à ombre par lot |
| Élevage — détail | `app/(field)/lots/[unitId]/index.tsx` | Grille 2×2 de KPI + 4 cartes empilées |
| Commerce | `app/(field)/(tabs)/commerce.tsx` | 3 cartes KPI + 1 carte par client |
| Stocks | `app/(field)/(tabs)/stocks.tsx` | 3 cartes KPI + jusqu'à 3 encarts colorés pleins empilés + 1 carte par article |
| Sanitaire | `app/(field)/sanitaire.tsx` | Grille 2×2 de tuiles + 3 cartes (timeline, programmes, bibliothèque) |
| Finance | `app/(field)/finance.tsx` | Héros + 1 carte bordée par dépense/salaire |

Aucun de ces écrans n'a de problème de *contenu* — les chiffres et les listes sont les bons. Le
problème est la mise en forme : chaque valeur individuelle est traitée comme un composant à part
entière plutôt que comme une ligne d'un ensemble.

## 2. La recette commune (validée sur les 7 écrans)

Six règles, dans l'ordre où elles s'appliquent en lisant un écran de haut en bas :

1. **Un seul héros plein quand il y a UN chiffre dominant.** Fond de couleur pleine (pas de
   dégradé à plusieurs champs), un chiffre énorme, une légende courte. Déjà le cas sur Accueil et
   Ferme (`LinearGradient` `primary[600]`→`primary[900]`) et sur Finance (à garder tel quel) ;
   généralisé au bloc de prévision de maturité du lot (déjà vert plein, ne pas y toucher).
2. **Bande « ticket de caisse » pour 2 à 4 chiffres de même rang.** Une bande blanche unique,
   séparateurs verticaux fins (`1px`, `neutral[200]`), un chiffre + un mot sous chacun — jamais de
   3ᵉ ligne de sous-texte. Remplace toute grille de cartes KPI bordées.
3. **Séparateurs fins plutôt que cartes bordées, pour les listes.** Lots, clients, articles de
   stock, dépenses, salaires : une ligne = un fin trait horizontal (`borderTopWidth: 1,
   neutral[100]`), pas une carte avec sa propre bordure et son ombre. L'info principale à gauche,
   le chiffre qui compte à droite, en gros.
4. **Une seule valeur, jamais son libellé répété.** Si la couleur (orange = alerte, rouge =
   négatif) porte déjà l'information, aucun badge texte redondant à côté (fini les « Bas », les
   « Encours : » sur chaque ligne).
5. **Alertes de types différents fusionnées en une seule section**, jamais en blocs colorés pleins
   qui se suivent. Une icône ronde par type d'alerte (rouge = négatif, orange = seuil bas, bleu =
   logistique), sur fond neutre commun — appliqué à Stocks (3 encarts → 1 section) et Sanitaire
   (grille 2×2 + 3 cartes → 1 bande + 1 liste + 1 ligne de synthèse).
6. **Les vraies données ne bougent pas.** Graphiques de croissance/mortalité/consommation,
   carte de prévision de maturité, segmented control, barre de recherche, FAB : gardés à
   l'identique. La règle cible la densité de texte et le nombre de blocs, pas l'information.

**Couleurs et typographie : aucune nouvelle valeur.** Les maquettes Stitch utilisent le vert
`#3D8B3D` du design system de référence ; l'implémentation mappe vers les tokens réels de
`mobile/src/theme/tokens.ts` (`primary[600]` `#2E6B2E` pour les remplissages pleins déjà en usage
sur les héros existants, `primary[700]` pour le texte de marque, `accent[400]` `#F8961E` pour
l'alerte/l'action, `error`/`warning` pour les états négatifs) — jamais un hex sorti d'une maquette.
Outfit + JetBrains Mono restent les seules polices.

## 3. Module par module — écran de référence et écrans qui suivent

Pour chaque module, un seul écran a été maquetté et validé (« référence ») ; les autres écrans du
même module appliquent les six règles du §2 sans nouvelle maquette — c'est un travail
d'implémentation directe, pas une nouvelle question de design.

### Accueil
- **Référence validée** : `app/(field)/(tabs)/home.tsx` — héros vert plein (marge/effectif/ponte
  selon contexte), bande ticket à 3 chiffres, actions rapides en gros ronds, un seul bouton
  d'action en bas. Les blocs `MyNetworkCard`/`BenchmarkCard`/`StockSummaryCard` restent, mais en
  fin d'écran et sans forcer de refonte immédiate (composants partagés, hors du 1ᵉʳ passage).

### Ma Ferme
- **Référence validée** : `app/(field)/fermes.tsx`, onglet « Vue d'ensemble » — héros inchangé,
  bande ticket à 3 chiffres, activité en lignes fines.
- **Suivent la référence sans nouvelle maquette** : les onglets « Équipe » et « Réglages » du même
  fichier — appliquer la règle 3 (lignes fines) aux rangées de membres, garder le reste (sheets,
  formulaires) inchangé.

### Élevage / lots
- **Référence validée (liste)** : `app/(field)/(tabs)/elevage.tsx` — barre de recherche et filtres
  gardés, carte de lot allégée (une barre d'âge, bande ticket à 3 chiffres, pastille discrète au
  lieu d'un bandeau de couleur plein).
- **Référence validée (détail)** : `app/(field)/lots/[unitId]/index.tsx` — grille 2×2 remplacée par
  une bande ticket à 4 chiffres ; graphiques, carte de prévision et onglets inchangés.
- **Suivent la référence liste, sans nouvelle maquette** : `app/(field)/oeufs/index.tsx` (même
  patron pour les lots pondeuses).
- **Suivent la référence détail, sans nouvelle maquette** : `app/(field)/oeufs/[unitId].tsx`,
  `app/(field)/bilans.tsx` (tableau de comparaison — appliquer la règle 3 aux lignes).
- **Écrans de saisie** (`journalier`, `mortalite`, `observation`, `pesee`, `traitement`,
  `vaccination`, `visite-veto`, `cloture`) : formulaires, pas des écrans de consultation — hors
  périmètre de cette refonte (aucun des 6 principes ne s'y applique directement ; à revoir
  séparément si besoin).
- **Note** : `app/(field)/lots/index.tsx` (liste « Navigation » à part) n'est atteignable depuis
  aucun onglet ni aucun lien du menu (`TAB_ITEMS`/`DRAWER_ITEMS` pointent vers
  `(tabs)/elevage`) — probablement mort. À confirmer avant d'y toucher, ne fait pas partie de
  cette refonte.

### Commerce
- **Référence validée** : `app/(field)/(tabs)/commerce.tsx` — bande ticket à 3 chiffres, liste de
  clients en lignes fines (avatar, nom, encours à droite sans libellé répété).
- **Suivent la référence, sans nouvelle maquette** : `commerce/client/[clientId].tsx` (fiche
  client — appliquer la règle 3 à l'historique), `commerce/ventes.tsx`, `commerce/commandes.tsx`,
  `commerce/factures.tsx` (listes — même patron que la liste clients). Les écrans de saisie
  (`vente.tsx`, `commande-nouvelle.tsx`) restent des formulaires, hors périmètre.

### Stocks
- **Référence validée** : `app/(field)/(tabs)/stocks.tsx` — bande ticket à 3 chiffres, section
  « Alertes » unique (fusion des 3 encarts colorés), liste d'articles en lignes fines.
- **Suivent la référence, sans nouvelle maquette** : `stocks/[itemId].tsx` (détail article),
  `stocks/achats.tsx`, `stocks/fournisseurs.tsx`, `stocks/formules.tsx`, `stocks/bibliotheque.tsx`
  (listes — même patron). Écrans de saisie (`achat-nouveau.tsx`, `formule-edition.tsx`) hors
  périmètre.

### Sanitaire
- **Référence validée** : `app/(field)/sanitaire.tsx` — grille 2×2 remplacée par une bande ticket à
  4 chiffres, timeline d'événements en lignes fines (filtres pilule gardés), les deux cartes
  « Programmes » et « Bibliothèque » fusionnées en une ligne de synthèse.
- **Suivent la référence, sans nouvelle maquette** : le volet Sanitaire intégré au détail d'un lot
  (`HealthSection`, utilisé dans `lots/[unitId]/index.tsx`) applique les mêmes règles à ses propres
  listes (observations, vaccinations, traitements, visites).

### Finance
- **Référence validée** : `app/(field)/finance.tsx`, onglet « Dépenses » — héros plein gardé (un
  seul chiffre : total du mois), 4 onglets pilule gardés, liste de dépenses en lignes fines.
- **Suivent la référence, sans nouvelle maquette** : les onglets « Salaires » et « Avances » du
  même fichier (même patron de liste — remplacer les cartes bordées de salaire/avance par des
  lignes fines) ; `finance/FinanceAnalytics` (onglet Analytique) reste hors périmètre — c'est déjà
  un écran de graphiques, pas de tuiles KPI.

## 4. Hors périmètre (explicitement)

- Réglages (`reglages/*`), Menu/Profil, Notifications, Assistant, écrans d'authentification et
  d'onboarding — n'étaient pas dans la liste des 7 modules donnée par l'utilisateur.
- Tout écran de **saisie** (formulaire plein écran ou sheet) — les 6 règles du §2 concernent la
  *consultation* de données déjà là, pas la capture. Un formulaire mal conçu est un problème
  différent.
- Le web (`web/src/**`) — cette refonte est strictement mobile ; aucune des captures ni des
  décisions ne s'applique à la sidebar ou aux pages desktop.
- La barre d'onglets et son jeu de permissions par rôle — déjà livrés, non rouverts ici.

## 5. Risques identifiés

- **Dérive de la recette écran par écran.** Le risque concret déjà observé une fois dans cette
  session (première tentative « éditorial/instrument/carnet », rejetée) : sans ancrer chaque
  nouvelle maquette dans `tokens.ts`, l'exécution dérive vers une esthétique différente à chaque
  écran. Parade : tout PR d'implémentation doit référencer les tokens exacts utilisés (pas de hex
  en dur), et le code-reviewer vérifie l'absence de valeur non tokenisée.
- **Les 3 tuiles Accueil/Ferme/Commerce partagent presque le même composant visuel (bande ticket)
  mais pas le même nombre de colonnes** (3 sur Accueil/Ferme/Commerce, 4 sur Élevage-détail et
  Sanitaire). Un composant partagé `TicketRow` à arité variable (2 à 4 colonnes) est justifié —
  à trancher dans le plan d'implémentation, pas ici.
- **`app/(field)/lots/index.tsx` mort ou non** — si le plan touche ce fichier par erreur en pensant
  qu'il sert, le travail est perdu pour rien. À vérifier (recherche de tous les liens vers
  `/(field)/lots` sans segment dynamique) avant d'y toucher.

## 6. Prochaine étape

Spec figée ici. La suite (composant `TicketRow` partagé ou non, ordre d'implémentation module par
module, tests à ajouter/adapter) se décide dans le plan d'implémentation (`writing-plans`), pas
dans cette spec.
