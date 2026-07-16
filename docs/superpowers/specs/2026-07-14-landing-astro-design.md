# Site vitrine AviCare (Astro) — Design & copywriting

**Date :** 2026-07-14
**Contexte :** AviCare Platform (SaaS de gestion d'élevage avicole, Afrique de l'Ouest) n'a pas de
site vitrine. Objectif : un site **premium, orienté conversion et SEO**, bâti en **Astro** (SSG),
séparé de l'app Next.js. Cible double (éleveurs + partenaires B2B2C), pilote **gratuit** (ADR-009).

## Décisions verrouillées (brainstorming)

- **Stack : Astro en SSG**, dans `landing/` (monorepo). Zéro JS sauf de petits îlots (compteurs KPI,
  routeur non requis en Astro, accordéon FAQ en `<details>` natif). Langue **français**.
- **Styling : CSS natif à tokens** (custom properties), repris **tel quel du prototype validé** —
  **pas de Tailwind** (déviation assumée vs. la note initiale) : le prototype est écrit en CSS
  artisanal approuvé ; le porter en Tailwind ajouterait du travail et un risque de dérive visuelle.
  Astro gère nativement les styles scopés par composant + une feuille globale de tokens.
- **Double cible équilibrée** : hero unifié, puis un bloc « double parcours » (Éleveur / Coopérative-
  Provendier) avec promesse + CTA propres à chacun. Évite la dilution en isolant chaque parcours.
- **CTA principal = « Commencer gratuitement » → inscription de l'app** (URL placeholder
  `PUBLIC_APP_SIGNUP_URL`). CTA partenaire secondaire = « Devenir partenaire » → `mailto:` placeholder
  (`PUBLIC_PARTNER_EMAIL`), remplaçable par WhatsApp plus tard.
- **Tarifs** : bandeau « Gratuit pendant la phase pilote » + plans **indicatifs à venir** basés sur les
  bundles doc 00 §7 : Starter Volaille 15 000 F/mois, Pro Volaille 25 000 F/mois, Ferme Complète
  45 000 F/mois, Sur mesure (coops). Marqués « indicatif, à venir ».
- **Direction visuelle : VALIDÉE via prototype** (2026-07-16) →
  **`docs/superpowers/specs/assets/landing-prototype.html`** = **source de vérité visuelle**.
  Le build Astro doit reproduire ce prototype (structure, tokens, composants, micro-interactions).
  - **Structure** reprise des maquettes Figma fournies par le client (`~/Desktop/*.png`) :
    `Home` → Accueil, **`Integration` → Fonctionnalités**, `Pricing` → Tarifs, `About us` → À propos
    (`Integration Details` → gabarit des sous-pages fonctionnalités, à décliner).
  - **Recolorée aux tokens de marque AviCare** (doc 10) : vert/orange, jamais le violet/lime du template.
  - Devices signature : **menu = île arrondie flottante** (verre dépoli) ; **sections pleine largeur**
    à fonds alternés (blanc / stone / bandes vert foncé / bande photo) — **surtout pas** de sections
    en panneaux flottants (explicitement rejeté par le client) ; **surlignage marqueur orange** tracé
    à la main sur un mot clé des titres ; hero **vert immersif** + cockpit KPI animés + **chips
    flottantes** ; **bande stats** vert foncé ; témoignages à **gros chiffre** ; FAQ accordéon ;
    CTA final vert foncé ; **vrai logo AviCare** (foncé au header, clair au footer).
- **Images** : fournies par le client, présentes dans `web/public/images/` → à copier dans
  `landing/src/assets/` (`eleveur-poulets` = hero À propos, `equipements-ferme` = bande, `eleveur` =
  bloc vision). Logo depuis `web/public/logo/{logo,logo-dark}.png`. Captures produit générées depuis
  l'app réelle si besoin.

## Stack technique & architecture

