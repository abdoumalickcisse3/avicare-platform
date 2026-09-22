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

## Ce qui reste bloqué avant de pouvoir soumettre la fiche

1. **Captures d'écran iPhone 6,9″ (1320×2868)** — irréalisables sans build TestFlight sur un
   appareil réel (Phase 6). Pas d'iPad (`supportsTablet: false`). Seul point encore ouvert.

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
