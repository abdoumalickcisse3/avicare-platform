# Design — Vente des poulets de chair au poids

> Spec de cadrage. Origine : retour d'un éleveur pilote (Maurice) en phase d'accompagnement, sur
> l'écran « Vente directe » (web, `QuickSaleDialog`). Sa remarque, reformulée : « on ne vend pas
> les poulets de chair à l'unité — un client achète par exemple 80 sujets, on les pèse ensemble,
> ça donne 110 kg, et on facture au prix du kilo ». Une première proposition (des paliers de prix
> par poids individuel, ex. 1,5 kg → 1 500 F) a été présentée puis rejetée par l'éleveur : on ne
> pèse jamais un poulet seul au moment de la vente, on pèse le lot vendu en une fois.
>
> Deuxième sujet distinct soulevé dans la même conversation (coût d'achat des poussins à la
> réception d'une bande) : hors périmètre de cette spec, traité séparément.

---

## 1. Ce qui existe aujourd'hui

- `web/src/components/commercial/QuickSaleDialog.tsx` (et son port mobile,
  `mobile/app/(field)/commerce/vente.tsx`) : une ligne de vente sur un lot de poulets de chair
  ne porte que `quantity` (nombre de têtes) et `unitPriceXof` — un prix fixe par tête, jamais par
  kilo.
- `SaleItem` (`backend/.../livestock/domain/SaleItem.java`) : `quantity` (BigDecimal), `unit`
  (chaîne, vaut `"tête"` pour une ligne poulet de chair — codé en dur dans
  `SaleService.productionUnitFor()`), `unitPriceXof`, `lineTotalXof = quantity × unitPriceXof`.
- `SaleService.validateProductionLine()` impose déjà que `quantity` soit un entier pour toute
  ligne de production (têtes ou plateaux) — contrainte qui doit rester intacte, elle ne concerne
  que le nombre de sujets, jamais un poids.
- Le décompte du stock du lot (`ProductionUnit.currentCount`) se fait via
  `LivestockFacade.consumeProduction(...)`, toujours en nombre de têtes
  (`quantity.longValueExact()`).
- Le poids moyen déjà pesé sur un lot existe et est exploité ailleurs : chaque pesée
  (`WeighingSample.avgWeightG`) alimente `GrowthPerformance.currentWeightG` (le poids moyen le
  plus récent), exposé par `GET /api/v1/farms/{farmId}/poultry-batches/{batchId}/performance`.
  Ce chiffre n'est aujourd'hui jamais lu par le flux de vente.

## 2. Le principe retenu

Une ligne de vente « poulet de chair » peut être saisie selon **deux modes**, choisis par
l'éleveur au cas par cas (pas un réglage global — un panier peut mélanger une ligne à la tête et
une ligne au poids) :

- **À la tête** (comportement actuel, inchangé) : nombre de têtes × prix par tête.
- **Au poids** (nouveau) : nombre de têtes (décompte du stock, comme aujourd'hui) + poids total
  du lot vendu (saisi par l'éleveur, pesé sur sa propre balance) + prix au kilo → total = poids ×
  prix au kilo.

Le nombre de têtes reste **toujours** ce qui décrémente le stock du lot, quel que soit le mode —
le poids ne sert qu'au calcul du prix.

## 3. Modèle de données

- `SaleItem` : nouvelle colonne `weight_kg NUMERIC(10,2) NULL` (migration Flyway suivante, ex.
  `V59__sale_item_weight.sql`). `NULL` = ligne à la tête (comportement actuel, aucune migration
  de données existantes nécessaire). Renseigné = ligne au poids.
- `SaleItem.unit` devient `"kg"` au lieu de `"tête"` quand `weightKg` est renseigné.
- `lineTotalXof` : si `weightKg != null`, `= round(weightKg × unitPriceXof)` ; sinon comportement
  actuel (`quantity × unitPriceXof`).
- `SaleRequest.LineRequest` (`backend/.../livestock/commercial/dto/SaleRequest.java`) et
  `SaleCommand.Line` : ajout du champ optionnel `weightKg` (BigDecimal), miroir du champ DTO côté
  web (`salesApi.ts`) et mobile.
- Aucun changement sur `validateProductionLine` (contrainte d'entier sur `quantity`, i.e. les
  têtes) ni sur `consumeProduction`/`restockProduction` (décompte/restock toujours en têtes) —
  ces mécanismes ignorent `weightKg`.
- `CommercialFacadeImpl.revenueByProductionUnit()` et tout ce qui agrège `lineTotalXof` (marge de
  clôture de bande, chiffre d'affaires) continuent de fonctionner sans modification : le total en
  XOF d'une ligne est toujours le même type de nombre, peu importe comment il a été calculé.

## 4. Comportement de saisie (web + mobile)

Sur la ligne de panier d'un lot de poulets de chair : un sélecteur à deux options **« À la
tête »** / **« Au poids »** (segmented control), par défaut sur « À la tête » pour ne rien
changer au comportement existant.

En mode « Au poids » :

1. Le nombre de têtes se saisit comme aujourd'hui (avec le même plafond au nombre de sujets
   restants sur le lot).
2. Un champ **« Poids total (kg) »** apparaît, **pré-rempli automatiquement** :
   `têtes sélectionnées × currentWeightG du lot ÷ 1000` (lu via l'endpoint `.../performance`
   déjà existant — aucun nouvel endpoint de lecture nécessaire). Le fermier peut corriger cette
   valeur avec le poids réellement pesé. Sous le champ, un texte discret indique la source et sa
   fraîcheur, ex. *« Estimé d'après la pesée du 20/09 (1,8 kg/sujet en moyenne) »*.
   Si le lot n'a jamais été pesé, le champ est vide et le fermier saisit le poids réel — pas de
   blocage.
3. Le champ prix est relabellisé **« Prix au kg (FCFA) »** au lieu de « Prix par tête ».
4. Le total affiché se recalcule en direct : poids × prix au kg.

## 5. Hors périmètre

- Le coût d'achat des poussins à la réception d'une bande (deuxième sujet de la même
  conversation) — spec séparée.
- La vente au poids pour les œufs (vendus au plateau, non concernés) ou pour d'éventuelles
  volailles de réforme (pondeuses vendues comme viande — ce cas n'existe pas dans le produit
  aujourd'hui, `ProductType` ne compte que `BROILER`/`EGGS`, non traité ici).
- Toute automatisation qui figerait le poids sans validation humaine (le poids reste toujours
  modifiable, jamais imposé).

## 6. Risques / points d'attention pour le plan d'implémentation

- **Parité web/mobile obligatoire** (règle permanente du projet) : le sélecteur de mode, le champ
  poids et son pré-remplissage doivent être portés sur `mobile/app/(field)/commerce/vente.tsx` en
  même temps que sur le web, pas dans un second temps.
- **Arrondi** : `weightKg × unitPriceXof` peut produire des décimales de franc — appliquer le
  même arrondi que l'existant (`lineTotal()` arrondit déjà à l'entier XOF).
- **Tests à couvrir** : calcul du total en mode poids (backend, `SaleServiceTest`), non-régression
  du mode à la tête existant, décompte du stock toujours en têtes dans les deux modes, valeur du
  poids suggéré basée sur `currentWeightG`, dégradation propre quand aucune pesée n'existe.
