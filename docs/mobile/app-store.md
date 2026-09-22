# Publier Jawdi sur l'App Store

> Décidé le 2026-09-14 : **compte Apple individuel**, **App Store uniquement** (Play plus tard).
> Objectif assumé : la crédibilité devant un partenaire, pas encore la distribution — au Sénégal,
> les éleveurs sont sur Android.

## L'état réel au moment d'écrire

L'app **n'est pas soumettable**, et pas pour des raisons cosmétiques. Sept points, du plus grave
au plus simple :

| # | Constat | Où |
|---|---|---|
| 1 | **Aucune suppression de compte dans l'app** → rejet garanti (règle Apple 5.1.1(v)) | mobile + backend |
| 2 | `extra.apiUrl = http://localhost:8080` → le build de production parle à localhost, et iOS bloque le HTTP en clair (ATS) | `mobile/app.json` |
| 3 | Aucun `ios.bundleIdentifier` → aucun build possible | `mobile/app.json` |
| 4 | `"name"` et `"slug"` valent `"mobile"` → l'app s'installe sous le nom « mobile » | `mobile/app.json` |
| 5 | `icon.png` est le **gabarit Expo par défaut** (un « A » bleu avec les repères de construction) | `mobile/assets/icon.png` |
| 6 | `"scheme": "avicare"` → ancien nom de marque dans les liens profonds | `mobile/app.json` |
| 7 | Pas de `eas.json`, EAS jamais initialisé | `mobile/` |

Ce qui est **déjà bon** : les pages `/confidentialite` et `/mentions-legales` répondent 200 (Apple
exige une URL de politique de confidentialité) ; les textes de permission micro et reconnaissance
vocale sont rédigés en français dans `app.json` ; l'app n'utilise **pas** de connexion Google ou
Facebook, donc **« Sign in with Apple » n'est pas exigé** — c'est une confusion fréquente, la règle
ne s'applique qu'aux apps proposant une identification tierce.

---

## Phase 1 — Le compte Apple (chemin critique, à lancer en premier)

**99 $/an**, sur `developer.apple.com/programs/enroll`.

- Identifiant Apple avec **double authentification activée**, et un nom légal correspondant à une
  pièce d'identité officielle.
- **Le paiement demande une carte internationale.** Wave et Orange Money ne fonctionnent pas. C'est
  le point de friction le plus probable de toute cette phase — à régler avant le reste.
- Délai habituel : 24 à 48 h. L'app sera publiée sous « Abdou Malick Cisse », pas sous un nom
  d'entreprise ; une bascule vers un compte Organisation reste possible plus tard (démarche à part,
  et elle exige un numéro D-U-N-S).

**Il faut aussi un iPhone réel.** Le build se fait dans le nuage (aucun Mac nécessaire), mais
TestFlight sert précisément à essayer l'app sur un vrai appareil. Sans iPhone sous la main, on
soumet à l'aveugle.

---

## Phase 2 — Rendre l'app identifiable

Dans `mobile/app.json` :

| Champ | Valeur visée | Pourquoi |
|---|---|---|
| `name` | `Jawdi` | C'est le nom sous l'icône |
| `slug` | `jawdi` | Identifiant du projet EAS |
| `scheme` | `jawdi` | L'ancien `avicare` traîne la marque abandonnée |
| `ios.bundleIdentifier` | `app.jawdi.mobile` | DNS inversé du domaine possédé. **Immuable après publication** |
| `ios.supportsTablet` | `false` | Aujourd'hui `true` → Apple exigera des captures iPad et testera sur iPad. Rien dans Jawdi n'est pensé pour une tablette |
| `ios.buildNumber` | géré par EAS (`appVersionSource: "remote"`) | Évite les collisions de numéro de build |

**L'icône** doit être refaite : 1024×1024, **sans canal alpha et sans coins arrondis** (Apple
rejette les deux, et arrondit lui-même). Le cahier des charges existe déjà dans
`docs/brand/cahier-des-charges-logo.html` — le logo, lui, n'est pas encore dessiné. C'est un
prérequis, pas un détail.

> **Fait (2026-09-22)** : piste « la marque au fer » retenue et validée (`docs/brand/logo/`),
> icône posée sur le vert déjà en place côté web (`#1B3F1B`) — `mobile/assets/icon.png` (1024×1024,
> sans alpha) et le jeu d'icônes adaptatives Android sont à jour. Détail dans
> `docs/mobile/fiche-app-store.md`.

### L'URL d'API — le point le plus dangereux

Aujourd'hui l'URL vit en dur dans `app.json`. Un build de production irait parler à `localhost`, ce
qui donne une app qui s'ouvre, affiche l'écran de connexion, et échoue sur tout. Apple rejette au
titre de la règle 2.1 (« app incomplète ») — et de toute façon c'est inutilisable.

