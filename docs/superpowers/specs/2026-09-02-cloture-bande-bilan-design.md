# Design — Clôture de bande et bilan de fin de cycle

> Spec de cadrage. Rédigée après mesure du dépôt, pas après lecture de la roadmap :
> les chiffres et les formules ci-dessous sortent du code réel, et deux affirmations
> de la roadmap C2 s'y sont révélées fausses.
>
> **Statut : en attente de relecture.** Les sept décisions du §3 sont proposées, pas
> encore verrouillées.

---

## 1. Le point de départ, mesuré

### 1.1 Ce que C2 promettait, et ce qui existe déjà

`docs/01-roadmap-v1.md` §C2 demande un bounded context `reporting`, un dashboard
adaptatif aux modules actifs, des exports et un score de performance. L'audit du
2026-09-02 montre que l'essentiel est livré :

| Livrable C2 | État |
|---|---|
| Bounded context `reporting` | existe (`DashboardController`, `ActivityController`, `ReportingService`) |
| Dashboard adaptatif par module | **fait** — `ReportingService` gate chaque bloc sur `module.commercial.basic`, `module.poultry.broiler`/`.layer`, `module.inventory`, et croise avec les permissions du membre |
| Exports | faits **côté client** : CSV (`web/src/lib/csv.ts`), PDF facture et bon de livraison à l'impression |
| Indicateurs techniques | IC, GMQ, mortalité cumulée, aliment et eau cumulés, date cible prévue — calculés et affichés (web + mobile) |
| Compte de résultat | `GET /finance/analytics` : revenus, dépenses, marge, ventilation par catégorie, **revenu par lot** |

### 1.2 Les quatre trous restants

1. **On ne peut pas clôturer un lot.** `LivestockService.closeUnit()` existe, est
   complet et testé — ses seuls appelants sont `LivestockFlowIT` et
   `LivestockServiceTest`. Aucun contrôleur, aucun bouton. La page `/elevage/lots`
   propose un filtre « Clôturés » qui ne peut rien contenir.
2. **Le coût par lot n'est jamais calculé.** `FarmAnalyticsResponse` sert
   `revenueByUnit` et rien en face.
3. **Le bloc Stock du dashboard est un enregistrement vide** (`public record InventorySection() {}`).
4. **Le compte de résultat ignore le temps** (« totaux cumulés, pas de fenêtre en V1 »).

Cette spec traite les trous 1 et 2. Les trous 3 et 4 sont des chantiers distincts.

### 1.3 La découverte qui change le chantier : l'aliment n'a pas de prix

Toute consommation d'un lot passe par `StockConsumptionService`, qui construit son
`StockMovementCommand` avec `unitPriceXof = null`. Comme
`total_value_xof = quantité × prix unitaire`, **chaque sortie vers un lot est
enregistrée en kilos et jamais en francs**.

L'argent est comptabilisé correctement, mais **à l'entrée** : `recordStockEntryExpense`
ne se déclenche que sur une entrée manuelle valorisée, et `recordPurchaseExpenses` sur
la réception d'un bon d'achat. C'est le bon choix comptable — c'est l'anti-double-comptage
de V25 — mais il rend le coût par bande invisible.

Second manque : **`PoultryBatch` ne porte aucun prix d'achat**. Ses champs sont `breed`,
`targetWeightG`, `targetAgeDays`, `initialCount`.

Conséquence : les deux plus gros postes d'une bande de chair — l'aliment et les poussins
— ne sont pas rattachables au lot aujourd'hui. Ce que `expenses.production_unit_id`
contient, c'est le reste : visites vétérinaires (`recordVetVisitExpense` transmet bien
l'unité) et dépenses saisies à la main. Sommer cela et l'appeler « coût de la bande »
donnerait un chiffre faux **et systématiquement flatteur**.

### 1.4 Un défaut de production trouvé pendant la mesure

`GrowthAnalysisService.mortalityPercent()` calcule :

```java
double dead = initial - batch.getCurrentCount();
```