- **Astro 5** (`output: "static"`), intégrations : `@astrojs/sitemap`,
  `@astrojs/partytown` (analytics différé, optionnel). Images via `astro:assets` (AVIF/WebP,
  responsive, lazy).
- **Emplacement** : `landing/` à la racine du monorepo (indépendant de `web/`). Build statique
  déployable sur le même VPS (Caddy sert `landing/dist` sur le domaine racine, app sur `app.`).
- **Fonts** (doc 10) : **Outfit** (400/500/600/700) + **JetBrains Mono** (500), auto-hébergées en
  **woff2**, `font-display: swap`, préchargées (subset latin). Pas de Google Fonts runtime (perf + RGPD).
- **Composants réutilisables** (`.astro`) : `Header`, `Footer`, `Hero`, `SectionHeading`, `FeatureCard`,
  `StepCard`, `PricingCard`, `FaqAccordion` (îlot minimal), `Cta`, `TestimonialCard`, `Kpi` (îlot
  count-up), `SeoHead`.
- **Config env** : `PUBLIC_APP_SIGNUP_URL`, `PUBLIC_PARTNER_EMAIL`, `PUBLIC_SITE_URL`,
  `PUBLIC_CONTACT_PHONE` (placeholders dans `.env.example`).

## Design system

> **Réf. de marque : `docs/10-design-system.md`** (source de vérité tokens + voix).
> Le site vitrine réutilise **exactement** les tokens doc 10, déclarés en **custom properties CSS**
> (`:root`) reprises du prototype validé, pour rester cohérent avec l'app.

**Prototypage — historique.** Une maquette a été générée dans Stitch (projet « Avicare Design System »,
`projects/2827477240241166880`) : **écartée par le client** (rendu « SaaS corporate » générique). La
direction retenue est le **prototype validé** (`assets/landing-prototype.html`), construit sur mesure
d'après les maquettes Figma du client et recoloré aux tokens doc 10. Stitch reste utilisable comme
repère visuel, mais **ne dicte pas** le design du site.