Il faut la faire dépendre du profil de build (`app.config.js` lisant `process.env`, ou variables
d'environnement EAS), avec **`https://app.jawdi.app` en production**. Le HTTPS n'est pas une
préférence : l'App Transport Security d'iOS bloque le HTTP en clair.

---

## Phase 3 — La suppression de compte (le vrai chantier)

**Règle 5.1.1(v)** : toute app qui permet de créer un compte doit permettre de **le supprimer
depuis l'app**. Pas par courriel, pas par un formulaire web, pas par le support.

L'anonymisation existe déjà (`ComplianceService.anonymizeUser`) mais elle n'est exposée que sur
`AdminComplianceController`, réservée à l'administrateur. Un endpoint admin **ne satisfait pas** la
règle.

À construire :

1. **Backend** — un endpoint en libre-service (`DELETE /api/v1/auth/me` ou équivalent) réutilisant
   la logique d'anonymisation existante, avec ré-authentification par mot de passe.
2. **Mobile** — un écran dans Réglages, qui dit clairement ce qui disparaît et ce qui reste.
3. **Web** — la parité, par principe (`web feature implies mobile`, et l'inverse).

> **La question à trancher avant de coder** : que devient une ferme dont le propriétaire supprime
> son compte, alors qu'elle porte des bandes, des factures et d'autres membres ? Supprimer en
> cascade détruirait le travail d'autrui ; refuser la suppression violerait la règle Apple. La
> réponse habituelle est de **bloquer tant que la propriété n'a pas été transférée**, en le disant
> clairement — mais c'est une décision produit, pas technique.

---

## Phase 4 — EAS

```bash
npm install -g eas-cli && eas login
cd mobile && npx eas-cli@latest init
```

`eas.json`, profil production avec `autoIncrement`, puis les identifiants de signature — EAS les
génère et les gère seul (`eas credentials`), il n'y a pas de certificat à fabriquer à la main.

---

## Phase 5 — La fiche App Store

À préparer **en français** (langue principale : storefront Sénégal).

| Élément | Contrainte |
|---|---|
| Nom | 30 caractères |
| Sous-titre | 30 caractères — c'est lui qui vend, pas la description |
| Mots-clés | 100 caractères, séparés par des virgules, sans espaces |
| Description | 4 000 caractères — le référentiel produit (`docs/brand/`) en fournit la matière |
| Captures d'écran | **iPhone 6,9″ obligatoires** (1320×2868). Pas d'iPad si `supportsTablet: false` |
| URL de confidentialité | `https://jawdi.app/confidentialite/` — déjà en ligne |
| Catégorie | Économie et entreprise (il n'existe pas de catégorie agriculture) |
| Classification | 4+ |

**Étiquettes de confidentialité** — à déclarer honnêtement : nom, courriel, téléphone, et le
contenu saisi par l'utilisateur (données de ferme), tous **liés à l'identité**, aucun utilisé à des
fins de suivi publicitaire.

**Conformité export** : l'app ne fait que du HTTPS standard, donc elle relève de l'exemption
habituelle — à déclarer, pas à ignorer (`ITSAppUsesNonExemptEncryption`).

---

## Phase 6 — TestFlight, puis soumission

Sur un iPhone réel, vérifier au minimum :

- le parcours inscription → création de ferme → première saisie ;
- **le mode avion** : les saisies de terrain doivent s'empiler et repartir seules ;
- la demande de permission micro, en français ;
- la sortie d'une facture en PDF et son partage.

Pour la soumission, deux choses font la différence entre 48 h et trois semaines :

1. **Un compte de démonstration**, avec des données réalistes. Jawdi exige une connexion : sans
   identifiants, le relecteur ne voit rien et rejette. Une ferme vide est presque aussi mauvaise —
   il faut des bandes, des ventes, des dépenses.
2. **Des notes de relecture** expliquant ce qu'est le produit, que les alertes partent par WhatsApp
   **hors de l'app**, et comment essayer le mode hors-ligne.

---

## Le piège à ne pas tendre soi-même : le paiement

Le modèle de facturation conçu dans `docs/gtm/modele-abonnement.md` prévoit un paiement **au cycle,
par Wave ou Orange Money**.

Si l'app iOS propose un jour d'acheter quoi que ce soit, Apple impose son achat intégré, prend
**15 à 30 %**, et **interdit Wave et Orange Money** pour ce paiement. Cela viderait le modèle de
son sens.

**La parade, classique et parfaitement acceptée** : l'app iOS reste **gratuite et muette sur le
paiement** — pas de tarif affiché, pas de bouton d'achat, pas de lien vers une page de paiement.
La facturation se règle ailleurs, comme le font les logiciels professionnels vendus aux
entreprises. C'est une décision à prendre **maintenant**, pas après un premier rejet.

---

## Coûts et ordre de bataille

| Poste | Coût |
|---|---|
| Apple Developer Program | 99 $/an, carte internationale obligatoire |
| Builds EAS | offre gratuite limitée ; au-delà, offre payante |
| Icône Jawdi | à produire |

**L'ordre qui économise le plus de temps** : lancer l'inscription Apple *aujourd'hui* (c'est le
seul délai qu'on ne peut pas compresser), puis traiter la suppression de compte pendant que
l'inscription est instruite — c'est le seul vrai développement de la liste. La configuration,
l'icône et la fiche se font ensuite, et se vérifient vite.
