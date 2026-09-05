# Design — Compte-courant fournisseur

> Spec de cadrage. Rédigée après mesure du dépôt : chaque affirmation du §1 sort du code
> réel, pas de la roadmap.
>
> **Statut : design validé le 2026-09-05, prêt à planifier.**
>
> Origine : la confrontation de l'enquête terrain (`docs/🐔 Enquête sur la gestion d'élevage
> avicole(Sheet1).csv`, 17 réponses) au modèle métier, le 2026-09-05. Quatorze éleveurs sur
> dix-sept nomment le **coût de l'aliment** comme premier défi. L'aliment s'achète à crédit chez
> le provendier et se rembourse à la vente de la bande : c'est le passif dominant d'une petite
> ferme, et il n'existe nulle part dans le modèle.

---

## 1. Le point de départ, mesuré

### 1.1 La charge existe déjà ; la trésorerie n'existe pas

Recevoir un bon d'achat **enregistre déjà la dépense**. `PurchaseOrderService.receive`
(`livestock/inventory`) appelle `financeFacade.recordPurchaseExpenses`, qui crée une `Expense` par
catégorie avec `source = PURCHASE`. Une entrée de stock directe crée de même une dépense
`STOCK_ENTRY`.

Ce qui manque n'est donc pas la charge, mais la **contrepartie de trésorerie** : payé ou non,
combien, quand, et combien reste dû. Côté client, cette moitié existe en entier — `Sale` →
`Invoice` → `Payment`, avec un compte-courant sur la fiche client (PR #97-101). Côté fournisseur,
`PurchaseOrder` porte un `totalXof` et **aucune notion de paiement**.

### 1.2 Un mouvement de stock ne connaît pas son fournisseur

`StockMovement` n'a pas de `supplier_id`. Seul le bon d'achat sait à qui l'on doit. Conséquence
directe sur le périmètre : **ce que la ferme doit ne peut être dérivé automatiquement que des bons
d'achat reçus**. Pour tout le reste — la livraison prise sans bon d'achat, cas du carnet — c'est
l'éleveur qui le déclare.

Ce n'est pas un cas marginal : onze éleveurs sur dix-sept tiennent leurs comptes sur papier ou de
tête. Exiger un bon d'achat pour qu'une dette existe exclurait précisément la population visée.

### 1.3 La réception est partielle possible

`receive()` accepte une quantité reçue par ligne et calcule la dépense sur **ce qui est réellement
arrivé**, jamais sur le total commandé. Le débit devra suivre la même règle, sous peine d'endetter
la ferme de ce qui n'a pas été livré.

`receive()` exige par ailleurs le statut `SENT` (`requireStatus`), donc un bon d'achat ne peut être
reçu qu'une fois.

### 1.4 Un fournisseur n'a jamais de compte — et c'est une autre table que le partenaire

`suppliers` (V15) est une **fiche appartenant à la ferme** : nom commercial, contact, téléphone,
e-mail. Aucun `partner_id`, aucun `user_id`, aucun moyen de se connecter. Le compte-courant
fonctionne donc pour lui par construction ; il n'y a rien à prévoir de ce côté.

Mais la plateforme porte une **seconde** notion du provendier : `partners` (V36) avec ses
`partner_users` et son portail. **Rien ne joint les deux tables.** Le même provendier peut exister
deux fois — en fiche fournisseur chez une ferme, et en partenaire avec son portail — sans que le
système sache que c'est la même entreprise. Constat noté, non traité ici (§8).

Conséquence pratique : le seul canal vers un fournisseur est **son téléphone**.

### 1.5 Le rail WhatsApp existe déjà, et pour ce cas exactement

`WhatsAppOutboxFacade.enqueue(rawPhone, message)` (`notification/api`) met en file un message vers
n'importe quel numéro sans importer les internes du contexte notification. Sa javadoc dit pourquoi
il a été créé : « une alerte partenaire est adressée à un partenaire, elle n'a donc pas de
notification éleveur derrière elle ». C'est mot pour mot notre situation.

Deux propriétés qui comptent : le message est **mis en file, pas envoyé** — un ordonnanceur draine
l'outbox ; et l'appel **ne lève jamais** — un échec d'avis ne peut pas annuler l'enregistrement d'un
paiement.

À noter : **aucun client n'est prévenu par WhatsApp aujourd'hui**. Le rail sert l'éleveur, les
partenaires (qui ont signé) et les admins. Écrire à un fournisseur serait la première fois que la
plateforme s'adresse à un tiers commercial de l'éleveur — quelqu'un qui n'a rien accepté de Jawdi.
D'où l'interrupteur du §6.

### 1.6 La garde anti-double-comptage V25 est le précédent à respecter

`ExpenseRepository.sumDirectForUnit` exclut explicitement `STOCK_ENTRY` des sommes par lot, avec le
commentaire qui dit pourquoi : la charge est déjà comptée à l'entrée du stock. Le même piège guette
ici — si un paiement fournisseur créait une dépense, l'aliment serait compté deux fois et le **coût
de revient au kilo** du rapport de clôture deviendrait faux.

---

## 2. Périmètre

**Dedans** : un registre par fournisseur (dettes et paiements), le débit automatique à la réception
d'un bon d'achat, le solde et le relevé, les endpoints, la fiche fournisseur web en compte-courant,
et sur mobile le solde plus l'enregistrement d'un paiement. Plus **l'avis WhatsApp au fournisseur**
(§6), sous interrupteur par fournisseur.

**Dehors, volontairement** :

- **La dette par bande.** « Remboursé à la vente de la bande » décrit le rythme, pas une exigence de
  rattachement : le coût de l'aliment est déjà imputé au lot par le stock, donc le rapport de
  clôture reste juste. Rattacher chaque dette à une bande ajouterait un axe sans corriger un
  chiffre. À rouvrir si l'éleveur raisonne réellement « cette bande doit encore 300 000 ».
- **Les échéances et les relances.** Le provendier ne facture pas, il note sur un carnet.
- **L'affectation d'un paiement à une dette précise.** On verse sur le compte, pas ligne à ligne :
  c'est ainsi que la relation fonctionne.
- **Le tableau de bord.** Le total dû ira sur l'écran Finance, pas sur l'accueil, tant que ce n'est
  pas demandé.
- **Le rattachement `suppliers` ↔ `partners`.** Nommé au §1.4, laissé au §8 : il ouvre une question
  de confidentialité (quels curseurs de partage laissent un provendier voir ce qu'une ferme lui
  doit ?) qui mérite sa propre décision. Et il n'urge pas — une seule ferme a un partenaire rattaché
  aujourd'hui.
- **Un avis au fournisseur à la réception.** Il sait qu'il a livré ; le lui écrire est du bruit.

---

## 3. Décisions verrouillées

| # | Sujet | Choix |
|---|---|---|
| 1 | Forme | **Compte-courant** (registre à deux sens), et non paiement accroché au bon d'achat. Seule forme qui décrit la relation réelle et qui n'exige pas un bon d'achat pour qu'une dette existe. |
| 2 | Stockage | **Une table**, `supplier_ledger_entries`, avec une colonne `direction`. Un compte-courant est un journal chronologique ; deux tables feraient du relevé une UNION et du solde deux requêtes. |
| 3 | Emplacement | **`com.avicare.livestock.inventory`**, à côté des fournisseurs et des bons d'achat — comme les paiements clients vivent à côté des clients dans `livestock/commercial`. |
| 4 | Invariant | **Aucune ligne du registre ne crée jamais de dépense.** Garanti par la frontière de paquet (§4.2), pas par la discipline. |
| 5 | Montant du débit automatique | **La valeur reçue**, la même somme que celle passée à `recordPurchaseExpenses`. Jamais `po.totalXof`. |
| 6 | Ligne manuelle | **Conservée** : c'est elle qui sert le cas du carnet. Le risque de double saisie est assumé et rendu visible (§4.5). |
| 7 | Suppression | Seule une ligne `MANUAL` s'efface (soft delete). Une ligne dérivée d'un bon d'achat répond **422**. |
| 8 | Montants | `BIGINT amount_xof`, comme `payments` et `expenses` — le franc CFA n'a pas de décimales. Déviation assumée du doc 04 (« financier : NUMERIC(12,2) »), avec précédent : le code tranche quand les deux divergent. |
| 9 | Avis au fournisseur | **Interrupteur par fournisseur, défaut `FALSE`.** Rien ne part vers un tiers tant que l'éleveur ne l'a pas décidé pour ce fournisseur-là. Une fois activé, l'envoi est automatique, avec une case cochée d'avance dans la boîte de dialogue — un dernier regard. |
| 10 | Événements notifiés | **Bon d'achat envoyé** (la commande) et **paiement enregistré** (le reçu). Pas la réception : le fournisseur sait qu'il a livré. |
| 11 | Rattachement partenaire | **Non traité.** `suppliers` et `partners` restent deux tables sans jointure ; le constat est consigné au §8. |

---

## 4. Architecture

### 4.1 Le modèle de données

Migration `V54__supplier_ledger.sql`, plus `V55__supplier_whatsapp_optin.sql` au §6.2 — **les
numéros suivent l'ordre de merge** ; à renuméroter si une autre migration fusionne d'abord.

```sql
CREATE TABLE supplier_ledger_entries (
    id                BIGSERIAL PRIMARY KEY,
    farm_id           BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    supplier_id       BIGINT NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    direction         VARCHAR(10) NOT NULL CHECK (direction IN ('DEBIT', 'CREDIT')),
    source            VARCHAR(20) NOT NULL CHECK (source IN ('PURCHASE_ORDER', 'MANUAL')),
    amount_xof        BIGINT NOT NULL CHECK (amount_xof > 0),
    entry_date        DATE NOT NULL,
    label             VARCHAR(200),
    method            VARCHAR(20),
    reference         VARCHAR(100),
    notes             TEXT,
    purchase_order_id BIGINT REFERENCES purchase_orders(id) ON DELETE SET NULL,
    created_by        BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at        TIMESTAMP NOT NULL DEFAULT now(),
    updated_at        TIMESTAMP NOT NULL DEFAULT now(),
    deleted_at        TIMESTAMP NULL
);
```

Index : sur `(farm_id, supplier_id)` filtré `WHERE deleted_at IS NULL` (le relevé et le solde), sur
`farm_id` (la vue d'ensemble), et **unique partiel sur `purchase_order_id`** `WHERE
purchase_order_id IS NOT NULL AND deleted_at IS NULL` — un bon d'achat n'endette qu'une fois.

Trigger `trg_supplier_ledger_entries_updated_at`, conformément à la convention du doc 04.

`ON DELETE SET NULL` sur `purchase_order_id` plutôt que `CASCADE` : effacer un bon d'achat ne doit
pas effacer la trace d'une dette contractée. Ce choix évite aussi le piège
`softdelete_harddelete_fk_trap` déjà rencontré sur ce dépôt.

`ON DELETE RESTRICT` sur `supplier_id` est sûr et voulu : `suppliers` (V15) **n'a pas de
`deleted_at`** — un fournisseur se retire en passant `active` à `FALSE`. La désactivation n'orpheline
donc rien, et si quelqu'un tentait un jour une suppression physique, RESTRICT la refuserait plutôt
que de perdre un compte-courant. C'est aussi pourquoi les index de cette table filtrent sur
`deleted_at IS NULL` alors que ceux de `suppliers` filtrent sur `active` : les deux tables n'ont pas
la même mécanique d'effacement, et les copier l'une sur l'autre serait une erreur.

`method` et `reference` ne valent que pour un `CREDIT` ; la contrainte n'est pas posée en SQL mais
dans le service, qui est le seul écrivain.

### 4.2 L'invariant, rendu structurel

Le registre vit dans `livestock/inventory` et **n'importe rien du contexte `finance`**. Il n'a donc
aucun moyen d'écrire une `Expense`, même par erreur. L'invariant du §3-4 cesse d'être une règle
qu'on se rappelle pour devenir une frontière que le compilateur tient.

C'est le sens de la décision 3 : ce n'est pas un rangement, c'est la garantie.

### 4.3 Le débit automatique

Dans `PurchaseOrderService.receive`, à côté de l'appel existant à `recordPurchaseExpenses`, et sur
la même somme — `expenseLines` porte déjà la valeur réellement reçue, ligne par ligne :

```
somme(expenseLines) > 0  →  supplierLedgerService.recordPurchaseOrderDebit(
                                farmId, po.getSupplier().getId(), po.getId(),
                                po.getOrderNumber(), total, deliveryDate, userId)