Or `recordEvent` décrémente `currentCount` pour **tout** delta négatif, y compris
`EVENT_SALE` (`recordEvent(unitId, EVENT_SALE, -(int) heads, "sale", ...)`). Chaque
sujet vendu est donc compté comme mort : une bande qui écoule 80 % de son effectif
affiche 80 % de mortalité.

La bonne source existe — les événements `MORTALITY`, dont les deltas sont négatifs :

```
morts = | Σ quantity_delta des LifecycleEvent où event_type = 'MORTALITY' |
```

**Ce défaut se corrige dans une PR séparée, avant ce chantier** (1 PR = 1 sujet, et le
chiffre est faux en production aujourd'hui). La clôture en dépend : un bilan figé ne
peut pas figer une mortalité fausse.

---

## 2. Périmètre

### 2.1 Dans le périmètre

- Clôturer une unité de production depuis l'API et depuis le web.
- Calculer et **figer** un bilan de fin de cycle : technique et argent.
- Rouvrir une unité clôturée (et supprimer son bilan).
- Afficher le bilan sur la fiche lot, avec sa couverture de valorisation.

### 2.2 Hors périmètre, et pourquoi

- **Valoriser chaque sortie de stock** (remplir `unitPriceXof` à la consommation).
  C'est la trajectoire cible, mais elle ne vaut que pour l'avenir : les lots existants
  afficheraient zéro franc d'aliment. Voir D1.
- **Le classement des bandes entre elles.** Il devient trivial une fois les bilans
  figés — c'est le chantier suivant, pas celui-ci.
- **Les pondeuses.** Un cycle de ponte se juge sur d'autres indicateurs (taux de ponte,
  œufs par poule logée). La table est conçue pour les accueillir ; le calcul viendra.
- **Le rendu PDF serveur et l'envoi WhatsApp.** `WhatsAppOutboxFacade` n'expose que du
  texte, et un `mediaUrl` Konekt exigerait une URL publique lisible par un serveur tiers
  sur des données de ferme. C'est une décision d'architecture à part entière.

---

## 3. Décisions

### D1 — Le coût est valorisé **à la clôture**, pas à la consommation

À la clôture, on multiplie les quantités sorties par le prix de l'article, et on fige.

*Pourquoi* : le chemin d'écriture quotidien — celui que les éleveurs utilisent tous les
jours en production — n'est pas touché, et la méthode fonctionne **rétroactivement** sur
les lots déjà existants. Valoriser à la sortie serait plus exact, mais ne produirait
aucun chiffre pour l'historique.

*Limite assumée* : le prix retenu est celui connu à la clôture, pas celui du jour où
l'aliment a été consommé. Le bilan est une estimation figée, et il le dit.

*Compatibilité future* : le calcul lit `stock_movements.total_value_xof` **en priorité**
et ne retombe sur le prix de l'article que lorsqu'elle est nulle. Le jour où les sorties
seront valorisées, les bilans deviennent exacts sans réécrire une ligne.

### D2 — Le bilan est figé, jamais recalculé

Une dépense saisie trois semaines plus tard, un prix d'article corrigé, réécriraient
silencieusement un résultat passé. Un bilan qui bouge n'est pas un bilan. La ligne porte
sa date de calcul, visible.

### D3 — La couverture de valorisation est affichée

`stock_items.typical_unit_price_xof` est nullable : un article sans prix pèse zéro. Le
bilan enregistre donc `consumed_articles` et `valued_articles`, et l'interface avertit
quand la couverture est incomplète.

*Pourquoi c'est non négociable* : sans cela le bilan ment par omission, et il ment
toujours dans le même sens — il flatte. Un éleveur qui connaît son coût de revient de
tête verrait un chiffre trop beau et cesserait de croire le reste de l'application.

### D4 — La clôture est réversible

Rouvrir est réservé à OWNER/MANAGER et **supprime** le bilan (pas de soft delete : la
ligne disparaît). Sur une ferme réelle, un clic malheureux figerait sinon des chiffres
faux pour toujours.

