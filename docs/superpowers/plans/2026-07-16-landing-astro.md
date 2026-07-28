# Site vitrine Jawdi (Astro) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer le site vitrine Jawdi en Astro (SSG, français, SEO/perf), fidèle au prototype visuel validé, dans `landing/`.

**Architecture:** Astro 7 en `output: "static"`, **CSS natif à tokens** (pas de Tailwind), zéro JS hors deux micro-îlots (compteurs KPI, reveals). Le **prototype validé** `docs/superpowers/specs/assets/landing-prototype.html` est la **source de vérité visuelle** : on en extrait les tokens + le CSS des composants, et on découpe en composants `.astro` réutilisés par toutes les pages. Le copy est déjà rédigé dans le spec.

**Tech Stack:** Astro 7, `@astrojs/sitemap`, `astro:assets`, fonts auto-hébergées (Outfit, JetBrains Mono), CSS custom properties.

## Global Constraints

- **Le prototype fait foi** (`docs/superpowers/specs/assets/landing-prototype.html`) : structure, tokens, espacements, micro-interactions. Ne pas redessiner. Les imperfections se corrigent en intégrant, sans dériver de la direction.
- **Interdits explicites (rejetés par le client)** : sections en panneaux flottants arrondis (les sections sont **pleine largeur**, séparées par le **changement de fond**) ; palette violet/lime du template Figma. **Le menu est la seule île arrondie flottante.**
- **Tokens = doc 10** (`docs/10-design-system.md`) : vert `#3D8B3D`, orange Sénégal `#F8961E` (**CTA uniquement**, texte blanc dessus), neutres stone, Outfit + JetBrains Mono (chiffres, `tabular-nums`). **1 seul CTA primaire par section.**
- **Pas de Tailwind.** CSS global de tokens + styles scopés par composant Astro.
- **SEO obligatoire** (critère d'acceptation) : `<title>`/meta uniques, canonical, `lang="fr"`, OG/Twitter, JSON-LD (`Organization`, `SoftwareApplication` accueil, `FAQPage`, `Article`, `BreadcrumbList`), sitemap + robots.
- **Perf/mobile obligatoires** : Lighthouse **≥ 95 mobile** sur l'accueil, images `astro:assets` (AVIF/WebP responsive, lazy), fonts woff2 préchargées `swap`, cibles ≥ 44px, barre CTA collante mobile, zéro scroll horizontal, `prefers-reduced-motion` respecté.
- **Liens/env** : `PUBLIC_APP_SIGNUP_URL`, `PUBLIC_PARTNER_EMAIL`, `PUBLIC_SITE_URL`, `PUBLIC_CONTACT_PHONE` → `.env.example` avec placeholders. Aucun secret.
- Commits : Conventional Commits, scope `landing` (`feat(landing): …`). AUCUNE signature Claude/AI, pas de « Co-Authored-By », pas d'emoji robot, aucune mention AI/Claude/Anthropic.
- Le site est **indépendant de `web/`** (aucun import cross-projet). Images copiées depuis `web/public/images` + `web/public/logo` vers `landing/src/assets/`.
- Vérif à chaque tâche : `cd landing && npm run build` doit passer (exit 0).

## File Structure

```
landing/
  package.json  astro.config.mjs  .env.example  public/robots.txt
  src/
    styles/tokens.css        ← :root custom properties + base (extrait du prototype)
    styles/global.css        ← reset, typo, boutons, .hl (marqueur), utilitaires
    assets/                  ← logo.png, logo-dark.png, eleveur-poulets.jpg, equipements-ferme.jpg, eleveur.jpg
    fonts/                   ← outfit-*.woff2, jetbrains-mono-*.woff2
    components/
      SeoHead.astro  Header.astro  Footer.astro  MobileCta.astro
      Hero.astro  Cockpit.astro  Kpi.astro  TrustStrip.astro
      SectionHead.astro  Highlight.astro  StatsBand.astro  PhotoBand.astro
      FeatureCard.astro  ModuleCard.astro  StepCard.astro  DualPath.astro
      TestimonialCard.astro  PricingCard.astro  CompareTable.astro  Faq.astro  FinalCta.astro
    layouts/Base.astro
    pages/
      index.astro  fonctionnalites/index.astro  fonctionnalites/[module].astro
      tarifs.astro  partenaires.astro  a-propos.astro  contact.astro  faq.astro
      ressources/index.astro  ressources/reduire-la-mortalite-poulet-de-chair.astro
      mentions-legales.astro  confidentialite.astro
    data/modules.ts          ← les 5 modules (slug, nom, icône, copy) pour hub + sous-pages
    data/faq.ts  data/plans.ts  data/testimonials.ts
```

---

## Task 1: Scaffolder Astro + design system + Header/Footer

**Files:**
- Create: `landing/package.json`, `landing/astro.config.mjs`, `landing/.env.example`, `landing/public/robots.txt`
- Create: `landing/src/styles/tokens.css`, `landing/src/styles/global.css`
- Create: `landing/src/layouts/Base.astro`, `landing/src/components/{SeoHead,Header,Footer,MobileCta,Highlight}.astro`
- Copy: images → `landing/src/assets/`, fonts → `landing/src/fonts/`

**Interfaces:**
- Produces: `Base.astro` props `{title, description, canonical?, jsonLd?}` ; `Highlight.astro` (slot = mot surligné au marqueur orange) ; tokens CSS globaux.

- [ ] **Step 1: Scaffolder le projet**

```bash
cd /Users/mac/Developer/avicare-platform
npm create astro@latest landing -- --template minimal --no-install --no-git --typescript strict --skip-houston
cd landing && npm install && npx astro add sitemap --yes
```
Expected: `landing/` créé, `astro.config.mjs` avec l'intégration sitemap.

- [ ] **Step 2: Config Astro (SSG + site)**

`landing/astro.config.mjs` :
```js
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: process.env.PUBLIC_SITE_URL || "https://avicare.app",
  output: "static",
  integrations: [sitemap()],
});
```
`landing/.env.example` :
```
PUBLIC_SITE_URL=https://avicare.app
PUBLIC_APP_SIGNUP_URL=https://app.avicare.app/signup
PUBLIC_PARTNER_EMAIL=partenaires@avicare.app
PUBLIC_CONTACT_PHONE=+221 XX XXX XX XX
```
`landing/public/robots.txt` :
```
User-agent: *
Allow: /
Sitemap: https://avicare.app/sitemap-index.xml
```

- [ ] **Step 3: Copier les assets**

```bash
cd /Users/mac/Developer/avicare-platform
mkdir -p landing/src/assets landing/src/fonts
cp web/public/logo/logo.png landing/src/assets/logo.png
cp web/public/logo/logo-dark.png landing/src/assets/logo-dark.png
cp "web/public/images/homme-éleveur-avec-seau-nourrissant-les-poulets-à-poulailler-un-fermier-afro-américain-nourrit-au-211627159.webp" landing/src/assets/eleveur-poulets.webp
cp "web/public/images/Equipements-de-base-pour-une-ferme-avicole-qumzpvco3lsfc0dnj0xya8ntzguncqxpekmc0p8isw.jpg" landing/src/assets/equipements-ferme.jpg
cp web/public/images/image-eleveur.jpg landing/src/assets/eleveur.jpg
```
Télécharger **Outfit** (400/500/600/700) et **JetBrains Mono** (500) en **woff2 latin** dans `landing/src/fonts/` (Google Fonts *download*, pas de lien runtime). Déclarer les `@font-face` dans `tokens.css` avec `font-display:swap`, et précharger Outfit 600/700 dans `Base.astro`.

- [ ] **Step 4: Extraire les tokens + le CSS de base du prototype**

Ouvrir `docs/superpowers/specs/assets/landing-prototype.html` et **reprendre verbatim** :
- `:root{…}` (couleurs `--earth/--earth-800/--leaf/--sun/--stone/--paper/--ink/--line`, `--disp`, `--mono`, `--wrap`) → `landing/src/styles/tokens.css` (en remplaçant `--disp`/`--mono` par les familles auto-hébergées).
- reset + `body`/`h1..h3`/`p`/`a`/`.wrap`/`.eyebrow`/`.btn*`/`.hl` (surlignage marqueur) + `.reveal` + les media-queries mobiles + `prefers-reduced-motion` → `landing/src/styles/global.css`.
> Ne pas réinventer les valeurs : copier celles du prototype.

- [ ] **Step 5: `Highlight.astro` (surlignage marqueur — device signature)**

```astro
---
// Trait de marqueur orange tracé à la main sous un mot clé de titre.
---
<span class="hl"><slot /><svg viewBox="0 0 300 24" preserveAspectRatio="none" aria-hidden="true"><path d="M6 15C64 7 132 5 190 8c34 2 68 5 104 9"/></svg></span>
```
(CSS `.hl` déjà dans `global.css`.)

- [ ] **Step 6: `SeoHead.astro` + `Base.astro`**

`SeoHead.astro` props `{title, description, canonical, jsonLd?}` : `<title>`, meta description, `<link rel="canonical">`, OG (`og:title/description/type/url/image`), `twitter:card=summary_large_image`, et `<script type="application/ld+json">` si `jsonLd`.
`Base.astro` : `<html lang="fr">`, `<head>` = `SeoHead` + preload fonts + import des styles ; `<body>` = `<Header/>` + `<slot/>` + `<Footer/>` + `<MobileCta/>`.

- [ ] **Step 7: `Header.astro` (île flottante) + `Footer.astro` + `MobileCta.astro`**

Reprendre du prototype : `header{position:sticky;…;background:transparent}` + `.nav{…border-radius:999px;backdrop-filter…;box-shadow…}` (**l'île**), logo via `astro:assets` (`<Image src={logo} …>`), liens `/fonctionnalites`, `/tarifs`, `/a-propos`, `/faq`, « Se connecter » + CTA orange `PUBLIC_APP_SIGNUP_URL`. Footer : logo clair, 4 colonnes (Produit / Entreprise / Légal), bas de page. `MobileCta` : barre collante mobile.

- [ ] **Step 8: Vérifier le build**

Run: `cd landing && npm run build`
Expected: BUILD SUCCESS (aucune page encore, ou une page vide).

- [ ] **Step 9: Commit**

```bash
git add landing
git commit -m "feat(landing): scaffold Astro site with Jawdi design tokens, header island and footer"
```

---

## Task 2: Page d'accueil

**Files:**
- Create: `landing/src/pages/index.astro`
- Create: `landing/src/components/{Hero,Cockpit,Kpi,TrustStrip,SectionHead,StatsBand,PhotoBand,FeatureCard,StepCard,DualPath,TestimonialCard,PricingCard,Faq,FinalCta}.astro`
- Create: `landing/src/data/{plans,testimonials,faq}.ts`

**Interfaces:**
- Consumes: `Base.astro`, `Highlight.astro`, tokens (Task 1).
- Produces: composants réutilisés par Tarifs/Fonctionnalités/À propos ; `Kpi.astro` (îlot count-up).

- [ ] **Step 1: `Kpi.astro` — compteur (îlot, seul JS de la page)**

Props `{count:number, dec?:number, prefix?:string, suffix?:string}`. Rend `<span data-num data-count …>0</span>`. Script inline **une seule fois** (dans `Base.astro` ou un composant `CountUp.astro`) — reprendre le JS du prototype : `fmt()`, `animate()`, `IntersectionObserver` sur `.cluster,.stats,.ahero`, `prefers-reduced-motion` → valeur finale directe. Reprendre aussi le `IntersectionObserver` des `.reveal`.

- [ ] **Step 2: Sections de l'accueil (ordre du prototype)**

Porter, dans l'ordre, en reprenant le markup + le CSS du prototype (§ correspondants) :
1. `Hero.astro` — fond **vert immersif** (`.hero` + `::after` lignes de grille), H1 avec `<Highlight>sous contrôle</Highlight>`, sous-titre, CTA orange + bouton `btn-onearth`, micro-preuve, et à droite `.cluster` = `Cockpit.astro` (4 KPI + sparkline SVG) + 2 `.chip` flottantes.
2. `TrustStrip.astro` (dans le hero, sur fond vert).
3. Section **Problème** (`panel panel-stone`) : `SectionHead` + 3 cartes douleur (01/02/03).
4. `StatsBand.astro` (`panel panel-dark`) : 4 stats (45 j / 5 min / 5 modules / 100 %) via `Kpi`.
5. Section **Solution** (`panel`) : `SectionHead` + 5 `FeatureCard` + la carte large « Tout est relié ».
6. `PhotoBand.astro` : image `equipements-ferme` via `astro:assets` (`<Image>` en `background` → utiliser une `<img>` en position absolue + overlay, pour garder l'optimisation).
7. Section **Comment ça marche** (`panel panel-tint`) : 3 `StepCard` (01/02/03).
8. `DualPath.astro` (`panel panel-stone`) : carte éleveur (verte, CTA orange) + carte partenaire (blanche, CTA `btn-dark` → `mailto:PUBLIC_PARTNER_EMAIL`).
9. Section **Témoignages** (`panel`) : 3 `TestimonialCard` (gros chiffre) + la note « illustratifs ».
10. Section **Tarifs** (`panel panel-tint`) : bandeau pilote + 3 `PricingCard` (Pro Volaille `pop`).
11. `Faq.astro` (`panel`) : `<details class="qa">` natifs (accessible, zéro JS).
12. `FinalCta.astro` (`panel panel-dark final`).

- [ ] **Step 3: Copy**

Reprendre **verbatim** le copywriting de l'accueil du spec (`docs/superpowers/specs/2026-07-14-landing-astro-design.md`, section « 1. Accueil ») — il est déjà validé et présent dans le prototype.

- [ ] **Step 4: SEO de l'accueil**

`title` : « Jawdi — Le logiciel de gestion d'élevage avicole en Afrique de l'Ouest » ; meta du spec ; JSON-LD `Organization` + `SoftwareApplication` + `FAQPage` (les questions de la section FAQ).

- [ ] **Step 5: Build + vérif visuelle**

Run: `cd landing && npm run build && npm run preview`
Expected: build SUCCESS ; la page rendue correspond au prototype (hero vert, île du menu, sections pleine largeur alternées, marqueur orange, compteurs animés).

- [ ] **Step 6: Commit**

```bash
git add landing && git commit -m "feat(landing): home page with hero cockpit, stats band, features, pricing and FAQ"
```

---

## Task 3: Fonctionnalités (hub + 5 sous-pages)

**Files:**
- Create: `landing/src/data/modules.ts`, `landing/src/components/ModuleCard.astro`, `landing/src/pages/fonctionnalites/index.astro`, `landing/src/pages/fonctionnalites/[module].astro`

**Interfaces:**
- Consumes: `Base`, `SectionHead`, `Highlight`, `PhotoBand`, `FinalCta`.
- Produces: `modules.ts` = source unique des 5 modules (hub + sous-pages + footer).

- [ ] **Step 1: `data/modules.ts`**

```ts
export interface Module {
  slug: string; name: string; tag: string; teaser: string;
  h1: string; lead: string;
  capabilities: { title: string; body: string }[];
  avoids: string[];
  seo: { title: string; description: string };
}
export const MODULES: Module[] = [ /* elevage, sanitaire, stocks, ventes, finance */ ];
```
Remplir avec le copy du spec (§ « 3–7. Sous-pages fonctionnalités ») : H1, capacités, « Ce que ça vous évite », SEO par module.

- [ ] **Step 2: Hub `/fonctionnalites` (d'après la maquette *Integration*)**

Reprendre du prototype la page `#p-fonctionnalites` : `.phero` centré (pill + H1 avec `<Highlight>` + sous-titre + 2 CTA), section « 5 modules, un seul flux » avec la grille `.mods` (`ModuleCard` : icône, nom + tag mono, teaser, séparateur pointillé, bouton « Découvrir » → `/fonctionnalites/{slug}` ; le module Élevage en `feat-mod`), section « Couverture » avec la **grille bordée `.cov`** (12 items), `PhotoBand`, `FinalCta`.

- [ ] **Step 3: Sous-pages `/fonctionnalites/[module]` (gabarit *Integration Details*)**

`getStaticPaths()` depuis `MODULES`. Gabarit : `.phero` (pill = nom du module, H1, lead), 2–3 blocs « capacité → bénéfice » alternés, encadré « Ce que ça vous évite » (3 puces), `FinalCta`. SEO par module + JSON-LD `BreadcrumbList`.

- [ ] **Step 4: Build**

Run: `cd landing && npm run build`
Expected: 6 pages générées (`/fonctionnalites` + 5 sous-pages), build SUCCESS.

- [ ] **Step 5: Commit**

```bash
git add landing && git commit -m "feat(landing): features hub and five module sub-pages"
```

---

## Task 4: Tarifs + À propos + Partenaires

**Files:**
- Create: `landing/src/components/CompareTable.astro`, `landing/src/pages/{tarifs,a-propos,partenaires}.astro`

- [ ] **Step 1: `/tarifs` (d'après *Pricing*)**

Porter `#p-tarifs` du prototype : `.phero` centré, bandeau pilote, 3 `PricingCard` (Pro Volaille `pop` + badge « Recommandé »), **`CompareTable`** (`.cmp-head` avec la colonne Pro Volaille en `hi` + `.cmp-row` en pilules ✓/✗), la note honnête « pendant le pilote, tous les modules sont actifs quel que soit le plan », témoignages, FAQ tarifs, `FinalCta`. Prix **indicatifs** (15 000 / 25 000 / 45 000 F). JSON-LD `FAQPage`.

- [ ] **Step 2: `/a-propos` (d'après *About us*)**

Porter `#p-a-propos` : hero asymétrique (`.ahero`) avec photo `eleveur-poulets` (`astro:assets`) + 2 `.astat` flottantes (`Kpi`), bloc « Notre vision » (badge `01` + titre à emphase `.dim` + photo `eleveur`), **panneau vert foncé « Nos convictions »** (3 `.val` : Local / Concret / Vos données), les 3 `.tile` de repères (dont l'orange inclinée), `FinalCta`. Garder la note « photo d'équipe et repères réels à ajouter ».

- [ ] **Step 3: `/partenaires` (B2B2C)**

Copy du spec (§ 9) : H1 « Équipez votre réseau d'éleveurs. Fidélisez-les. », 3 bénéfices partenaire, 3 étapes, CTA « Devenir partenaire » → `mailto:PUBLIC_PARTNER_EMAIL`. Réutiliser `.phero` + `FeatureCard` + `FinalCta`.

- [ ] **Step 4: Build + commit**

Run: `cd landing && npm run build`
```bash
git add landing && git commit -m "feat(landing): pricing, about and partners pages"
```

---

## Task 5: FAQ, Contact, Ressources, pages légales

**Files:**
- Create: `landing/src/data/faq.ts`, `landing/src/pages/{faq,contact}.astro`, `landing/src/pages/ressources/index.astro`, `landing/src/pages/ressources/reduire-la-mortalite-poulet-de-chair.astro`, `landing/src/pages/{mentions-legales,confidentialite}.astro`

- [ ] **Step 1: `data/faq.ts` + `/faq`**

Les 9 questions du spec (§ 12) avec réponses complètes. `/faq` = `.phero` + `Faq` (accordéon `<details>`) + `FinalCta`. JSON-LD `FAQPage`. L'accueil et `/tarifs` réutilisent un sous-ensemble depuis la même source.

- [ ] **Step 2: `/contact`**

H1 « Parlons de votre élevage. », canaux (`PUBLIC_PARTNER_EMAIL`, `PUBLIC_CONTACT_PHONE`), formulaire (nom, téléphone, « je suis : éleveur / coopérative / autre », message) **inerte** : `action="mailto:…"` + note « endpoint à brancher ». Cibles ≥ 44px, labels visibles (règle doc 10).

- [ ] **Step 3: `/ressources` + l'article graine**

Hub : grille d'articles (1 carte). Article `reduire-la-mortalite-poulet-de-chair` : 800–1000 mots FR, H2/H3, conseils concrets (démarrage, température, densité, eau, vaccination, suivi quotidien), CTA vers l'app. JSON-LD `Article` + `BreadcrumbList`.

- [ ] **Step 4: Légal**

`/mentions-legales` + `/confidentialite` : gabarits FR standard (éditeur, hébergeur, données personnelles, cookies) avec placeholders `[à compléter]` clairement marqués.

- [ ] **Step 5: Build + commit**

Run: `cd landing && npm run build`
Expected: **15 pages** générées au total.
```bash
git add landing && git commit -m "feat(landing): faq, contact, resources and legal pages"
```

---

## Task 6: SEO, perf & mobile — critères d'acceptation

**Files:** ajustements transverses (`SeoHead.astro`, `Base.astro`, pages).

- [ ] **Step 1: Audit SEO**

Vérifier pour **chaque** page : `<title>` unique, meta description, canonical, OG+Twitter, `lang="fr"`, un seul `<h1>`, `alt` sur toutes les images. Vérifier le sitemap généré (`dist/sitemap-index.xml`) et `robots.txt`.

Run: `cd landing && npm run build && grep -c "<url>" dist/sitemap-0.xml`
Expected: 15 (toutes les pages).

- [ ] **Step 2: JSON-LD**

`Organization` (global), `SoftwareApplication` (accueil), `FAQPage` (accueil + /faq + /tarifs), `Article` (ressource), `BreadcrumbList` (sous-pages). Valider que chaque bloc est un JSON valide (`node -e` sur les fichiers générés ou revue manuelle).

- [ ] **Step 3: Perf / mobile**

- Images : toutes via `astro:assets` (`<Image>`/`<Picture>`, `widths`, `formats:["avif","webp"]`, `loading="lazy"` sauf le hero).
- Fonts : woff2 auto-hébergées, `swap`, preload des 2 graisses critiques.
- Vérifier : zéro scroll horizontal à 320px, cibles ≥ 44px, barre CTA mobile, `prefers-reduced-motion` coupe compteurs + reveals.
- Lancer Lighthouse mobile sur l'accueil : **≥ 95** en Performance, Accessibilité, Best-practices, SEO.

Run: `cd landing && npm run build && npx serve dist -l 4321 &` puis `npx lighthouse http://localhost:4321 --preset=desktop --quiet --chrome-flags="--headless"` (et une passe mobile).
Expected: scores ≥ 95 (mobile). Si < 95, corriger avant de clore.

- [ ] **Step 4: Commit**

```bash
git add landing && git commit -m "feat(landing): seo metadata, structured data and performance pass"
```

---

## Task 7: Vérification finale

**Files:** aucun (vérification).

- [ ] **Step 1: Build propre**

Run: `cd landing && rm -rf dist && npm run build`
Expected: SUCCESS, 15 pages.

- [ ] **Step 2: Revue fidélité au prototype**

Comparer côte à côte `dist` (via `npm run preview`) et `docs/superpowers/specs/assets/landing-prototype.html` : hero vert + cockpit animé, **île** du menu, sections **pleine largeur** alternées (aucun panneau flottant), marqueur orange, bande stats, bande photo, pricing, FAQ, CTA vert, logo. Noter les écarts et les corriger.

- [ ] **Step 3: Commit d'ajustement (si besoin)**

```bash
git add landing && git commit -m "fix(landing): align build with the validated prototype"
```

---

## Self-Review notes

- **Spec coverage :** scaffold+design system (T1) ; accueil (T2) ; fonctionnalités hub + 5 sous-pages (T3) ; tarifs/à-propos/partenaires (T4) ; faq/contact/ressources/légal (T5) ; SEO+perf+mobile (T6) ; vérif (T7). Sitemap 15 pages couvert. ✔
- **Cohérence :** le prototype est cité comme source unique à chaque tâche ; les interdits (panneaux flottants, violet/lime, Tailwind) sont dans les Global Constraints ; les tokens viennent du doc 10 ; le copy vient du spec. ✔
- **No placeholders :** les commandes et fichiers sont explicites ; les seuls `[à compléter]` sont **volontaires** (mentions légales, env, témoignages illustratifs) et documentés. ✔
