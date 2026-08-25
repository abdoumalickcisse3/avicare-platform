# Couche « Développer » (partenaire C2) — Design

> Cycle « c », couche 3 de la hiérarchie **Voir → Garder → Développer**.
> Réf. : `docs/superpowers/specs/2026-08-20-produit-partenaire-cooperative-design.md` §4 couche 3.

## 1. Problème

« Voir » fait signer, « Garder » fidélise. **« Développer » est ce qui se monétise** : dire au
provendier *quand* et *combien* chacune de ses fermes va recommander, pour qu'il prépare son
tonnage au lieu de le subir.

C'est aussi, contrairement aux deux premières couches, un **argument de vente** : un provendier qui
n'a pas signé comprend immédiatement la valeur d'un calendrier de recommande.

## 2. Ce qui existe déjà (et qui change le design)

`growth_performance.forecasted_target_date` porte **une prévision de fin de bande calculée sur la
croissance réelle** (GMQ observé projeté vers le poids cible), recalculée à chaque pesée par
`GrowthAnalysisService.forecast()`. La prévision n'est donc pas à inventer : elle existe par lot,
il faut l'agréger au niveau réseau et la filtrer par scopes.

Manque : `ProductionUnitInfo` (DTO cross-contexte) ne porte ni `startDate`, ni `targetAgeDays`, ni
la prévision → une nouvelle méthode de façade est nécessaire.

## 3. Décisions (arbitrées 2026-08-25)

| # | Sujet | Choix |
|---|---|---|
| 1 | Consentement | **Nouveau curseur `restock_forecast`**, 6ᵉ, **OFF par défaut** |
| 2 | Estimation du besoin | **Conso observée × jours restants** (`dailyFeedKg` moyenne 30 j) |
| 3 | Surface | **Onglet « Recommandes » dans le portail + export CSV** |
| 4 | Portée | **web ET mobile** pour le curseur (cf. §6) |

### Pourquoi un 6ᵉ curseur et pas `feed_consumption`

Les cinq curseurs existants ont été conçus pour la couche « Voir » : ils autorisent un partenaire à
*constater* un état. Une prévision de recommande est d'une autre nature — c'est une **prédiction
commercialement actionnable sur une ferme nommée** (« cette ferme aura besoin de 800 kg dans 12
jours »). Réutiliser `feed_consumption` étendrait rétroactivement la portée d'un curseur que des
éleveurs ont pu activer pour un usage plus anodin, sans qu'on le leur redemande.

Le curseur est OFF par défaut : l'éleveur doit vouloir être démarché.

## 4. Le calcul

Pour chaque ferme du réseau partageant **`restock_forecast`**, et pour chaque lot de chair ACTIF :

```
finPrévue   = growth_performance.forecasted_target_date   (si une pesée existe)
              sinon startDate + targetAgeDays              (repli théorique)
joursRestants = finPrévue − aujourd'hui
alimentRestantKg = dailyFeedKg × joursRestants
```

`méthode` (`GROWTH` | `THEORETICAL`) accompagne chaque ligne : le partenaire doit savoir s'il lit
une projection sur croissance réelle ou un simple âge théorique.

**Limite assumée** : `dailyFeedKg` est une moyenne 30 j, or la consommation monte avec l'âge →
l'estimation **sous-estime** la fin de bande. C'est un plancher, pas une cible. Affiché comme tel
(« au moins »). L'estimation par IC (poids cible − poids actuel) × effectif × FCR serait plus juste
mais exige des pesées récentes, la saisie la plus souvent oubliée : elle rendrait la prévision
vide là où elle est la plus utile.

Une ferme sans lot actif, sans `dailyFeedKg`, ou dont aucun lot n'a de date de fin calculable
n'apparaît pas — pas de ligne inventée.

## 5. Surface portail

Onglet **« Recommandes »** :
- En-tête : **tonnage à venir sur 30 jours** (somme des `alimentRestantKg` des lots finissant dans
  la fenêtre) + nombre de bandes concernées.
- Table triée par échéance : ferme · lot · effectif · fin prévue · jours restants · kg estimés ·
  méthode.
- **Export CSV** des mêmes lignes (l'équipe commerciale d'un provendier travaille sur tableur).
  Généré côté client depuis les données déjà chargées — aucun endpoint de fichier.

Réseau sans aucune ferme partageant le scope → état vide explicite qui **nomme la raison** :
« Aucun éleveur de votre réseau ne partage encore ses prévisions de recommande. » Le partenaire
doit comprendre que c'est un choix des éleveurs, pas une panne.

## 6. Portée web ET mobile (point relevé en cours de cycle)

Le curseur de partage est une **surface de consentement** : il existe déjà sur les deux clients
(`web/src/components/settings/PartnerNetwork.tsx` et
`mobile/app/(field)/reglages/partenaires.tsx`, même structure `OPERATIONAL`/`COMMERCIAL`).
Un 6ᵉ curseur livré uniquement sur web signifierait qu'un éleveur travaillant au téléphone **ne
peut ni voir ni révoquer** un consentement qui gouverne des prédictions commerciales sur sa ferme.
Inacceptable : le mobile est dans le périmètre.

**Dette constatée du cycle C1** : le co-branding (`partnerLogoUrl` + bloc « Mon réseau ») a été
livré web-only. Le champ backend existe et le mobile l'ignore silencieusement. Ce n'est pas une
surface de consentement, donc non bloquant — mais à rattraper (§8).

## 7. Hors périmètre

- Ciblage par circuit de distribution (V29 `sales_channel_key`) : la donnée existe, mais croiser
  canal de vente et prévision relève d'une segmentation commerciale à concevoir avec un vrai
  provendier. Pas de spéculation.
- Estimation par IC (cf. §4).
- Notification/push des recommandes à venir : le partenaire consulte, on ne le relance pas encore.

## 8. Suite

- Rattraper le co-branding mobile (bloc « Mon réseau » sur le dashboard field).
- Segmentation par circuit quand un provendier réel formule le besoin.
