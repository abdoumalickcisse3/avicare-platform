# La fiche App Store de Jawdi

> Phase 5 de `docs/mobile/app-store.md`. Contenu prêt à coller dans App Store Connect une fois
> l'accès disponible (Phase 4 faite : projet EAS `@malick01/jawdi` lié). Langue principale :
> français (storefront Sénégal).

## Nom (30 caractères max)

```
Jawdi : gestion d'élevage
```

25 caractères. `name` dans `app.json` reste `Jawdi` seul (c'est ce qui s'affiche sous l'icône,
l'espace y est plus contraint) — App Store Connect a son propre champ « Nom », plus long, qui peut
porter le descriptif.

## Sous-titre (30 caractères max)

```
Marge par bande, en un clic
```

27 caractères. C'est lui qui vend en tête de fiche, pas la description — repris du principe
central du référentiel produit (`docs/brand/jawdi-referentiel.html` §2) : tout le produit vise la
marge de fin de bande.

## Mots-clés (100 caractères, virgules, sans espaces)

```
élevage,volaille,poulet,aviculture,ferme,gestion,agriculture,bétail,cheptel,Sénégal,compta
```

90 caractères. Pas de mot déjà présent dans le nom ou le sous-titre (Apple les indexe ensemble,
les répéter gaspille le quota).

## Description (4 000 caractères max)

Voir `docs/mobile/store/description.txt` — texte prêt à coller, dérivé du référentiel produit.
Compte actuellement ~2 000 caractères, large marge sous la limite.

## Catégorie

**Économie et entreprise** (« Business ») — il n'existe pas de catégorie agriculture sur l'App
Store. Catégorie secondaire : aucune nécessaire.

## Classification par âge

**4+**. Aucun contenu utilisateur public, pas de contenu généré par d'autres utilisateurs visible,
pas de violence ni de contenu réservé aux adultes.

## URL

| Champ | Valeur |
|---|---|
| Confidentialité | `https://jawdi.app/confidentialite/` (en ligne, vérifié 200) |
| Assistance | `https://jawdi.app/contact` (en ligne, vérifié 200 — le formulaire redirige déjà vers WhatsApp) |
| Marketing (optionnelle) | `https://jawdi.app` |

## Étiquettes de confidentialité (« App Privacy »)

À déclarer honnêtement dans App Store Connect, catégorie par catégorie :

| Donnée | Collectée | Liée à l'identité | Utilisée pour du tracking publicitaire |
|---|---|---|---|
| Nom | Oui | Oui | Non |
| Courriel | Oui | Oui | Non |
| Numéro de téléphone | Oui | Oui | Non |
| Contenu utilisateur (données de ferme : bandes, ventes, dépenses) | Oui | Oui | Non |
| Identifiants (mot de passe) | Oui (haché, jamais en clair) | Oui | Non |

Aucune donnée utilisée à des fins de suivi publicitaire ; pas de SDK publicitaire ou d'analytics
tiers embarqué dans le mobile à ce jour — à revérifier si un SDK est ajouté avant soumission.

## Texte promotionnel (170 caractères, modifiable sans nouvelle relecture)

```
Gratuit aujourd'hui, tous les modules actifs. Saisie 1 min/jour, hors ligne, alertes WhatsApp — et la marge de chaque bande à sa clôture.
```

## Notes de version (première soumission)

```
Première version de Jawdi : suivi journalier des bandes, sanitaire, stocks, ventes et finance,
avec alertes WhatsApp et fonctionnement hors ligne au poulailler.
```

## Notes de relecture (App Review Information)

À coller dans le champ « Notes » d'App Store Connect, pour le relecteur Apple — pas visible au
public :

```
Jawdi est un logiciel de gestion pour les élevages de volaille (poulet de chair et poules
pondeuses), utilisé au Sénégal. Un compte existe déjà pour la relecture (identifiants ci-dessous),
avec une ferme contenant des données réelles : bandes en cours et clôturées, ventes, dépenses.

Fonctionnement hors ligne : les écrans de saisie de terrain (saisie journalière, mortalité, pesée,
vaccination, observation) s'utilisent aussi en mode avion — activez-le avant de saisir, les
données partent seules au retour du réseau. La file d'attente est visible sous Réglages.

Alertes WhatsApp : l'application envoie certaines alertes (stock bas, mortalité anormale,
vaccination en retard) par WhatsApp, en dehors de l'app, vers le numéro du compte. C'est un
comportement normal et documenté, pas une fonctionnalité cassée si rien n'apparaît dans l'app
elle-même pour ces cas.

Identifiants de démonstration :
  Courriel : demo.appstore@jawdi.app
  Mot de passe : AppleReview#2026

Contact en cas de blocage : +221 70 475 69 96 (WhatsApp) ou malick.cisse@nlogicsolutions.com.
```

## Captures d'écran — fait

Taille réelle exigée par App Store Connect pour la catégorie « iPhone 6,5 pouces » (confirmée dans
l'UI live, pas dans la doc Apple générique) : une image parmi 1242×2688, 2688×1242, 1284×2778 ou
2778×1284. La note précédente (6,9″, 1320×2868) était erronée — corrigée ici.

13 captures réelles prises sur appareil (`docs/brand/screen/IMG_6446.PNG`–`IMG_6458.PNG`,
1170×2532, même ratio 19,5:9 que 1284×2778) ont servi de source. 8 compositions finales à
1284×2778 — habillage vert de marque (`tokens.primary[800]`/`[700]`), typographie Outfit,
accroche + sous-titre par écran, cadre de téléphone avec ombre — sont dans
`docs/mobile/app-store-screenshots/01-…` à `08-…`, prêtes à téléverser telles quelles :

1. Accueil — vue d'ensemble de la ferme
2. Élevage — liste des lots
3. Élevage — détail d'un lot (courbe de croissance)
4. Saisie journalière (mortalité, aliment, eau)
5. Suivi sanitaire (vaccins, traitements)
6. Œufs / ponte
7. Finance (dépenses)
8. Commerce — vente directe

Note : les écrans de démarrage et de connexion (IMG_6446/6447) portent encore l'ancien logo
clipart et n'ont pas été retenus pour éviter une incohérence de marque avec la nouvelle icône
« marque au fer » déjà en place.

## Icône — fait

Piste « la marque au fer » validée (`docs/brand/logo/`, étapes 1 et 2 du cahier des charges).
`mobile/assets/icon.png` refait : 1024×1024, sans canal alpha, fond `#1B3F1B` (le vert déjà utilisé
par l'icône PWA du web) et symbole blanc. Le jeu d'icônes adaptatives Android
(`android-icon-foreground.png`, `android-icon-background.png`, `android-icon-monochrome.png`) et le
favicon Expo-web sont à jour aussi. Sources vectorielles sous `docs/brand/logo/` (§13 du cahier des
charges) ; le mot-symbole y reste en `<text>`, pas encore vectorisé — exigence de l'étape 4, une
fois la piste définitivement figée par les mises en situation réelles de l'étape 3.

## Compte de démonstration — fait

Créé en production le 21/09/2026 via `scripts/seed-app-store-demo.py` (rejoue de vrais appels API,
pas d'écriture SQL directe) : ferme #21 « Ferme Démo Jawdi », une bande close avec marge positive
(777 000 XOF sur 3 % de mortalité), une bande en cours, un client avec facture payée, une visite
vétérinaire, un compte-courant fournisseur avec un versement. Identifiants ci-dessus.

Le script est ré-exécutable pour un autre compte de démo (`--email`/`--password` différents) mais
**pas contre le même e-mail** : l'inscription n'est pas idempotente.

## Gérer les builds dans App Store Connect

Fiche pratique pour la partie qui se passe dans l'UI Apple, une fois qu'`eas submit` a livré un
build — la partie EAS (build + submit) est documentée dans `docs/mobile/app-store.md`.

### 1. Où voir un build

App Store Connect → l'app « Jawdi : gestion d'élevage » → onglet **TestFlight**. Chaque build
soumis par `eas submit` y apparaît, identifié par son numéro (`CFBundleVersion`, ex. build 3) sous
la version marketing (`1.0.0`).

### 2. Statuts d'un build fraîchement soumis

| Statut affiché | Ce que ça veut dire | Combien de temps |
|---|---|---|
| **Processing** | Apple scanne le binaire (permissions, symboles, malware). Rien à faire. | 5–15 min en général |
| **Ready to Submit** / **Ready to Test** | Le scan est passé. Le build peut être ajouté à une version ou à un groupe de test interne. | — |
| **Missing Compliance** | Apple demande de répondre à la question chiffrement export. Cliquer sur le build → répondre. `usesNonExemptEncryption: false` dans `app.json` répond généralement automatiquement « Non » à cette question. | bloquant tant que non répondu |
| **Invalid Binary** (email reçu) | Rejet automatique avant même la revue humaine — un point technique précis (permission manquante, entitlement, symbole interdit). Le mail liste le(s) code(s) ITMS-xxxxx. | corriger et repartir à l'étape build |

C'est ce dernier cas qui s'est produit sur le build 2 : **ITMS-90683** (`NSPhotoLibraryUsageDescription`
manquante) — corrigé dans `mobile/app.json`, rebuild (build 3), resoumis.

### 3. Lire un rejet ITMS-xxxxx

Le mail Apple nomme toujours : le code ITMS, l'app, la version, **le numéro de build concerné**, et
la clé Info.plist ou l'entitlement en cause. Réflexe :
1. Chercher la clé (`NSXxxUsageDescription`, `NSAppTransportSecurity`, etc.) dans `mobile/app.json`
   sous `expo.ios.infoPlist`, ou dans les options du plugin Expo concerné (`app.json` → `plugins`).
2. L'ajouter/corriger avec un texte utilisateur clair en français.
3. `eas build -p ios --profile production --non-interactive` (le numéro de build s'auto-incrémente,
   `autoIncrement: true` dans `eas.json`).
4. `eas submit -p ios --profile production --non-interactive --latest`.
5. Le nouveau build remplace l'ancien dans TestFlight ; l'ancien reste visible mais inutilisable.

### 4. TestFlight interne (avant la revue publique)

Pas besoin d'attendre l'App Review pour tester sur un vrai iPhone :
1. TestFlight → **App Store Connect Users** (testeurs internes = comptes ayant un rôle sur l'app,
   pas de revue Apple nécessaire) ou créer un groupe **External Testing** (jusqu'à 10 000 testeurs,
   nécessite une première revue « beta »).
2. Ajouter le build « Ready to Test » au groupe.
3. Le testeur installe l'app TestFlight, reçoit une invitation, installe Jawdi depuis là.

### 5. Soumettre un build pour la revue App Store (publication réelle)

1. App Store Connect → l'app → onglet **App Store** (pas TestFlight) → la version en préparation
   (`1.0.0`).
2. Section **Build** → **+** → choisir le build « Ready to Submit ».
3. Vérifier que toute la fiche est remplie : nom, sous-titre, mots-clés, description, captures
   d'écran (`docs/mobile/app-store-screenshots/`), catégorie, classification d'âge, étiquettes de
   confidentialité, notes de version, notes de relecture, compte de démo — voir les sections
   ci-dessus, toutes marquées « fait ».
4. **Save** puis **Add for Review** (bouton en haut à droite).
5. Répondre aux questions de conformité si Apple les repose (chiffrement, publicité).
6. **Submit**.

### 6. Suivre la revue

| Statut | Signification |
|---|---|
| Waiting for Review | En file d'attente, pas encore regardé par un humain |
| In Review | Un relecteur Apple teste l'app maintenant |
| Pending Developer Release / Ready for Sale | Approuvé — publié automatiquement ou après clic selon la configuration de sortie |
| Rejected | Refus avec motif détaillé dans **Resolution Center** (distinct des rejets ITMS automatiques ci-dessus, qui arrivent avant même d'atteindre la revue) |

Un rejet en revue humaine se répond directement dans le **Resolution Center** de la fiche (fil de
discussion avec le relecteur), pas par un nouveau build systématiquement — lire le motif avant
de rebuilder.
