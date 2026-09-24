# Design — Coût d'achat des poussins à la réception d'une bande

> Spec de cadrage. Deuxième sujet remonté par l'éleveur pilote Maurice dans la même conversation
> que [`2026-09-23-broiler-sale-by-weight-design.md`](2026-09-23-broiler-sale-by-weight-design.md)
> (vente au poids, traité en premier). Sa remarque, reformulée : « aujourd'hui je ne peux saisir le
> prix payé pour les poussins qu'à la clôture de la bande, des mois plus tard — je voudrais pouvoir
> le renseigner dès la réception ».

---

## 1. Ce qui existe aujourd'hui

- `PoultryBatch` (`backend/.../livestock/domain/PoultryBatch.java`) ne porte aucun champ de coût.
  À la création (`CreatePoultryBatchRequest`, `PoultryBatchService.create()`), seuls
  race/nom/date/poids-cible/âge-cible/nombre de têtes sont saisis.
- Le seul endroit où un coût d'achat des poussins existe : `CloseUnitRequest.chickCostXof`, une
  valeur unique saisie à la **clôture** de la bande (`UnitClosureService.close()`), des mois après
  la réception réelle. Elle alimente le calcul de marge du bilan de clôture
  (`totalCostXof = feed.costXof() + chickCost + otherExpenseXof`) mais n'est **jamais** visible
  ailleurs — en particulier absente du P&L global de la ferme
  (`FinanceAnalyticsService.farmAnalytics`, qui ne lit que la table `Expense`).
