# 10 — Design System Jawdi

> Identité visuelle, tokens design, conventions UI.
> Référence pour Sprint A6 (frontend) et tous les sprints frontend suivants.
>
> **Outil de prototypage** : Stitch (Google AI design) — maquettes IA générées puis converties en code.
> **Library cible** : MUI v7, themed en profondeur pour éviter le look "MUI générique".

---

## Table des matières

1. [Brand identity](#1-brand-identity)
2. [Palette de couleurs](#2-palette-de-couleurs)
3. [Typographie](#3-typographie)
4. [Espacement & rayons](#4-espacement--rayons)
5. [Iconographie](#5-iconographie)
6. [Composants — guidelines](#6-composants--guidelines)
7. [Tokens MUI v7](#7-tokens-mui-v7)
8. [Workflow Stitch → code](#8-workflow-stitch--code)
9. [Accessibilité & mobile-first](#9-accessibilité--mobile-first)

---

## 1. Brand identity

### Positionnement

Jawdi Platform = **outil sérieux d'éleveur professionnel africain**, pas un jouet tech.

**Trois adjectifs pivots :**
- **Chaleureux** (couleurs warm, pas froid corporate)
- **Sérieux** (typographie pro, données lisibles)
- **Local** (références visuelles Sénégal/Afrique de l'Ouest, sans clichés)

### Référence émotionnelle

| Bon repère | Mauvais repère |
|---|---|
| Linear (clarté data) | Salesforce (lourd, daté) |
| Stripe Dashboard (pro warm) | Material Design vanille (générique) |
| Vercel (typographie soignée) | Bootstrap (impersonnel) |
| Notion (densité d'info maîtrisée) | Templates SaaS génériques |

### Voix UX

- **Direct** : "Saisir la mortalité" pas "Veuillez enregistrer un événement de mortalité"
- **Bilingue-ready** : FR principal, structures qui supportent WO et EN dès V2
- **Concret** : "12 lots actifs · 3 460 poussins" pas "Vue d'ensemble globale"

---

## 2. Palette de couleurs

### Couleurs principales

```css
/* PRIMARY — Vert élevage/nature, profond pour ne pas faire "écolo cliché" */
--color-primary-50:  #F0F7F0;
--color-primary-100: #DCEEDC;
--color-primary-200: #B8DDB8;
--color-primary-300: #8BC68B;
--color-primary-400: #5EAA5E;
--color-primary-500: #3D8B3D;  /* ← main */
--color-primary-600: #2E6B2E;
--color-primary-700: #245524;
--color-primary-800: #1B3F1B;
--color-primary-900: #122B12;

/* ACCENT — Orange Sénégal (drapeau + terre), pour CTAs forts et highlights */
--color-accent-50:  #FFF4E6;
--color-accent-100: #FFE1B8;
--color-accent-200: #FFCB85;
--color-accent-300: #FFB04D;
--color-accent-400: #F8961E;  /* ← main accent */
--color-accent-500: #E67E0A;
--color-accent-600: #C46505;
--color-accent-700: #9C4F03;
--color-accent-800: #7A3D02;
--color-accent-900: #5A2C01;
```

### Couleurs sémantiques

```css
/* SUCCESS — vert plus saturé que primary, pour distinguer */
--color-success: #16A34A;
--color-success-light: #DCFCE7;
--color-success-dark: #14532D;

/* WARNING — jaune terre, pas jaune fluo */
--color-warning: #D97706;
--color-warning-light: #FEF3C7;
--color-warning-dark: #78350F;

/* ERROR — rouge profond, pas rouge tomate */
--color-error: #DC2626;
--color-error-light: #FEE2E2;
--color-error-dark: #7F1D1D;

/* INFO — bleu sobre, peu utilisé (réservé tooltips/links) */
--color-info: #2563EB;
--color-info-light: #DBEAFE;
--color-info-dark: #1E3A8A;
```

### Neutres (texte, bordures, backgrounds)

```css
--color-neutral-0:   #FFFFFF;
--color-neutral-50:  #FAFAF9;  /* ← background app, légèrement chaud */
--color-neutral-100: #F5F5F4;
--color-neutral-200: #E7E5E4;  /* ← bordures subtiles */
--color-neutral-300: #D6D3D1;
--color-neutral-400: #A8A29E;
--color-neutral-500: #78716C;  /* ← texte secondaire */
--color-neutral-600: #57534E;
--color-neutral-700: #44403C;
--color-neutral-800: #292524;  /* ← texte principal */
--color-neutral-900: #1C1917;
--color-neutral-950: #0C0A09;  /* ← dark mode background (futur) */
```

> **Note** : neutres "stone" de Tailwind (légèrement chauds) plutôt que "slate"/"gray" (froids). Cohérent avec l'identité chaleureuse.

### Règles d'usage couleurs

| Usage | Couleur |
|---|---|
| Background app | `neutral-50` |
| Cards / surfaces | `neutral-0` (blanc pur) |
| Texte principal | `neutral-800` |
| Texte secondaire | `neutral-500` |
| Bordures subtiles | `neutral-200` |
| CTA primaire | `accent-400` (orange) — pour faire ACTION |
| Liens & sélections | `primary-600` |
| Badge succès | `success-light` bg + `success-dark` text |
| Badge erreur | `error-light` bg + `error-dark` text |
| Charts data viz | accent, primary, info en alternance |

### Anti-patterns couleurs

❌ Ne JAMAIS utiliser :
- Vert tilleul / vert pomme (look "écolo cheap")
- Orange fluo / saturé pur (#FF6B00 type) → préférer warm orange Sénégal
- Bleu Facebook / Twitter (#1877F2) → trop identifié social
- Gris cendre froid → utiliser stone neutrals
- Dégradés multicolores → 1 dégradé max par écran (hero only)

---

## 3. Typographie

### Stack font

```css
/* UI — interface, texte courant, titres */
--font-sans: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;

/* Data / code / numbers — chiffres tableaux, IDs, JSON */
--font-mono: 'JetBrains Mono', Consolas, monospace;
```

**Loading** : Google Fonts via Next.js `next/font` (CLS-safe, preload auto).

### Échelle typographique

| Token | Size | Line-height | Weight | Usage |
|---|---|---|---|---|
| `display-xl` | 48px / 3rem | 1.1 | 700 | Hero landing page |
| `display-lg` | 36px / 2.25rem | 1.15 | 700 | Titre dashboard |
| `display-md` | 30px / 1.875rem | 1.2 | 600 | Titre page |
| `display-sm` | 24px / 1.5rem | 1.25 | 600 | Titre section |
| `heading-lg` | 20px / 1.25rem | 1.3 | 600 | Card title |
| `heading-md` | 18px / 1.125rem | 1.3 | 600 | Subtitle |
| `body-lg` | 16px / 1rem | 1.5 | 400 | Body principal |
| `body-md` | 14px / 0.875rem | 1.5 | 400 | Body secondaire (default) |
| `body-sm` | 13px / 0.8125rem | 1.4 | 400 | Caption, helper text |
| `body-xs` | 12px / 0.75rem | 1.3 | 500 | Badges, labels uppercase |
| `mono-md` | 14px / 0.875rem | 1.4 | 500 | Data tableaux, IDs |

### Conventions

- **Pas de uppercase forcé** sur le body (mauvaise lisibilité, surtout en français accentué)
- **Uppercase autorisé uniquement** sur `body-xs` (badges, labels système)
- **Numbers tabulaires** : utiliser `font-variant-numeric: tabular-nums` sur les tableaux de données (alignement chiffres décimaux)
- **Densité** : préférer `line-height: 1.5` sur body (lisibilité Sénégal — lecture parfois moins habituelle)

---

## 4. Espacement & rayons

### Échelle d'espacement (4px base)

```css
--space-0:  0;
--space-1:  4px;
--space-2:  8px;
--space-3:  12px;
--space-4:  16px;   /* ← gap par défaut */
--space-5:  20px;
--space-6:  24px;
--space-8:  32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
--space-20: 80px;
--space-24: 96px;
```

### Rayons de bordure

```css
--radius-sm:  4px;   /* badges, chips */
--radius-md:  8px;   /* boutons, inputs (default) */
--radius-lg:  12px;  /* cards */
--radius-xl:  16px;  /* dialogs, modales */
--radius-2xl: 24px;  /* hero sections */
--radius-full: 9999px; /* avatars, pills */
```

> **Principe** : pas de "border-radius 4px partout" générique MUI. Cards en 12px = look plus moderne et chaleureux.

### Ombres

```css
/* Subtiles, jamais agressives */
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -2px rgba(0, 0, 0, 0.04);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.04);
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04);

/* Focus ring — visible mais pas criard */
--shadow-focus: 0 0 0 3px var(--color-primary-100);
```

---

## 5. Iconographie

### Bibliothèque

**Lucide Icons** (`lucide-react`) — modernes, cohérentes, light/regular weight, large couverture.

### Conventions

- Taille par défaut : **20px** (UI inline), **24px** (boutons), **16px** (badges)
- `stroke-width: 1.75` (entre default 2 et light 1.5 — équilibre lisibilité/finesse)
- Couleur : hérite du texte parent (`currentColor`) sauf cas spécifique

### Cas spécifiques métier (icônes custom)

À créer en SVG custom (pas couverts par Lucide) :
- 🐓 Poulet (broiler/layer distinct)
- 🥚 Œuf (avec variantes S/M/L/XL)
- 🐑 Mouton (V2)
- 🐄 Vache (V3)
- 📋 Lot/Batch
- 💉 Vaccin

> **Action Sprint A6** : créer un mini-set d'icônes métier SVG dans `web/public/icons/`.

---

## 6. Composants — guidelines

### Boutons

```
┌─────────────────────────────────────────────────────────┐
│  PRIMARY (CTA principal — orange)                       │
│  bg: accent-400 → hover accent-500                      │
│  text: earth #122B12 (PAS blanc — cf. note ci-dessous)  │
│  height: 40px (default), 32px (sm), 48px (lg)           │
│  radius: 8px                                            │
│  padding: 0 16px                                        │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  SECONDARY (action secondaire — neutre)                 │
│  bg: white                                              │
│  border: 1px neutral-200                                │
│  text: neutral-800                                      │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  GHOST (action discrète, dans toolbar)                  │
│  bg: transparent → hover neutral-100                    │
│  text: neutral-700                                      │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  DANGER (suppression, action destructive)               │
│  bg: error → hover error-dark                           │
│  text: white                                            │
└─────────────────────────────────────────────────────────┘
```

**Règle d'or boutons** : 1 seul PRIMARY par écran. Si tu en mets 2, c'est qu'un des deux doit être SECONDARY.

### Cards

- Bg blanc, border `neutral-200` (1px), radius 12px
- Padding interne : `space-6` (24px)
- Gap entre cards : `space-4` (16px) mobile, `space-6` (24px) desktop
- Hover (si clickable) : `shadow-md` + transition 150ms

### Inputs

- Height : 40px (default)
- Border : 1px `neutral-300` → focus `primary-500` + `shadow-focus`
- Radius : 8px
- Padding : 0 12px
- Label : `body-sm` au-dessus, `neutral-700`
- Helper text : `body-sm`, `neutral-500`
- Error state : border + helper en `error`

### Tables (data dense)

- Header : `body-xs uppercase` + `neutral-500` + bg `neutral-50`
- Cells : `body-md`, padding `space-3` vertical, `space-4` horizontal
- Numbers : `font-mono` + `tabular-nums` + align-right
- Row hover : `neutral-50`
- Borders : `neutral-200`, uniquement horizontales (pas verticales — trop dense)
- Sticky header sur tables > 10 lignes

### Badges (statuts)

```
ACTIF     → bg success-light, text success-dark, radius full
EN ATTENTE → bg warning-light, text warning-dark
TERMINÉ   → bg neutral-200, text neutral-700
ERREUR    → bg error-light, text error-dark
```

- Taille : `body-xs` (12px), uppercase, font-weight 500
- Padding : 4px 10px
- Radius : full (pill)

### Layout (AppShell)

```
┌─────────────────────────────────────────────────────────┐
│ Header (60px height)                                    │
│ - Logo gauche                                           │
│ - Sélecteur ferme centre (search-like dropdown)         │
│ - Avatar user + menu droite                             │
├──────────┬──────────────────────────────────────────────┤
│          │                                              │
│ Sidebar  │  Main content                                │
│ (240px)  │  - Padding 32px                              │
│          │  - Max-width 1440px (centered si plus large) │
│ Sections │                                              │
│ + items  │                                              │
│          │                                              │
└──────────┴──────────────────────────────────────────────┘
```

Sidebar collapsable à 64px (icons-only) pour gain d'espace écran.

---

## 7. Tokens MUI v7

### Structure du theme

```typescript
// web/src/theme/index.ts
import { createTheme } from '@mui/material/styles';

export const avicareTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      50: '#F0F7F0',
      // ... (toute la scale)
      main: '#3D8B3D',
    },
    secondary: {
      main: '#F8961E',  // orange accent
    },
    success: { main: '#16A34A' },
    warning: { main: '#D97706' },
    error: { main: '#DC2626' },
    info: { main: '#2563EB' },
    background: {
      default: '#FAFAF9',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#292524',
      secondary: '#78716C',
    },
  },
  typography: {
    fontFamily: '"Outfit", -apple-system, BlinkMacSystemFont, sans-serif',
    h1: { fontSize: '3rem', fontWeight: 700, lineHeight: 1.1 },
    h2: { fontSize: '2.25rem', fontWeight: 700, lineHeight: 1.15 },
    h3: { fontSize: '1.875rem', fontWeight: 600, lineHeight: 1.2 },
    h4: { fontSize: '1.5rem', fontWeight: 600, lineHeight: 1.25 },
    h5: { fontSize: '1.25rem', fontWeight: 600, lineHeight: 1.3 },
    h6: { fontSize: '1.125rem', fontWeight: 600, lineHeight: 1.3 },
    body1: { fontSize: '1rem', lineHeight: 1.5 },
    body2: { fontSize: '0.875rem', lineHeight: 1.5 },
    caption: { fontSize: '0.8125rem', lineHeight: 1.4 },
    button: { textTransform: 'none', fontWeight: 500 },  // pas d'uppercase forcé
  },
  shape: {
    borderRadius: 8,  // default radius
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 500,
          padding: '8px 16px',
        },
        containedPrimary: {
          backgroundColor: '#F8961E',  // primary CTA = orange
          '&:hover': { backgroundColor: '#E67E0A' },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          border: '1px solid #E7E5E4',
          boxShadow: 'none',
        },
      },
    },
    MuiTextField: {
      defaultProps: { variant: 'outlined', size: 'small' },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: '#FAFAF9',
          '& .MuiTableCell-head': {
            fontWeight: 600,
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: '#78716C',
          },
        },
      },
    },
  },
});
```

### Anti-patterns MUI à éviter

❌ Ne pas faire :
- Garder les couleurs MUI default (purple/blue) → override entièrement
- Utiliser `<Button variant="contained">` partout sans personnaliser
- Laisser `textTransform: uppercase` sur les boutons (MUI default)
- Garder `shadows` MUI default (5 niveaux d'élévation type Material Design 2014)
- Utiliser des `Paper` empilés → préférer Cards avec borders subtiles

---

## 8. Workflow Stitch → code

### Process recommandé

```
1. STITCH (Google AI)
   → Générer maquette page (login, dashboard, fermes, etc.)
   → Brief : "Jawdi = SaaS élevage avicole Sénégal, palette vert/orange,
              MUI v7, style chaleureux pro, FR"
   → Export en HTML/CSS ou React (selon options Stitch)

2. EXTRACTION
   → Identifier : structure layout, espacements, hiérarchie visuelle
   → Ignorer : couleurs exactes (utiliser tokens doc 10), composants 
     (utiliser MUI v7), typo (utiliser stack défini)

3. RECONSTRUCTION dans le repo
   → Coder en React 19 + MUI v7 + theme avicareTheme
   → Respecter strictement les tokens du doc 10
   → Si Stitch propose un composant non-MUI → soit utiliser MUI équivalent, 
     soit créer composant custom dans web/src/components/

4. VALIDATION
   → Vérifier responsive (mobile-first 320px → desktop 1440px+)
   → Vérifier accessibilité (contraste WCAG AA min)
   → Vérifier dark mode si applicable (V2+)
```

### Pièges Stitch

⚠️ **Stitch génère du Tailwind** par défaut. Ton stack = MUI v7. Donc :
- N'importe PAS le Tailwind généré
- Utilise Stitch comme **inspiration visuelle**, pas comme **source de code**
- Garde les classes Tailwind comme **référence** (espacements, layouts) → traduit en MUI `sx={{}}`

### Pages prioritaires à designer dans Stitch (Sprint A6)

1. **Login / Signup** (auth)
2. **AppShell** (header + sidebar + main)
3. **Dashboard** (cards stats, charts)
4. **Page fermes** (list + create)
5. **Page équipe ferme** (members + invite)
6. **Page abonnement** (current plan + upgrade)
7. **Hub paramétrage** (catégories de réglages)

---

## 9. Accessibilité & mobile-first

### Contraste WCAG

- Texte normal : ratio ≥ 4.5:1
- Texte large (≥18px) : ratio ≥ 3:1
- Vérifier `neutral-500` sur `neutral-0` : 4.6:1 ✅
- **CTA orange — ratios mesurés (2026-07-17)**. Les combinaisons naïves échouent toutes :
  - `accent-400` (#F8961E) et blanc, **dans les deux sens** : **2.24:1** ❌
    (le contraste est symétrique — inverser texte et fond ne change rien. Une note antérieure
    annonçait 2.9:1 pour orange-sur-blanc et 2.24:1 pour blanc-sur-orange : c'était la même
    paire, donc le 2.9 était faux.)
  - blanc et `accent-500` (#E67E0A) : **2.86:1** ❌
  → **Règle retenue** : fond `accent-400` + texte **`earth` #122B12** = **6.79:1** ✅ (AAA),
  et **5.33:1** ✅ sur `accent-500` au survol. L'orange de marque reste inchangé.

### Focus states

Tous les éléments interactifs ont un focus visible :
```css
outline: none;
box-shadow: 0 0 0 3px var(--color-primary-100);
```

### Tailles de touch (mobile)

- Cibles tactiles minimum : 44x44 px
- Boutons mobile : height 48px (pas 40px desktop)
- Spacing entre cibles : 8px min

### Breakpoints

```typescript
// MUI v7 breakpoints (alignés sur tokens projet)
breakpoints: {
  values: {
    xs: 0,      // mobile
    sm: 640,    // tablet portrait
    md: 768,    // tablet landscape
    lg: 1024,   // desktop
    xl: 1280,   // large desktop
    '2xl': 1536, // wide
  },
}
```

### Mobile-first reflex

- Sidebar → drawer collapsable sur < 1024px
- Tables → cards stack sur < 768px
- Header → menu hamburger sur < 640px
- Padding pages : 16px mobile, 32px desktop

---

## 10. Documents associés

- `00-vision-strategique.md` — Vision globale + UI lib MUI v7 validée
- `06-cross-cutting.md` — i18n (impacte texts UI)
- `07-frontend-nextjs.md` — Architecture frontend (à créer avant Sprint A6 si nécessaire)
- `web/src/theme/index.ts` — Implémentation du theme MUI

---

_Document créé pour démarrage Sprint A6 (rattrapage frontend A3+A4+A5). À enrichir au fur et à mesure des composants créés._
