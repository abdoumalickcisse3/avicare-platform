# 11 — Go-To-Market V1

> Statut : **adopté** (2026-07-18). Complète la thèse de monétisation B2B2C actée en ADR-009
> (pilote gratuit, abonnement self-serve retiré, monétisation via les partenaires du canal).
> Ce document est le plan d'exécution commercial ; il évoluera aux passages de phase.

## 0. Situation de départ (assumée, datée 2026-07-18)

| Réalité | Conséquence sur le plan |
|---|---|
| **0 ferme réelle** (seule la démo existe) | On démarre en Phase 0 : recrutement à la main. |
| **Side-project** (~5-8 h/semaine) | Cadence asynchrone, WhatsApp-first, effectifs volontairement petits. |
| **Réseau existant : éleveurs uniquement** (famille/amis) | La « zone » de départ = les localités de ce réseau. Les partenaires B2B viendront **par les éleveurs** (intro chaude), pas en prospection froide. |
| **Pas de VPS avant fin juillet 2026** (contrainte budget) | Phase –1 décalée ; les semaines d'attente servent à la préparation gratuite (§2). |
| Produit V1 complet, gratuit pendant le pilote ; landing 16 pages en ligne côté code (PR #127) mais **rien de déployé** | Le déploiement est LE préalable — rien d'autre ne compte avant. |

**Principe directeur : densité > couverture.** Une ferme isolée à 200 km coûte 10× plus cher en
support et ne parraine personne. Toute croissance se fait par contiguïté : mêmes localités,
mêmes fournisseurs, mêmes marchés. « Ça mord partout » n'est pas une stratégie.

**Deuxième principe : la saisie EST le produit.** Sans saisie journalière, rien en aval n'existe
(stock, dépenses, marge, preuve, GTM). Toutes les métriques du §7 découlent de là.

**Troisième principe : respecter la physique du produit.** Le moment « aha » — la marge réelle
d'une bande affichée — n'arrive qu'en **fin de cycle** (~45 j en chair). Un pilote se juge sur
un cycle complet, pas sur une semaine. D'où des phases de 2-3 mois, incompressibles.

## 1. Vue d'ensemble

```
Phase –1  Mise en production           fin juil. → mi-août 2026   (bloquée par l'achat du VPS)
Phase 0   5 fermes, 2 cycles           mi-août → mi-nov. 2026
Phase 1   Pack Preuve + parrainage     mi-nov. → mi-déc. 2026
Phase 2   Coin B2B2C (1 partenaire)    déc. 2026 → fév. 2027
Phase 3   Bascule monétisation         à partir du T1 2027, sous conditions (§6)
```

Chaque phase a un **critère de sortie** chiffré. On ne passe pas à la suivante sans lui —
c'est la protection contre la dispersion.

## 2. Semaines sans serveur (maintenant → achat du VPS, fin juillet 2026)

Tout ceci est **gratuit** et fait gagner un mois :

- [ ] **Choisir les 5 fermes pilotes** (critères §3) et obtenir leur accord de principe.
- [ ] Ouvrir le **numéro WhatsApp Business** AviCare (gratuit) ; préparer le message d'accueil.
- [ ] Rédiger la **checklist d'onboarding** (45 min : créer ferme → bande → première saisie ensemble).
- [ ] Écrire le **script de la démo vocale de 3 min** (FR, puis version wolof) — l'enregistrement
      attendra que l'app soit en ligne pour montrer le vrai produit.
- [ ] Rassembler les **textes légaux** : raison sociale, adresse, contacts — les `{{PLACEHOLDER}}`
      des pages Mentions légales / Confidentialité du landing doivent être remplis avant mise en ligne.
- [ ] Choisir et réserver le **nom de domaine** (coût faible, indépendant du VPS).
- [ ] Préparer les valeurs des variables `PUBLIC_APP_SIGNUP_URL`, `PUBLIC_PARTNER_EMAIL`,
      `PUBLIC_SITE_URL`, `PUBLIC_CONTACT_PHONE` pour le déploiement du landing.

## 3. Phase –1 — Mise en production (dès l'achat du VPS, fin juillet 2026)

Le deploy-kit existe (`infra/`, PR #120 : Docker Compose, Caddy HTTPS, scripts deploy/backup).
Recommandation actée : **Hetzner CX32 (~8 €/mois)**.

1. Provisionner le VPS, pointer le domaine, dérouler `infra/` (backend + web + landing).
2. Renseigner les env `PUBLIC_*` et les textes légaux préparés au §2.
3. Vérifier le parcours complet **depuis un téléphone** : landing → inscription → création de
   ferme → première saisie.

**Critère de sortie :** un éleveur peut s'inscrire seul depuis son téléphone, et une question
posée sur le WhatsApp Business reçoit une réponse.

## 4. Phase 0 — Cinq fermes, deux cycles (mi-août → mi-novembre 2026)

**Cinq fermes, pas dix.** Critères de sélection :

- une bande en cours ou qui démarre sous 2 semaines ;
- un smartphone et l'habitude de WhatsApp ;
- **au maximum deux localités** (concentration du bouche-à-oreille) ;
- au moins un profil « champion » probable (curieux, influent localement).

**Rituel :**

- **Onboarding accompagné** (45 min, en personne ou appel long) : on crée la ferme, la bande et
  la première saisie *avec* l'éleveur. Jamais « voici l'app, débrouille-toi ».
- **Groupe WhatsApp des pilotes** : chaque lundi, « le chiffre de la semaine » (mortalité moyenne
  du groupe, meilleure marge…). Chaque question posée = un bug ou une feature à noter.
- **Cadence side-project** : lundi 30 min (relance saisies) · mercredi 30 min (revue données,
  correctifs) · samedi 1 visite ou appel long.

**Le moment à fabriquer :** la **marge réelle de fin de bande** vue par l'éleveur. Capture
d'écran (avec permission) — c'est la matière première de la Phase 1.

**Critère de sortie :** ≥ 4 fermes sur 5 saisissent encore chaque semaine après un cycle
complet, et ≥ 2 comptes de résultat de bande sont bouclés.

## 5. Phase 1 — Pack Preuve (mi-novembre → mi-décembre 2026)

Convertir les données pilotes en munitions :

- **Le landing dit enfin vrai** : remplacer les témoignages illustratifs et repères par de vrais
  chiffres — « X bandes suivies », un témoignage nommé (photo, village), une vraie marge.
- **2 études de cas d'une page** : avant/après, mortalité et marge chiffrées.
- **Démo vocale de 3 min** (FR + wolof) qui circule sur WhatsApp — la vraie « page d'accueil »
  du marché sénégalais.
- **Parrainage** : chaque pilote présente 1-2 éleveurs. Cible : **12-15 fermes, mêmes localités**.

**Critère de sortie :** ≥ 12 fermes actives, churn < 20 %, pack preuve publié.

## 6. Phase 2 — Le coin B2B2C, par la porte des éleveurs (décembre 2026 → février 2027)

Aucun contact provendier aujourd'hui — mais **chaque éleveur pilote achète son aliment quelque
part**. Chaque pilote est une introduction chaude vers son fournisseur.

**Le pitch provendier** (jamais « achetez mon logiciel ») :

> « X de **vos propres clients** utilisent déjà AviCare. Un éleveur qui suit ses chiffres achète
> plus d'aliment, plus régulièrement, et reste chez vous. Équipez votre réseau — et je vous
> donne la vue agrégée dessus. »

- L'offre = le palier **« Sur mesure »** de la page Tarifs.
- La **vue réseau partenaire** (marquée « à venir » sur la page Partenaires) ne se construit
  **que lorsqu'un partenaire signe** — pas avant (YAGNI commercial).
- Même mouvement avec les **vétérinaires** enregistrés dans l'app : prescripteurs naturels.
- Les **circuits de distribution** (PR #133) instrumentent ce GTM : taguer l'origine des fermes
  et des ventes pour savoir quel canal nourrir.

**Critère de sortie : un partenaire signé.** Un seul suffit.

## 7. Phase 3 — Bascule monétisation (T1 2027, sous conditions)

Ne s'active que si : rétention prouvée (§8) **et** 1 partenaire signé **et** charge support
tenable en solo.

- **Cohorte pilote** : récompensée, jamais punie — 6 mois gratuits puis −50 %, à vie.
- **Fermes via partenaire** : le partenaire paie (Sur mesure), l'éleveur gratuit ou subventionné.
- **Paiement** : Wave **enregistré manuellement** d'abord (comme le module Paiements de l'app le
  fait pour les éleveurs) ; passerelle plus tard, si le volume le justifie.

## 8. Métriques (calculables depuis la base AviCare)

| Métrique | Définition | Seuil de santé |
|---|---|---|
| **Activation** | ferme avec 1 bande + 7 saisies dans les 14 premiers jours | ≥ 80 % des onboardées |
| **Rétention hebdo** | ≥ 3 saisies/semaine | ≥ 70 % des fermes actives |
| **Time-to-aha** | jours jusqu'au 1er compte de résultat de bande | ≤ 50 j |
| **Parrainage** | intros d'éleveurs par pilote | ≥ 1 |

## 9. Les cinq règles (anti-dispersion)

1. **Densité > couverture.** Croissance par contiguïté uniquement.
2. **La saisie est le produit.** Toute l'attention support va là.
3. **Un cycle complet avant de juger.** Le wow est en fin de bande.
4. **Pas de partenaire sans preuve.** Un provendier ne te reçoit qu'une fois.
5. **En side-project, chaque heure compte.** Tout ce qui n'est pas les 5 fermes est un « non ».
