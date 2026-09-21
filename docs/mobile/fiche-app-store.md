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
| Confidentialité | `https://jawdi.app/confidentialite/` (en ligne) |
| Assistance | `https://jawdi.app/contact` ou WhatsApp `+221 70 475 69 96` — à trancher : Apple exige une URL, pas un numéro seul |
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

## Ce qui reste bloqué avant de pouvoir soumettre la fiche

1. **Captures d'écran iPhone 6,9″ (1320×2868)** — irréalisables sans build TestFlight sur un
   appareil réel (Phase 6). Pas d'iPad (`supportsTablet: false`).
2. **Compte de démonstration** avec données réalistes (bandes, ventes, dépenses) pour le
   relecteur — Jawdi exige une connexion, une ferme vide se rapproche d'un rejet.
3. **Icône définitive** — la fiche peut se préparer sans, mais rien ne se soumet avec le gabarit
   Expo par défaut actuellement dans `mobile/assets/icon.png`.
4. **Décision sur l'URL d'assistance** : une page dédiée sur `jawdi.app` plutôt qu'un simple lien
   `wa.me`, pour rester conforme au champ attendu par Apple.