- Le domaine finance (`com.avicare.finance`) a déjà un mécanisme pour qu'un autre contexte
  enregistre une dépense sans violer la frontière inter-contexte (ADR-008, pas d'import croisé) :
  `FinanceFacade.recordVetVisitExpense(...)` / `reverseVetVisitExpense(...)`, un couple
  créer/annuler idempotent (vérifie l'existant avant d'insérer) lié à `productionUnitId`. C'est le
  patron à réutiliser.
- `ExpenseSource` existe (`MANUAL, PURCHASE, STOCK_ENTRY, SALARY, VET_VISIT`) et
  `expense_categories` (catalogue, seedé en V4) couvre `feed, veterinary, staff, energy, equipment,
  transport, other` — aucune catégorie « poussins » n'existe.
- `ExpenseRepository.sumDirectForUnit` (utilisé par `UnitClosureService` pour le poste « autres
  dépenses » du bilan) exclut déjà explicitement `STOCK_ENTRY` (l'aliment, dont le coût est calculé
  séparément via les mouvements de stock) pour éviter un double comptage — patron directement
  réutilisable pour les poussins.
- Aucun écran d'édition de bande n'existe après la création (ni web ni mobile) — les bandes sont
  immuables jusqu'à leur clôture. Le mobile n'a par ailleurs **aucun** écran de création de bande
  hors du parcours d'onboarding (le web, lui, a `CreateBatchDialog.tsx` accessible à tout moment).

## 2. Le principe retenu

Le coût des poussins devient une **dépense** (`Expense`) rattachée au lot via `productionUnitId`,
au même titre qu'une visite vétérinaire — jamais un champ dupliqué sur `PoultryBatch`. Il peut être
saisi à la création de la bande, ou plus tard via une action dédiée, tant que la bande n'est pas
close. Le champ manuel de clôture disparaît de l'usage normal ; il ne reste qu'un repli pour les
bandes qui n'ont jamais reçu de coût de réception.

### 2.1 Nouveau vocabulaire finance

- `ExpenseSource.CHICK_PURCHASE` (nouvelle valeur d'enum).
- Nouvelle catégorie catalogue `chicks` (poussins), seedée en migration, distincte de `feed`.
- `FinanceFacade.recordChickPurchaseExpense(farmId, productionUnitId, amountXof, purchaseDate,
  userId)` : upsert idempotent — met à jour la dépense `CHICK_PURCHASE` existante pour ce
  `productionUnitId` si elle existe, sinon en crée une. Un seul point d'entrée sert à la fois la
  saisie initiale et toute correction ultérieure ; l'appelant calcule le montant total
  (`prix unitaire × nombre de têtes`), la facade ne connaît que le montant.
- `ExpenseRepository.sumDirectForUnit` exclut désormais aussi `CHICK_PURCHASE`, du même mécanisme
  que `STOCK_ENTRY` — le coût des poussins reste sa propre ligne dans le bilan de clôture plutôt que
  d'être noyé dans « autres dépenses ».

### 2.2 Saisie à la création

`CreatePoultryBatchRequest` gagne un champ optionnel `chickUnitPriceXof` (prix par poussin, en
FCFA). Si renseigné, `PoultryBatchService.create()` calcule
`amountXof = chickUnitPriceXof × initialCount` et appelle
`FinanceFacade.recordChickPurchaseExpense(...)` avec la date de démarrage de la bande comme date
de dépense. Absent → comportement actuel inchangé, aucun blocage.

### 2.3 Correction / saisie tardive

Nouvelle action dédiée, pas un formulaire d'édition générique de bande :
`POST /api/v1/farms/{farmId}/poultry-batches/{batchId}/chick-cost`, corps
`{ chickUnitPriceXof: Long }`. Refusé (409) si la bande est déjà close. Appelle le même
`FinanceFacade.recordChickPurchaseExpense(...)` — que ce soit la première saisie ou une correction
d'un montant déjà enregistré, le comportement est identique (upsert). Toujours basé sur
`initialCount` (nombre de poussins réellement achetés), jamais `currentCount` (qui baisse avec la
mortalité — sans rapport avec le prix payé à l'achat). La date de dépense transmise est toujours
`batch.startDate` (la date de réception de la bande), qu'il s'agisse de la première saisie ou d'une
correction ultérieure — une correction de prix ne déplace jamais la date d'achat.

La réponse de détail d'une bande (`PoultryBatchResponse` ou équivalent) expose désormais un champ
dérivé nullable `chickPurchaseCostXof` (le montant enregistré, ou `null`) pour que la fiche du lot
et le dialogue de clôture puissent l'afficher sans appel supplémentaire.

### 2.4 Clôture de bande

`UnitClosureService.close()` résout le coût des poussins ainsi, avant de calculer le bilan :

1. **Cas normal** : une dépense `CHICK_PURCHASE` existe déjà pour ce lot → son montant est lu et
   utilisé tel quel comme `chickCostXof` du bilan. Le dialogue de clôture l'affiche en lecture
   seule (rien à ressaisir).
2. **Cas de repli** : aucune dépense `CHICK_PURCHASE` n'existe (bande créée avant cette
   fonctionnalité, ou jamais renseignée à la réception ni corrigée depuis) → le champ manuel de
   `CloseUnitRequest.chickCostXof` reste disponible comme aujourd'hui, mais sa valeur est
   maintenant elle aussi enregistrée via `FinanceFacade.recordChickPurchaseExpense(...)` au moment
   de la clôture (datée du jour de clôture) au lieu de rester une valeur figée uniquement sur
   `UnitClosure` — elle devient donc visible dans le P&L global de la ferme, comme n'importe quelle
   autre dépense.

`UnitClosure.chickCostXof` reste le champ figé du bilan (comme les autres champs de ce
« snapshot », cf. sa Javadoc existante) — sa valeur vient maintenant systématiquement du montant
résolu ci-dessus, jamais directement de la saisie utilisateur brute du formulaire de clôture.

### 2.5 P&L global de la ferme

Aucun changement à `FinanceAnalyticsService` : une dépense `CHICK_PURCHASE` est une `Expense`
normale, comptée comme toute autre dans le P&L global (elle n'est exclue que de la somme
spécifique au bilan de clôture d'un lot, `sumDirectForUnit`, pour éviter le double comptage décrit
en 2.1). Effet de bord positif attendu : le coût des poussins d'un lot pas encore clos devient,
pour la première fois, visible dans le P&L global de la ferme — il est aujourd'hui invisible tant
que la bande n'est pas close.

## 3. Interface utilisateur (web + mobile)

- **Web** — `CreateBatchDialog.tsx` : champ optionnel « Prix par poussin (FCFA) » dans la section
  démarrage, total recalculé en direct. Fiche du lot : affichage du coût déjà enregistré
  (« X FCFA — Y FCFA/poussin ») + bouton « Renseigner »/« Modifier » ouvrant un petit dialogue à un
  seul champ. `CloseBatchDialog.tsx` : si un coût est déjà enregistré, affichage lecture seule ;
  sinon, champ manuel de repli comme aujourd'hui.
- **Mobile — écrans existants** : `CreateLotSheet.tsx` (onboarding) gagne le même champ optionnel.
  L'écran de clôture (`cloture.tsx`) reproduit le même comportement lecture-seule/repli que le web.
  La fiche du lot gagne le même affichage + action « Renseigner »/« Modifier ».
- **Mobile — nouvel écran** : un écran de création de bande post-onboarding sous
  `mobile/app/(field)/lots/` (comble un écart de parité préexistant, sans rapport direct avec ce
  sujet mais demandé dans le même mouvement), mêmes champs que `CreateBatchDialog.tsx` côté web, y
  compris le prix des poussins. Un point d'entrée est ajouté sur l'écran de liste des lots
  existant ; son emplacement exact sera déterminé au moment du plan d'implémentation.

## 4. Hors périmètre

- Toute autre édition de bande après création (race, poids/âge cible, nom) — seule l'action dédiée
  « coût des poussins » est ajoutée, pas un formulaire d'édition générique de `PoultryBatch`.
- La catégorie « poussin » au niveau du catalogue produit/race — sous-question jamais tranchée de
  la conversation WhatsApp d'origine, sans rapport avec le coût d'achat traité ici.
- Rétroactivité sur les bandes déjà closes avant ce déploiement — non retraitées.

## 5. Risques / points d'attention pour le plan d'implémentation

- **Migration DB** : nouvelle valeur `CHICK_PURCHASE` sur la colonne `source` de `expenses`
  (probablement une contrainte `CHECK` à étendre) + nouvelle ligne catalogue `chicks` dans
  `expense_categories`.
- **Idempotence de l'upsert** : `recordChickPurchaseExpense` doit chercher l'`Expense` existante
  par `(farmId, productionUnitId, source = CHICK_PURCHASE)` avant d'insérer — jamais deux dépenses
  poussins pour le même lot.
- **Double comptage** : vérifier avec un test que `UnitClosureService.close()` ne compte le coût
  des poussins qu'une seule fois dans `totalCostXof`, dans les deux cas (dépense déjà existante /
  cas de repli), et que le bilan affiché reste cohérent avec `FinanceAnalyticsService` côté ferme.
- **Parité web/mobile obligatoire** (règle permanente du projet) : le champ de création, l'action
  de correction et le comportement de clôture doivent être portés sur les deux plateformes en même
  temps — y compris le nouvel écran mobile de création post-onboarding.
- **Tests à couvrir** : calcul du montant total à la création (backend), upsert idempotent
  (création puis correction), rejet de la correction sur une bande close (409), résolution du coût
  à la clôture dans les deux cas (dépense existante / repli), non-double-comptage du bilan, et le
  P&L global de la ferme qui inclut désormais le coût d'un lot non clos.