- **Palette (doc 10, verbatim)** : primary vert (`#3D8B3D` main ; foncés `#2E6B2E`/`#245524`/`#1B3F1B`/
  `#122B12` ; clairs `#F0F7F0`/`#DCEEDC`), **accent orange Sénégal** (`#F8961E` main ; `#E67E0A` pour
  texte-sur-blanc lisible), **neutres « stone » chauds** (fond `#FAFAF9` neutral-50, texte principal
  `#292524` neutral-800, secondaire `#78716C`, bordures `#E7E5E4`). CTA primaire = **orange** (règle
  doc 10 : l'orange = ACTION). **1 seul CTA primaire par écran.**
- **Rayons / ombres (doc 10)** : boutons 8px, cards **12px**, hero/sections 24px ; ombres subtiles
  (`shadow-sm/md/lg` doc 10), jamais agressives ; focus ring `0 0 0 3px primary-100`.
- **Icônes** : **Lucide** (doc 10), stroke 1.75, `currentColor`.
- **Typographie — alignée doc 10 (marque)** : **Outfit** (display + UI, auto-hébergée woff2) en
  poids 400/500/600/**700** pour les titres ; **JetBrains Mono** pour les **chiffres KPI**
  (`tabular-nums`). Pas de Fraunces/Inter (déviation marque écartée). Échelle fluide `clamp()` calquée
  sur l'échelle doc 10 : hero `clamp(2.25rem, 6vw, 3.25rem)`/700, h2 `clamp(1.6rem, 4vw, 2.4rem)`/600,
  corps `body-lg` 1rem/1.5 (line-height 1.5 = lisibilité Sénégal, règle doc 10).
- **Signature** : composant `Kpi` — grand nombre (chiffres tabulaires) qui **compte de 0 à la valeur**
  au scroll-into-view (`IntersectionObserver`, respecte `prefers-reduced-motion`). Utilisé dans le hero
  (cockpit) et la barre de preuves.
- **Motion** : une séquence au chargement du hero (fade+rise décalé, compteurs) ; reveals au scroll
  discrets. Rien d'autre. `prefers-reduced-motion` désactive tout.
- **Mobile-first** : type fluide, cibles ≥ 44px, **barre CTA collante en bas** (mobile) avec
  « Commencer gratuitement », grilles 1-col → multi-col, aucune largeur fixe, pas de scroll horizontal.
- **Accessibilité** : contrastes AA, focus visibles, landmarks sémantiques, `alt` sur images, nav
  clavier sur l'accordéon FAQ. **Règle contraste CTA (doc 10 §9)** : orange `#F8961E` sur blanc =
  2,9:1 (échoue AA) → boutons CTA = **texte blanc sur fond orange** ; orange en *texte* sur blanc =
  `#E67E0A` (accent-500).

## Sitemap (13 pages)

```
/                         Accueil (conversion)
/fonctionnalites          Hub fonctionnalités
/fonctionnalites/elevage
/fonctionnalites/sanitaire
/fonctionnalites/stocks
/fonctionnalites/ventes
/fonctionnalites/finance
/tarifs                   Tarifs (gratuit pilote + indicatif)
/partenaires              B2B2C
/a-propos
/contact
/faq
/ressources               Hub + 1 article graine
/ressources/reduire-la-mortalite-poulet-de-chair
/mentions-legales
/confidentialite
```

---

## COPYWRITING PAR PAGE

> Ton : direct, concret, orienté bénéfice ; tutoiement évité (vouvoiement pro léger) ; chiffres et
> verbes d'action. Chaque section porte un objectif.

### 1. Accueil (`/`)

**SEO** — title : « AviCare — Le logiciel de gestion d'élevage avicole en Afrique de l'Ouest » ;
meta : « Suivez vos bandes, vos coûts et vos ventes sur une seule plateforme. Réduisez la mortalité,
maîtrisez le coût de l'aliment, connaissez votre marge. Gratuit pendant le pilote. »

**Hero**
- H1 : **« Votre élevage, enfin sous contrôle. »**
- Sous-titre : « De la bande à la marge : suivez vos poulets, vos coûts et vos ventes sur une seule
  plateforme pensée pour l'Afrique de l'Ouest — et sachez enfin si vous gagnez de l'argent. »
- CTA primaire : **« Commencer gratuitement »** · secondaire : « Voir comment ça marche » (ancre) ·
  micro-lien : « Vous êtes coopérative / provendier ? » → `/partenaires`.
- Micro-preuve sous CTA : « Gratuit pendant la phase pilote · Sans carte bancaire · En français ».
- Visuel : cockpit produit (capture dashboard) + 3 `Kpi` animés en surimpression (Effectif suivi,
  Taux de mortalité, Marge/bande).

**Barre de confiance** (bandeau) : « Pensé au Sénégal, pour l'Afrique de l'Ouest » + 3–4 puces :
« Mobile-first · Marche sur petit forfait data · Poulets de chair **et** pondeuses · Vos données vous
appartiennent ».

**Problème** (accroche → agitation)
- Titre : « Gérer un élevage de tête, ça coûte cher — sans qu'on le voie. »
- Corps : « Les mortalités qu'on ne compte pas. L'aliment dont on ignore le vrai coût. Les ventes
  notées sur un cahier, les dettes clients qu'on oublie. À la fin de la bande, une seule question
  reste sans réponse : **est-ce que j'ai gagné de l'argent ?** »
- 3 puces douleur : « Mortalité subie, jamais analysée » · « Coût de revient au kg inconnu » · « Marge
  invisible, décisions à l'aveugle ».

**Solution** (révélation)
- Titre : « Une seule plateforme, du poussin à la marge. »
- Sous-titre : « AviCare relie l'élevage, le sanitaire, les stocks, les ventes et les finances — pour
  que chaque saisie du quotidien devienne une décision éclairée. »
- 5 `FeatureCard` (icône + titre + 1 phrase + lien vers la sous-page) :
  1. **Élevage** — « Suivez chaque bande au jour le jour : effectif, mortalité, aliment, pesées. »
  2. **Sanitaire** — « Vaccins, traitements, calendrier vaccinal et délais d'attente maîtrisés. »
  3. **Stocks** — « Aliment, formules, bons d'achat et alertes de rupture, sans surprise. »
  4. **Ventes** — « Clients, commandes, factures et encours — votre commerce enfin en ordre. »
  5. **Finance** — « Dépenses, marge par bande et compte de résultat, en temps réel. »

**Comment ça marche** (3 étapes `StepCard`)
1. « Créez votre ferme » — « En 2 minutes, sans carte bancaire. »
2. « Saisissez au quotidien » — « Mortalité, aliment, ventes : quelques secondes par jour. »
3. « Pilotez vos marges » — « AviCare calcule le reste : coût au kg, marge, alertes. »

**Double parcours** (2 cartes côte à côte)
- « **Vous êtes éleveur** » — « Reprenez le contrôle de vos bandes et de vos marges. Gratuit pendant
  le pilote. » → CTA « Commencer gratuitement ».
- « **Vous êtes coopérative / provendier** » — « Équipez tout votre réseau d'éleveurs et fidélisez-les
  avec un outil qui leur fait gagner de l'argent. » → CTA « Devenir partenaire ».

**Résultats / preuves**
- Bande de bénéfices chiffrés (formulés en promesse, marqués « objectifs pilote ») : « Moins de
  mortalité non expliquée » · « Coût de l'aliment enfin connu » · « Marge par bande en un coup d'œil ».
- 3 `TestimonialCard` **suggérés** (placeholders à remplacer par de vrais témoignages — clairement
  balisés `[Témoignage à confirmer]`) :
  - « Avant, je découvrais mes pertes à la vente. Maintenant je les vois venir. » — *Éleveur de chair,
    Thiès [à confirmer]*
  - « Je sais enfin combien me coûte un kilo de poulet. » — *Éleveuse, Niayes [à confirmer]*
  - « On a mis 30 fermes de notre coopérative sur AviCare. » — *Responsable coopérative [à confirmer]*

**FAQ (extrait)** — 4–5 questions (les mêmes que `/faq`, top items), lien « Toutes les questions ».

**CTA final** — Titre : « Arrêtez de piloter à l'aveugle. » Sous-titre : « Rejoignez le pilote gratuit
et voyez, dès la première bande, où part votre argent. » CTA « Commencer gratuitement ».

### 2. Hub Fonctionnalités (`/fonctionnalites`)

Title : « Fonctionnalités — Tout l'élevage avicole, d'un seul endroit | AviCare ». Intro courte +
grille des 5 modules (mêmes `FeatureCard` que l'accueil, vers les sous-pages) + CTA.

### 3–7. Sous-pages fonctionnalités (`/fonctionnalites/{module}`)

**Gabarit commun** par sous-page :
- H1 orienté solution (« Le client a trouvé la bonne solution »).
- Sous-titre valeur.
- 2–3 blocs « capacité → bénéfice » alternés (texte + capture produit réelle).
- Encadré « Ce que ça vous évite » (3 puces).
- CTA « Commencer gratuitement ».
- SEO : title/meta ciblant la requête du module.

Copies spécifiques :
- **Élevage** — H1 « Chaque bande sous contrôle, du jour 1 à la vente. » Capacités : saisie
  journalière (mortalité/aliment/eau), pesées & courbe de croissance, lots chair **et** pondeuses,
  effectif auto-réconcilié. SEO title : « Logiciel de suivi de bande — poulets de chair & pondeuses ».
- **Sanitaire** — H1 « Un élevage sain, un calendrier vaccinal tenu. » Capacités : bibliothèque
  vaccins/traitements (dont vos propres articles), calendrier vaccinal par souche, **délais d'attente**
  viande/œufs, visites vétérinaires. SEO : « Calendrier vaccinal volaille & suivi sanitaire ».
- **Stocks** — H1 « Ne tombez plus jamais en rupture d'aliment. » Capacités : inventaire multi-articles,
  **formules d'aliment** (décomposées à la saisie), bons d'achat & réception, alertes seuil. SEO :
  « Gestion de stock d'aliment & formules pour élevage ».
- **Ventes** — H1 « Votre commerce enfin en ordre. » Capacités : fichier clients & compte-courant,
  commandes → livraisons, factures & paiements, encours et alertes crédit. SEO : « Facturation &
  gestion clients pour éleveurs ».
- **Finance** — H1 « Sachez, à tout moment, si vous gagnez de l'argent. » Capacités : dépenses (achats,
  salaires, vétérinaire), **marge par bande**, compte de résultat de la ferme, coût de revient au kg.
  SEO : « Calcul de marge & rentabilité en élevage avicole ».

### 8. Tarifs (`/tarifs`)

- Bandeau haut : « 🎉 **Gratuit pendant la phase pilote.** Toutes les fonctionnalités, sans carte
  bancaire. Les tarifs ci-dessous sont **indicatifs** et entreront en vigueur plus tard. »
- 3 `PricingCard` + 1 « Sur mesure » (indicatif, `À venir`) :
  - **Découverte** — **Gratuit** (pilote) — « Toutes les fonctionnalités V1, 1 ferme. » CTA
    « Commencer gratuitement ».
  - **Pro Volaille** — *~25 000 F/mois (indicatif)* — « Chair + ponte, sanitaire avancé, stocks,
    ventes, 3 fermes. » CTA « Commencer gratuitement ».
  - **Ferme Complète** — *~45 000 F/mois (indicatif)* — « Tous les modules, 10 fermes, finance
    complète. » CTA « Commencer gratuitement ».
  - **Sur mesure** — *Coopératives & gros réseaux* — « Tarif réseau, accompagnement. » CTA
    « Nous contacter ».
- FAQ tarifs courte (« Pourquoi c'est gratuit maintenant ? », « Que se passe-t-il après le pilote ? »).

### 9. Partenaires (`/partenaires`)

- H1 : « Équipez votre réseau d'éleveurs. Fidélisez-les. »
- Sous-titre : « Coopératives, provendiers, couvoirs : offrez à vos éleveurs un outil qui leur fait
  gagner de l'argent — et gardez-les dans votre réseau. »
- 3 bénéfices partenaire : « Éleveurs plus performants = plus fidèles » · « Vos ventes d'intrants
  suivent » · « Une vue agrégée de la santé de votre réseau (à venir) ».
- Comment ça marche (3 étapes B2B2C) + CTA « Devenir partenaire » (mailto).

### 10. À propos (`/a-propos`)

- H1 : « Un logiciel d'élevage pensé au Sénégal, pas importé. »
- Récit : le problème local (gestion de tête, marges invisibles), la conviction (la donnée au service
  du petit éleveur), la mission (« rendre chaque élevage rentable, du Sénégal au monde »). Ton humain,
  sobre. Encadré valeurs : Local · Concret · Vos données vous appartiennent. CTA doux.

### 11. Contact (`/contact`)

- H1 : « Parlons de votre élevage. »
- Canaux : email (`PUBLIC_PARTNER_EMAIL`), téléphone (`PUBLIC_CONTACT_PHONE`), (WhatsApp plus tard).
- Formulaire structuré (nom, téléphone, « je suis : éleveur / coopérative / autre », message) —
  **inerte pour l'instant** (soumission → `mailto:` ou note « endpoint à brancher »). Pas de backend V1.

### 12. FAQ (`/faq`)

Accordéon (îlot minimal, accessible). Questions (réponses complètes dans le build) :
- C'est vraiment gratuit ? / Ai-je besoin d'Internet en permanence ? / Ça marche pour les pondeuses ? /
  Mes données sont-elles à moi ? / Faut-il un ordinateur ou ça marche sur téléphone ? / Comment
  calcule-t-il ma marge ? / Que se passe-t-il après le pilote ? / Puis-je gérer plusieurs fermes ? /
  Comment démarrer ?
- SEO : `FAQPage` JSON-LD.

### 13. Ressources (`/ressources` + 1 article graine)

- Hub : grille d'articles (1 au lancement, structure prête).
- Article graine `/ressources/reduire-la-mortalite-poulet-de-chair` : ~800–1000 mots, H2/H3, conseils
  concrets (démarrage, température, densité, eau, vaccination, suivi quotidien), CTA vers l'app. SEO
  `Article` JSON-LD. **Le vrai moteur SEO** — structure prête pour publier plus.

### 14–15. Légal

- `/mentions-legales` + `/confidentialite` : gabarits standard FR (éditeur, hébergeur, données
  personnelles, cookies si analytics). Contenu placeholder à finaliser juridiquement.

---

## SEO (spécification)

- Par page : `<title>` unique, `meta description`, **canonical**, `lang="fr"`, OpenGraph + Twitter
  Card (image OG par page — placeholder générique en attendant les visuels).
- **JSON-LD** : `Organization` (global, dans le footer/Head), `SoftwareApplication` (accueil),
  `FAQPage` (accueil + /faq), `Article` (article ressources), `BreadcrumbList` (sous-pages).
- **Sitemap.xml** (`@astrojs/sitemap`) + **robots.txt** (autorise tout, pointe le sitemap).
- URLs propres, en français, sans paramètres. Titres et H1 alignés sur les requêtes cibles.
- Images `alt` descriptifs ; noms de fichiers explicites.

## Performance & mobile (spécification)

- Objectif **Lighthouse ≥ 95** (mobile) sur l'accueil : SSG, CSS critique inline, JS ≈ 0 (îlots KPI/FAQ
  seulement), images AVIF/WebP responsive + lazy, fonts woff2 préchargées `swap`.
- Mobile : type fluide `clamp()`, cibles tactiles ≥ 44px, **barre CTA collante** en bas, grilles
  1-col, pas de scroll horizontal, `content-visibility` sur sections basses.
- `prefers-reduced-motion` respecté (désactive compteurs/reveals).

## Images à fournir (par le client, après création du projet)

1. 1–2 photos authentiques : éleveur sénégalais + volailles / poulailler réel (chair & ponte).
2. (optionnel) photo fondateur/équipe (confiance, page À propos).
3. (optionnel) logos partenaires.
> Captures produit (dashboard, lot, ventes, finance) : **générées depuis l'app réelle** par nous.
> En attendant : placeholders (blocs colorés dimensionnés + `alt`) pour ne pas bloquer le build.

## Hors périmètre (V1 du site)

- Backend de formulaire (contact/lead) : formulaire inerte + `mailto` ; endpoint plus tard.
- Blog complet (1 article graine seulement).
- i18n multilingue (français uniquement en V1).
- WhatsApp Business / chat live (placeholder, plus tard).
- Intégration analytics réelle (structure Partytown prête, clé plus tard).

## Contraintes globales

- Aucune signature Claude/AI dans les commits ; Conventional Commits (`feat(landing): …`, `docs: …`).
- Branch protection → PR + `gh pr merge --rebase --delete-branch`.
- Astro **SSG** (`output: static`), aucun secret côté client ; toute valeur dynamique = variable
  `PUBLIC_*` avec placeholder dans `.env.example`.
- Le site est **indépendant de `web/`** (pas d'import cross-projet) ; réutilise la **palette** et le
  **logo** (`web/public/logo/logo.png`) copiés dans `landing/`.
- Copie tous les placeholders `[à confirmer]` / `PUBLIC_*` documentés pour remplissage ultérieur.
- Perf/mobile/SEO ci-dessus sont des **critères d'acceptation**, pas des options.
