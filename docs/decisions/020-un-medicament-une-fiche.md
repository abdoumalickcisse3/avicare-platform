# ADR 020 — Un médicament est un seul produit, à deux faces, à un seul solde

**Date** : 2026-11-01
**Statut** : Accepté
**Auteur** : Abdou Malick Cisse

## Contexte

Le 1er novembre 2026 à 14 h 00, le gérant d'une ferme pilote écrit :

> « Nous avons certains produits comme Hepaturyl en stock mais pour enregistrer le traitement ça ne
> s'affiche pas dans la liste des médicaments disponible afin que nous puissions le choix et
> enregistrer le traitement. »

Le journal de la base dit exactement ce qui s'est passé, et c'est un piège de la plateforme, pas
une erreur de l'utilisateur :

| Quand | Quoi |
|---|---|
| 02/10 09 h 51 | un gérant crée l'**article de stock** `HEPATONIC/HEPATURYL` (sous-catégorie `PRODUCT`, en litres) et en reçoit 2,5 L |
| 02/10 20 h 10 | quelqu'un crée, le même jour, le **traitement** `Hepathonique` dans la bibliothèque sanitaire — le contournement |
| 30/10 | +1 L reçu → **3,5 L en stock, jamais consommés** |
| 01/11 13 h 52 | le gérant, ne trouvant pas le produit dans le formulaire de traitement, va créer un **second** article de stock `Hepaturyl`, en kilogrammes cette fois |
| 01/11 14 h 00 | il signale le blocage |

La cause est une frontière invisible pour l'éleveur. Deux référentiels portaient les médicaments :

- `inventory_items` — les articles : bons d'achat, réceptions, soldes, consommation journalière ;
- `treatments` — la bibliothèque sanitaire : molécule, voies, **délais d'attente**.

Le formulaire de traitement ne lisait que le second. Et le formulaire « nouvel article » ne
proposait que `FEED`, `CONSUMABLE`, `EQUIPMENT`, `PRODUCT` : **aucun chemin ne menait du stock vers
le traitement**. Un éleveur qui achète un médicament n'avait, depuis l'écran où il l'achète, aucune
façon de le rendre administrable.

Trois dégâts mesurés sur cette ferme :

1. **15 articles médicamenteux** déclarés en `INVENTORY`, donc invisibles au formulaire de
   traitement — vaccins compris.
2. Le bloc « décrémenter le médicament du stock » était filtré sur la **source** de l'article
   (`TREATMENT`) : il ne proposait jamais le stock réellement détenu. Sur 17 mouvements portant un
   médicament, **un seul** est un `CONSUMPTION_TREATMENT` ; les autres sont décomptés à la main
   depuis le journalier.
3. Le même flacon portait **deux soldes** : `vigosine` existait à `TREATMENT = 0` et
   `INVENTORY = 0,97`. `stock_items` est unique par `(ferme, source, clé)` — deux faces, deux
   lignes, deux chiffres pour un seul bidon.

Un quatrième défaut a été trouvé en chemin : `slugify` ne produisait pas la même clé sur les deux
applications (`amine-totale` sur le web, `amine_totale` sur le téléphone). Le même produit saisi
sur l'une puis l'autre devenait deux produits.

## Décision

**Un médicament est un produit unique, écrit sur ses deux faces en une seule fois, et son solde
vit d'un seul côté.**

1. **Une écriture, deux faces.** `MedicationCatalogService` écrit, dans la même transaction,
   l'article (`inventory_items`, sous-catégorie `MEDICATION`) **et** la fiche médicale
   (`treatments`), sous la **même clé**. Un seul endpoint : `POST
   /farms/{farmId}/inventory/catalog/medications`. Les deux formulaires — « nouvel article » côté
   Stock sur le web, « nouveau traitement » côté Sanitaire sur le web et le mobile — sont désormais
   deux portes sur la même fiche. Les écritures directes sur `treatments` ont été retirées des deux
   frontends.

2. **Le solde est sur la face `INVENTORY`, jamais sur `TREATMENT`.** C'est la contrainte d'unicité
   de `stock_items` qui l'impose : toute autre règle autorise deux chiffres pour un flacon. La
   liste des articles stockables dédoublonne donc par clé, et **`INVENTORY` gagne**. Un traitement
   sans article à lui — une molécule de la plateforme, ou un médicament antérieur à la passerelle —
   reste proposé : rien de ce qui est déjà stocké ne devient innommable.