### D5 — La clôture ne bloque pas s'il reste des sujets

Un éleveur écoule sa fin de bande sur plusieurs semaines et clôture souvent avant le
dernier poulet. Le bilan enregistre l'effectif restant ; c'est au lecteur de juger.

### D6 — L'argent est en `BIGINT` XOF

`CLAUDE.md` prescrit `NUMERIC(12,2)` pour le financier, mais tout le code existant —
`expenses.amount_xof`, `sale_items`, `stock_movements.total_value_xof` — est en `BIGINT`
XOF entier. **Le code gagne**, comme pour les enums de `common-security` (cf. la
désynchronisation déjà actée du doc 04). Mélanger les deux conventions serait pire que
s'écarter de la doc.

### D7 — Les gardes sont copiées, pas inventées

Lecture : `poultry:read`. Clôture et réouverture : OWNER/MANAGER — clôturer est un acte
structurant, comme créer une unité. Ce sont exactement les gardes de
`ProductionUnitController`, recopiées.

*Pourquoi* : une divergence de garde sur un contrôleur transverse a déjà contourné un
verrou par espèce dans ce dépôt (cf. PR #114). On ne réinvente pas une règle d'accès à
côté d'une règle existante.

---

## 4. Architecture

### 4.1 Où ça vit

Nouveau paquet `com.avicare.livestock.closure` :

| Classe | Rôle |
|---|---|
| `UnitClosure` | l'entité figée |
| `UnitClosureRepository` | `JpaRepository<UnitClosure, Long>` |
| `UnitCostService` | la valorisation, isolée pour être testable seule |
| `UnitClosureService` | orchestration : calcule, fige, rouvre |
| `UnitClosureController` | les trois endpoints |

`livestock` est le bon hôte : trois des quatre sources y sont déjà, les ventes
comprises, puisque `commercial` est un sous-domaine plat de livestock (ADR-008).

### 4.2 Sources de données

| Donnée | Source | État |
|---|---|---|
| Recettes du lot | `commercialFacade.revenueByProductionUnit(farmId, unitId)` | existe |
| Coût aliment et produits | `stock_movements` OUT du lot × prix | requête à écrire |
| Autres dépenses | `FinanceFacade` | **1 méthode à ajouter** |
| Morts | événements `MORTALITY` | existe (après le correctif §1.4) |
| Technique | `GrowthAnalysisService`, `PoultryBatch`, pesées | existe |

### 4.3 La seule frontière franchie

```java
/**
 * Σ des dépenses directement rattachées à une unité de production, hors source
 * STOCK_ENTRY (déjà comptée à la sortie de stock — anti-double-comptage V25).
 */
long directExpensesForUnit(Long farmId, Long productionUnitId);
```

Ajoutée à `FinanceFacade`. `FinanceFacadeImpl` a déjà `ExpenseRepository` en dépendance :
**aucun nouveau bean n'entre dans le graphe de la facade**. C'est délibéré — élargir le
graphe d'une facade casse les slices `@DataJpaTest` qui l'importent, vert en local et
rouge en CI Testcontainers.

Le sens de la dépendance (livestock → finance) est celui déjà pratiqué par
`StockMovementService`, qui importe `com.avicare.finance.api.FinanceFacade`.

### 4.4 Migration V52

> Le numéro vaut pour l'**ordre de merge**, pas l'ordre du plan (`out-of-order` est
> désactivé). À renuméroter si une autre migration part avant.

```sql
CREATE TABLE unit_closures (
    id                    BIGSERIAL PRIMARY KEY,
    production_unit_id    BIGINT NOT NULL UNIQUE REFERENCES production_units(id) ON DELETE CASCADE,
    farm_id               BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    closed_at             TIMESTAMP NOT NULL,
    closed_by             BIGINT REFERENCES users(id),

    start_date            DATE NOT NULL,
    end_date              DATE NOT NULL,
    duration_days         INTEGER NOT NULL CHECK (duration_days >= 0),

    initial_count         INTEGER NOT NULL,
    remaining_count       INTEGER NOT NULL,          -- sujets encore présents (D5)
    deaths                INTEGER NOT NULL CHECK (deaths >= 0),
    mortality_percent     NUMERIC(5,2),

    -- Technique : nullable, renseigné pour la volaille de chair.
    exit_weight_g         NUMERIC(10,2),
    avg_daily_gain_g      NUMERIC(10,2),
    total_feed_kg         NUMERIC(14,3),
    feed_conversion_ratio NUMERIC(6,3),

    -- Argent : XOF entiers (D6).
    revenue_xof           BIGINT  NOT NULL DEFAULT 0,
    feed_cost_xof         BIGINT  NOT NULL DEFAULT 0,
    chick_cost_xof        BIGINT  NOT NULL DEFAULT 0,
    other_expense_xof     BIGINT  NOT NULL DEFAULT 0,
    total_cost_xof        BIGINT  NOT NULL DEFAULT 0,
    margin_xof            BIGINT  NOT NULL DEFAULT 0,
    cost_per_kg_xof       INTEGER,

    -- Couverture de valorisation (D3).
    consumed_articles     INTEGER NOT NULL DEFAULT 0,
    valued_articles       INTEGER NOT NULL DEFAULT 0,

    notes                 TEXT,
    created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_unit_closures_farm ON unit_closures(farm_id);

CREATE TRIGGER trg_unit_closures_updated_at
    BEFORE UPDATE ON unit_closures
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

Pas de `deleted_at` : rouvrir supprime la ligne (D4), et `CLAUDE.md` réserve `deleted_at`
aux tables à soft delete.

### 4.5 Endpoints

```
POST   /api/v1/farms/{farmId}/production-units/{unitId}/close     201  { chickCostXof?, notes? }
GET    /api/v1/farms/{farmId}/production-units/{unitId}/closure    200
DELETE /api/v1/farms/{farmId}/production-units/{unitId}/closure    204
```

`POST` sur une unité déjà clôturée → 409 (`UNIT_ALREADY_CLOSED`).
`GET` sur une unité ouverte → 404.

### 4.6 Le calcul, précisément

```
morts            = | Σ quantity_delta des LifecycleEvent MORTALITY du lot |
mortality_percent= morts / initial_count × 100                     (null si initial_count = 0)
                   -- seuls les événements MORTALITY comptent : un COUNT_ADJUSTMENT
                   -- négatif est une correction de saisie, pas une mort.

feed_cost_xof    = Σ sur les stock_movements OUT du lot de :
                     m.total_value_xof          si non nul
                     sinon m.quantity × stock_items.typical_unit_price_xof
                     sinon 0                    (et l'article compte comme non valorisé)

consumed_articles= COUNT(DISTINCT stock_item_id) de ces mouvements
valued_articles  = COUNT(DISTINCT stock_item_id) pour lesquels un prix a été trouvé

other_expense_xof= Σ expenses.amount_xof
                   WHERE farm_id = ? AND production_unit_id = ?
                     AND deleted_at IS NULL AND source <> 'STOCK_ENTRY'

revenue_xof      = commercialFacade.revenueByProductionUnit(farmId, unitId)
total_cost_xof   = feed_cost_xof + chick_cost_xof + other_expense_xof
margin_xof       = revenue_xof − total_cost_xof

kg_produits      = (initial_count − morts) × exit_weight_g / 1000
cost_per_kg_xof  = total_cost_xof / kg_produits    (null si exit_weight_g inconnu
                                                    ou kg_produits ≤ 0)
```

`exit_weight_g` est le poids moyen de la **dernière pesée** du lot.

`kg_produits` compte **tous les sujets vivants en fin de cycle**, vendus comme restants :
`initial_count − morts`. Nourrir les sujets encore présents a coûté de l'argent et ils
constituent de la production, même invendue. Le coût de revient au kilo mesure donc ce
que la bande a coûté pour produire du poids vif, pas ce qu'elle a coûté pour produire
une facture.

`cost_per_kg_xof` reste une estimation : elle suppose que les sujets vivants pesaient le
poids de la dernière pesée. Elle est nulle plutôt que fausse quand la donnée manque.

### 4.7 Ce qu'on ne touche pas

- `StockConsumptionService` et le chemin d'écriture quotidien.
- `recordStockEntryExpense` et la logique anti-double-comptage de V25.
- Les migrations déjà mergées.
- Le dashboard et son bloc `InventorySection` (chantier distinct).

---

## 5. Front

- Bouton **« Clôturer la bande »** sur la fiche lot, visible pour OWNER/MANAGER sur un
  lot `ACTIVE`.
- Dialogue de clôture : coût des poussins (optionnel) et note. Il rappelle que le bilan
  sera figé.
- Sur un lot `CLOSED`, un **bilan** remplace la vue d'ensemble : bloc technique, bloc
  argent, et l'avertissement de couverture quand `valued_articles < consumed_articles`.
- Action **« Rouvrir »**, avec confirmation explicite que le bilan sera supprimé.
- Le filtre « Clôturés » de `/elevage/lots` se remplit alors de lui-même.

---

## 6. Tests

**Unitaires — `UnitCostService`**, là où est le risque :

- article consommé sans prix → compté non valorisé, coût inchangé ;
- dépense de source `STOCK_ENTRY` sur l'unité → **exclue** (non-régression du double comptage) ;
- lot sans aucune consommation → coût aliment nul, couverture 0/0 ;
- mouvement OUT déjà valorisé → sa valeur prime sur le prix de l'article ;
- `exit_weight_g` absent → `cost_per_kg_xof` nul, pas zéro.

**Unitaires — mortalité** : un lot avec ventes et morts → seules les morts comptent.

**IT Testcontainers** — flux complet : créer un lot → consommer → vendre → clôturer →
vérifier les chiffres figés → rouvrir → vérifier la disparition du bilan.
Ne tourne pas sur le Mac de développement (Docker 29 contre docker-java) : validation
en CI.

**Contextes DB-less** : `UnitClosureRepository` doit être déclaré `@MockitoBean` dans
chaque `@SpringBootTest` sans base. Repérer les fichiers en greppant l'ancre
`FarmRepository` — leur nombre est passé de 2 à 6, ne pas se fier au chiffre.

---

## 7. Risques

| Risque | Traitement |
|---|---|
| Le bilan flatte parce que des articles n'ont pas de prix | D3 : couverture affichée, avertissement explicite |
| Le coût aliment est sous-estimé sur l'historique | Assumé et documenté : c'est une estimation à la clôture (D1) |
| Double comptage avec les dépenses `STOCK_ENTRY` | Exclusion explicite + test de non-régression |
| La mortalité figée est fausse | Correctif préalable en PR séparée (§1.4), bloquant |
| Numéro de migration pris par un autre merge | Renumérotation avant merge |
| Un nouveau repository casse les six contextes DB-less | `@MockitoBean` ajouté dans le même commit |

---

## 8. Critères d'acceptation

- [ ] Un OWNER/MANAGER peut clôturer un lot `ACTIVE` depuis le web, et le voir passer en `CLOSED`.
- [ ] La clôture crée exactement une ligne `unit_closures`, et une seconde tentative renvoie 409.
- [ ] Le bilan affiche mortalité, IC, poids de sortie, durée, recettes, coûts détaillés, marge.
- [ ] La mortalité figée ignore les ventes.
- [ ] Une dépense saisie après la clôture ne modifie pas le bilan.
- [ ] Quand un article consommé n'a pas de prix, l'interface le signale.
- [ ] Rouvrir supprime le bilan et remet le lot en `ACTIVE`.
- [ ] Un membre sans `poultry:read` reçoit 403 ; un FARMER ne peut pas clôturer.
- [ ] `./mvnw clean verify` vert, CI verte avant merge.