```

Même paquet, donc appel direct : pas de façade, pas de nouvelle arête entre contextes. La méthode
est idempotente sur `purchase_order_id`, doublement — par l'index unique, et parce que `receive()`
n'est atteignable qu'une fois depuis `SENT`.

Un bon d'achat **annulé** ne produit rien : `cancel()` n'est atteignable que depuis `DRAFT` ou
`SENT`, donc avant tout débit.

### 4.4 Le service

`SupplierLedgerService` (`@Service`, `@RequiredArgsConstructor`) :

| Méthode | Rôle |
|---|---|
| `balance(farmId, supplierId)` | Σ débits − Σ crédits, une seule agrégation JPQL |
| `balances(farmId)` | le solde de chaque fournisseur, pour la liste et le total Finance |
| `statement(farmId, supplierId)` | les lignes par `entry_date` puis `id`, avec solde progressif |
| `recordPayment(...)` | `CREDIT` / `MANUAL` |
| `recordCharge(...)` | `DEBIT` / `MANUAL` — le cas du carnet |
| `recordPurchaseOrderDebit(...)` | `DEBIT` / `PURCHASE_ORDER`, appelé par la réception |
| `deleteEntry(farmId, entryId)` | soft delete, `MANUAL` uniquement |

Le **solde progressif est calculé côté serveur** dans `statement`, pas reconstitué par chaque
client : deux clients (web et mobile) qui recalculent la même colonne sont deux occasions de
diverger.

Un solde **positif** signifie que la ferme doit ; **négatif**, qu'elle a payé d'avance. Les deux
sont légitimes et l'interface les nomme différemment.

### 4.5 Le risque assumé de la double saisie

Une même livraison peut être saisie deux fois : une fois par un bon d'achat reçu, une fois à la
main. Rien ne peut le détecter de façon fiable — les montants, les dates et les libellés ne
suffisent pas à conclure.

Le parti pris : **rendre visible plutôt qu'empêcher**. Le relevé distingue à l'œil la ligne dérivée
d'un bon d'achat (avec son numéro, non supprimable) de la ligne manuelle (supprimable en un geste).
Un éleveur qui voit sa dette doubler a la ligne fautive sous les yeux et l'efface.

---

## 5. API

Sous `/api/v1/farms/{farmId}/inventory/suppliers`, dans un `SupplierLedgerController` distinct du
`SupplierController` — le fichier reste focalisé, conformément au principe d'isolation.

| Méthode | Chemin | Rôle | Garde |
|---|---|---|---|
| GET | `/balances` | solde de tous les fournisseurs + total | `InventoryAccess.READ` |
| GET | `/{supplierId}/ledger` | relevé + solde | `InventoryAccess.READ` |
| POST | `/{supplierId}/ledger/payments` | enregistrer un paiement | `InventoryAccess.WRITE_MANAGER` |
| POST | `/{supplierId}/ledger/charges` | déclarer une dette | `InventoryAccess.WRITE_MANAGER` |
| DELETE | `/{supplierId}/ledger/entries/{entryId}` | effacer une ligne manuelle | `InventoryAccess.WRITE_MANAGER` |

Gardes identiques au `SupplierController` existant. Un mouvement d'argent est de niveau gérant,
comme côté client (`CommercialAccess.WRITE_MANAGER`).

DTO : records Java 21. `method` reprend les valeurs de `PaymentMethod` déjà utilisées côté client,
plutôt qu'un second vocabulaire pour la même chose.

Codes d'erreur, selon la règle 400/422 fixée le 2026-09-05 (PR #303) : montant nul ou négatif →
**422** (règle métier) ; corps malformé → **400**. Un fournisseur ou une ligne appartenant à une
autre ferme → **404**, et non 403 : c'est le patron déjà en place (`VetVisitController.getInFarm`,
`NotFoundException.of`), et il ne divulgue pas l'existence de la ressource voisine.

---

## 6. Prévenir le fournisseur

### 6.1 Pourquoi WhatsApp, et pourquoi c'est bon marché à construire

Un fournisseur n'a pas de compte (§1.4) : son téléphone est le seul canal. Et le port existe déjà
(§1.5), avec les deux propriétés qu'il faut — mise en file plutôt qu'envoi synchrone, et aucune
exception qui remonte. L'enregistrement d'un paiement ne peut donc pas échouer parce que Konekt
est indisponible.

### 6.2 L'interrupteur

Migration `V55__supplier_whatsapp_optin.sql` — séparée de `V54` parce qu'elle modifie `suppliers`,
une table existante, et que le doc 04 demande une migration par sujet :

```sql
ALTER TABLE suppliers ADD COLUMN notify_whatsapp BOOLEAN NOT NULL DEFAULT FALSE;
```

Défaut `FALSE`, délibérément. Trois raisons : le message part chez quelqu'un qui n'a rien accepté de
Jawdi ; chaque envoi dépense un crédit Konekt ; et un avis parti chez celui à qui l'on doit de
l'argent ne se rattrape pas.

Le formulaire fournisseur gagne un interrupteur « Prévenir par WhatsApp », **désactivé et expliqué**
quand la fiche n'a pas de téléphone — un interrupteur qu'on peut activer sans effet est un
mensonge d'interface.

### 6.3 Les deux messages

**Bon d'achat envoyé** — déclenché dans `PurchaseOrderService.send()`, au passage `DRAFT → SENT`.
C'est l'acte de commander ; l'envoyer *est* le geste.

**Paiement enregistré** — déclenché à la création d'une ligne `CREDIT`, quelle que soit son origine
(web ou mobile).

Le contenu doit se lire par quelqu'un qui ne connaît pas Jawdi. Donc, dans cet ordre : **le nom de
la ferme** (sans lui, un numéro inconnu écrit des chiffres), ce qui s'est passé, le montant, la
date, et le solde restant **présenté comme la position de la ferme** — « selon mes comptes » — et
non comme une vérité opposable. Un compte-courant se réconcilie ; l'annoncer comme un fait
transformerait un outil de confiance en source de litige.

Pas de promesse de désabonnement dans le message. L'instance Konekt est un téléphone connecté dont
personne ne lit les réponses : écrire « répondez STOP » serait promettre ce qu'on n'honore pas. Le
message nomme la ferme, et c'est à elle que le fournisseur s'adresse — ce qui est aussi la vérité de
la relation.

### 6.4 Ce que l'envoi n'est pas

`enqueue` et non `enqueueBroadcast` : un avis fournisseur est **transactionnel**, déclenché par un
geste de l'éleveur, pas une campagne. La contrepartie est que le crédit dépensé n'est pas attribué à
une ferme dans le registre Konekt — acceptable au volume attendu, à revoir si les avis fournisseurs
deviennent un poste de dépense visible.

Un échec d'envoi **ne remonte pas** à l'utilisateur : le paiement est enregistré, c'est ce qui
compte. L'outbox porte déjà son propre statut et ses reprises.

---

## 7. Surfaces

### 7.1 Web

La fiche fournisseur devient un compte-courant, miroir de la fiche client livrée aux PR #97-101 :
solde en tête, relevé chronologique avec solde progressif, deux actions — « Enregistrer un
paiement » et « Ajouter une dette ».

La liste des fournisseurs gagne une colonne solde. L'écran Finance gagne **un seul nombre** : le
total dû aux fournisseurs.

Le formulaire fournisseur gagne l'interrupteur « Prévenir par WhatsApp » (§6.2). La boîte de
dialogue du paiement porte une case « Prévenir <nom> par WhatsApp », **cochée d'avance quand
l'interrupteur est actif** et absente sinon — le dernier regard avant qu'un message parte chez un
tiers.

### 7.2 Mobile

La règle permanente s'applique ([[web_feature_implies_mobile]]) : le solde est visible sur la liste
des fournisseurs et sur la fiche, et un paiement peut être enregistré.

**En ligne uniquement**, conformément à la décision déjà inscrite dans `mobile/src/sync/types.ts` :
les écritures d'argent ne passent pas par la file hors ligne, faute de déduplication côté serveur —
un paiement rejoué en créerait un second. Un avis WhatsApp rejoué serait pire encore : le
fournisseur recevrait deux reçus pour un versement.

L'écran `(field)/stocks/fournisseurs.tsx` et `suppliersApi` existent déjà des deux côtés, donc
l'interrupteur et la case de confirmation s'y posent sans créer de divergence de parité.

Le test `web/src/store/api/parity.test.ts` exigera que les URL appelées existent des deux côtés :
tout endpoint du registre appelé par le web sans équivalent mobile devra être branché ou inscrit
dans `KNOWN_DIVERGENCES` avec sa raison.

---

## 8. Tests

Le premier est celui qui compte :

1. **L'invariant.** Enregistrer un paiement, puis une dette manuelle, ne crée **aucune ligne
   `expenses`**. Écrit comme un test, pas comme un commentaire.
2. **Réception partielle → débit partiel.** Un bon d'achat de 100 sacs dont 60 arrivent endette de
   la valeur de 60.
3. **Unicité du débit par bon d'achat**, vérifiée jusqu'à la contrainte de base (Testcontainers).
4. **Relevé** : ordre chronologique et solde progressif exact, y compris quand deux lignes portent
   la même date.
5. **Solde négatif** : un paiement supérieur à la dette donne un solde d'avance, pas une erreur.
6. **422** sur suppression d'une ligne dérivée d'un bon d'achat.
7. **Isolation multi-tenant** : le registre d'une ferme est invisible depuis une autre — le
   fournisseur est déjà `farm_id`-scopé, la garde doit être prouvée et non supposée.

Puis, sur l'avis au fournisseur :

8. **Rien ne part quand l'interrupteur est à `FALSE`** — c'est le défaut, donc c'est le cas le plus
   fréquent et celui qu'une régression casserait en silence.
9. **Rien ne part quand la fiche n'a pas de téléphone**, interrupteur actif ou non.
10. **Un envoi qui échoue n'annule pas le paiement.** La ligne `CREDIT` existe, la transaction est
    commise. C'est la propriété que promet `WhatsAppOutboxFacade` ; on la vérifie plutôt que de la
    supposer.
11. **Le message nomme la ferme et le montant**, et présente le solde comme la position de la ferme
    (§6.3) — un test sur le texte, parce que ce texte est lu par quelqu'un qui ne connaît pas Jawdi.

Deux pièges connus du dépôt à traiter dans le même passage :

- Tout nouveau repository JPA doit être `@MockitoBean` dans **les six contextes DB-less**
  ([[dbless_three_contexts_and_merge_gate]]) — grepper l'ancre `FarmRepository`, ne jamais se fier
  au compte.
- `scripts/api-journey.py` rejoue le premier jour d'un éleveur en CI ; les nouveaux endpoints y
  seront ajoutés pour que tout 5xx casse le build.

---

## 9. Ce qui reste ouvert après ce chantier

**`suppliers` et `partners` ne sont pas joints** (§1.4). Le même provendier peut exister deux fois
dans la plateforme sans que le système le sache. Rattacher les deux permettrait à un provendier de
voir dans son portail ce que chaque ferme lui doit — mais cela ouvre une question de confidentialité
que cette spec ne tranche pas : quel curseur de partage autorise un fournisseur à lire la dette
d'une ferme ? À décider avant, pas pendant. Rien n'urge : une seule ferme a un partenaire rattaché.

La dette fournisseur est le premier des cinq arbitrages issus de la confrontation du 2026-09-05.
Restent : la **performance ponte** (un lot de pondeuses n'a aucun jugement de performance), le
**vide sanitaire** (absent du code, donc pas de rotation annuelle réelle), le **GMQ marginal** (la
décision « je vends aujourd'hui ou dans trois jours ? »), et la **reproduction** non déclarable dans
`PRODUCTION_FOCUS`.