3. **Le filtre « c'est un médicament » porte sur l'article, pas sur sa source.** Un article de
   sous-catégorie `MEDICATION` **ou** de source `TREATMENT` est administrable. Juger sur la source
   seule est précisément ce qui cachait les médicaments réellement détenus.

4. **La fiche médicale est gardée par son module, l'article ne l'est pas.** L'article de stock est
   la donnée de la ferme et s'écrit toujours. La fiche `treatments` ne s'écrit que si la ferme
   détient vraiment `module.health.advanced` : l'écrire quand même ferait de cette route une porte
   de service sur un catalogue gardé — le contournement par chemin frère nous a déjà coûté une
   garde. La réponse porte `medicalSheetWritten`, et l'écran le dit au lieu de laisser croire.

5. **Les deux applications fabriquent la même clé.** `slugify` mobile passe du tiret bas au tiret,
   à l'identique du web, et les deux plafonnent à 100 caractères — la longueur que la colonne
   accepte. Les clés existantes ne changent pas : une clé est immuable à l'édition.

## Conséquences

- **Migration V68.** Chaque traitement propre à une ferme reçoit sa face « article » si elle
   manque ; une ligne de stock `TREATMENT` **devient** une ligne `INVENTORY` — même `id`, mêmes
   mouvements, même solde, on ne change que le catalogue qui la définit. Aucune quantité n'est
   modifiée et aucun mouvement n'est inventé : le journal reste en ajout seul (V66).
- **Les collisions ne sont pas fusionnées en silence.** Si les deux faces portent déjà une ligne,
   `INVENTORY` fait foi et la ligne `TREATMENT` n'est désactivée **que si elle est à zéro**.
   Au-delà, elle reste visible : fusionner deux soldes réels est une décision de l'éleveur.
   Rejouée sur les données de production avant écriture, la migration crée 6 articles, relabellise
   2 lignes en conservant `tetracolevite` à 0,770, neutralise la seule collision (`vigosine`, à 0)
   et ne laisse aucune clé à deux lignes actives.
- **Les molécules de la plateforme ne sont pas miroitées.** Ce sont des références médicales, pas
   des articles que chaque ferme prétend stocker : les matérialiser imposerait une ligne de stock
   vide par molécule et par ferme. Une ferme qui veut en stocker une la déclare comme son
   médicament, en partant de l'entrée plateforme.
- **La porte du médicament diffère entre les deux applications, délibérément.** Le web en a deux
   (Stock et Sanitaire) ; le mobile n'en a qu'une, Sanitaire, seul écran capable de demander les
   délais d'attente — l'éditeur de catalogue générique du téléphone ne sait pas les demander, et y
   ajouter « Médicament » recréerait la demi-fiche que cet ADR supprime. La capacité est entière
   des deux côtés ; c'est le chemin qui est plus court sur grand écran.
- **Un doublon créé avant la passerelle reste un doublon.** Les clés voisines de la ferme pilote
   (`amin-total` / `amine-total`, `hepathonique` / `hepatonic-hepaturyl`, `hepaturyl` en kg) ne
   peuvent pas être rapprochées automatiquement : seul l'éleveur sait si deux noms désignent le
   même produit. Le nettoyage se fait par l'API, après déploiement.
- **Ce qui reste ouvert** : l'écran de traitement mobile ne porte aucun bloc de décrément de
   stock. C'est un écart de parité réel, antérieur à cet ADR, et traité séparément.

## Alternatives écartées

- **Fusionner les deux listes à la lecture, côté formulaire de traitement.** Plus léger : le
  formulaire proposerait l'union des articles et des traitements. Mais un article de stock ne porte
  pas de délai d'attente ; administrer un médicament sans délai connu fait projeter une date de
  vente fausse, et une mauvaise date de vente est pire qu'une saisie retardée. La donnée qui
  protège l'éleveur serait devenue optionnelle.
- **Tout basculer sur un référentiel unique.** Séduisant, mais `treatments` est une catégorie de
  catalogue plateforme gardée par un module, partagée avec les programmes de vaccination et les
  instantanés de délai d'attente. La fondre dans `inventory_items` demanderait de déplacer ces
  trois lecteurs pour un gain que la clé commune apporte déjà.
- **Ajouter « Médicament » au formulaire d'article sans écrire la fiche médicale.** C'est le piège
  d'origine avec un libellé de plus : le produit apparaîtrait dans le stock et resterait absent du
  formulaire de traitement.
- **Laisser le solde sur la face `TREATMENT` quand elle en porte déjà un.** Conserve un historique
  de plus, mais garde deux lignes vivantes pour un flacon — l'incohérence que cet ADR existe pour
  fermer.
