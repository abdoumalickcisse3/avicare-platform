/**
 * AviCare mobile — design tokens (B7 « mode terrain »).
 *
 * Portage React Native de `docs/10-design-system.md` (§2 palette, §3 typo, §4 espacement,
 * §9 accessibilité), augmenté des décisions terrain de
 * `docs/superpowers/specs/2026-07-20-b7-mobile-design-direction.md`.
 *
 * Module sans dépendance : aucun import, compile seul, compatible `strict`.
 * Toutes les valeurs sont en points densité-indépendants (dp/pt), jamais en pixels physiques.
 *
 * Deux règles gouvernent chaque couple de couleurs (cf. direction de design §4) :
 *   1. WCAG AA  — ratio ≥ 4.5:1 (texte courant) ou ≥ 3:1 (texte ≥ 18dp).
 *   2. Porte « soleil » — écart de luminance relative ΔL ≥ 0.75.
 * Un couple qui passe (1) mais échoue (2) reste lisible au bureau et devient illisible
 * en lumière ambiante forte : il ne peut jamais porter une valeur à lire.
 */

/** Familles chargées par `expo-font` à la tâche 3. Repli système si absentes. */
export const fontFamily = {
  /** Interface, libellés, corps de texte. */
  sans: 'Outfit',
  /** Chiffres : compteurs, pesées, tableaux. Chasse fixe = colonnes stables. */
  mono: 'JetBrainsMono',
} as const;

/**
 * Rampes brutes issues de doc 10 §2. Les écrans ne consomment pas ces rampes
 * directement : ils passent par `tokens.colors.field` et `tokens.colors.sync`.
 */
const primary = {
  50: '#F0F7F0',
  100: '#DCEEDC',
  200: '#B8DDB8',
  300: '#8BC68B',
  400: '#5EAA5E',
  500: '#3D8B3D',
  600: '#2E6B2E',
  700: '#245524',
  800: '#1B3F1B',
  900: '#122B12',
} as const;

const accent = {
  50: '#FFF4E6',
  100: '#FFE1B8',
  200: '#FFCB85',
  300: '#FFB04D',
  400: '#F8961E',
  500: '#E67E0A',
  600: '#C46505',
  700: '#9C4F03',
  800: '#7A3D02',
  900: '#5A2C01',
} as const;

const neutral = {
  0: '#FFFFFF',
  50: '#FAFAF9',
  100: '#F5F5F4',
  200: '#E7E5E4',
  300: '#D6D3D1',
  400: '#A8A29E',
  500: '#78716C',
  600: '#57534E',
  700: '#44403C',
  800: '#292524',
  900: '#1C1917',
  950: '#0C0A09',
} as const;

/** Vert le plus profond de la rampe primary. Seule couleur de texte admise sur l'orange. */
const earth = '#122B12';

const semantic = {
  success: '#16A34A',
  successLight: '#DCFCE7',
  successDark: '#14532D',
  warning: '#D97706',
  warningLight: '#FEF3C7',
  warningDark: '#78350F',
  error: '#DC2626',
  errorLight: '#FEE2E2',
  errorDark: '#7F1D1D',
  info: '#2563EB',
  infoLight: '#DBEAFE',
  infoDark: '#1E3A8A',
} as const;

/**
 * Alias sémantiques des écrans terrain. Surface unique blanche, texte au maximum
 * d'écart de luminance, filets épais : sous forte lumière un filet 1dp `neutral-200`
 * (1.26:1) disparaît, un aplat blanc ne disparaît jamais.
 */
const field = {
  /** Fond des écrans terrain — blanc pur, pas `neutral-50` : luminance maximale. */
  background: neutral[0],
  /** Surfaces surélevées hors terrain (login, sélecteur de ferme). */
  surface: neutral[0],
  /** Texte principal — 17.49:1, ΔL 0.990. Le meilleur couple disponible. */
  text: neutral[900],
  /** Texte secondaire — 10.27:1, ΔL 0.948. Remplace `neutral-500` du web (ΔL 0.831). */
  textMuted: neutral[700],
  /** Texte sur fond sombre inversé. */
  textInverse: neutral[0],
  /** Filets et bordures structurels, à tracer en `layout.ruleWidth`. */
  rule: neutral[700],
  /** Séparateur décoratif non porteur d'information (listes denses hors terrain). */
  ruleSubtle: neutral[300],
  /** Contrôle désactivé — jamais utilisé pour masquer une information. */
  disabled: neutral[400],
} as const;

/**
 * Les trois états de synchronisation. La couleur ne porte jamais seule l'information :
 * chaque état s'accompagne d'une icône et d'un mot (daltonisme + délavage solaire).
 *
 * `stripe` = liseré de tête pleine hauteur, identifie l'état à la périphérie du regard.
 * `bg`/`fg` = le couple réellement lu. Priorité d'affichage : failed > pending > synced.
 */
const sync = {
  /** À jour. Calme : si l'état normal crie, l'état anormal n'est plus remarqué. */
  synced: {
    stripe: primary[600],
    bg: neutral[0],
    fg: neutral[900],
  },
  /** En attente (hors ligne ou envoi en cours). Orange de marque en liseré seulement. */
  pending: {
    stripe: accent[400],
    bg: neutral[0],
    fg: neutral[900],
  },
  /** Refusé par le serveur (4xx définitif, doc 08 §7.3). Seul état en aplat plein. */
  failed: {
    stripe: semantic.errorDark,
    bg: semantic.error,
    fg: neutral[0],
  },
} as const;

/**
 * Rôles d'action. Séparation sémantique issue des mesures de contraste :
 *   vert  = accumuler (répété, réversible) — blanc sur primary-600, 6.44:1, ΔL 0.887
 *   orange = valider  (une fois par écran) — earth sur accent-400, 6.79:1, ΔL 0.400
 * L'orange échoue la porte soleil : il ne porte qu'un libellé mémorisé par position,
 * jamais une valeur. Sa bordure `earth` restitue une arête à fort ΔL.
 */
const action = {
  /** Incrément du compteur, action répétée. */
  accumulate: { bg: primary[600], fg: neutral[0], border: primary[800] },
  /** Validation / envoi. Un seul par écran (doc 10 §6 « règle d'or »). */
  commit: { bg: accent[400], fg: earth, border: earth },
  /** Correction, retour, annulation douce. */
  secondary: { bg: neutral[0], fg: neutral[900], border: neutral[700] },
  /** Destructif. */
  danger: { bg: semantic.error, fg: neutral[0], border: semantic.errorDark },
} as const;

/**
 * Échelle typographique terrain. En React Native `lineHeight` est une valeur absolue
 * en dp, pas un multiplicateur CSS : les hauteurs sont donc pré-calculées.
 * `fontWeight` est typé en littéral string, seule forme acceptée par `TextStyle`.
 */
const typography = {
  /** Lecture du compteur — le héros de chaque écran de saisie. */
  numeric: {
    fontFamily: fontFamily.mono,
    fontSize: 64,
    lineHeight: 68,
    fontWeight: '700',
    letterSpacing: -1,
  },
  /** Chiffre en ligne de liste (effectif, poids moyen). */
  numericSm: {
    fontFamily: fontFamily.mono,
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  displayLg: {
    fontFamily: fontFamily.sans,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  displayMd: {
    fontFamily: fontFamily.sans,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  headingLg: {
    fontFamily: fontFamily.sans,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '600',
    letterSpacing: 0,
  },
  headingMd: {
    fontFamily: fontFamily.sans,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
    letterSpacing: 0,
  },
  /** Corps par défaut en mode terrain — un cran au-dessus du web (doc 10 : 14dp). */
  bodyLg: {
    fontFamily: fontFamily.sans,
    fontSize: 17,
    lineHeight: 26,
    fontWeight: '500',
    letterSpacing: 0,
  },
  bodyMd: {
    fontFamily: fontFamily.sans,
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '500',
    letterSpacing: 0,
  },
  /** Plancher absolu. Jamais pour une valeur métier. */
  bodySm: {
    fontFamily: fontFamily.sans,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    letterSpacing: 0,
  },
  /** Libellé de champ, en capitales (doc 10 §3 : capitales tolérées à ce seul niveau). */
  label: {
    fontFamily: fontFamily.sans,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  /** Texte de bouton. */
  button: {
    fontFamily: fontFamily.sans,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  /** Mot d'état du bandeau de synchronisation. */
  syncLabel: {
    fontFamily: fontFamily.sans,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
} as const;

export const tokens = {
  colors: {
    primary,
    accent,
    neutral,
    earth,
    ...semantic,
    field,
    sync,
    action,
  },

  /** Échelle 4dp reprise telle quelle de doc 10 §4. */
  spacing: {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    8: 32,
    10: 40,
    12: 48,
    16: 64,
  },

  radii: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },

  typography,

  /**
   * Cibles tactiles. `min` et `button` portent doc 10 §9 ; les autres sont des
   * décisions terrain (main gantée ou humide, appui répété).
   */
  touch: {
    /** Plancher d'accessibilité — contrôles incidents uniquement. */
    min: 44,
    /** Bouton standard hors écran de saisie (doc 10 §9). */
    button: 48,
    /** Tout contrôle d'un écran de saisie. */
    field: 64,
    /** Pavé d'incrément, pressé des dizaines de fois d'affilée. ≈ 15 mm. */
    counterPrimary: 96,
    /** Décrément / correction. Volontairement plus petit que l'incrément. */
    counterSecondary: 64,
    /** Touche du pavé numérique intégré. */
    keypadKey: 64,
    /** Écart minimal entre deux cibles (doc 10 §9). */
    gap: 8,
    /** Écart minimal entre une cible répétée et une cible aux effets opposés. */
    gapDanger: 24,
  },

  layout: {
    /** Marge horizontale des écrans terrain. */
    screenPadding: 16,
    /** Respiration entre deux blocs — remplace la bordure de carte. */
    sectionGap: 24,
    /** Barre d'action basse persistante, hors inset de sécurité. */
    actionBarHeight: 88,
    /** Bandeau de synchronisation — dimensionné pour rester une cible légale. */
    syncRibbonHeight: 44,
    /** Liseré de tête du bandeau de synchronisation. */
    syncStripeWidth: 6,
    /** Épaisseur des filets structurels. Un filet 1dp est invisible en plein jour. */
    ruleWidth: 2,
    /** Épaisseur des bordures de bouton. */
    borderWidth: 2,
    /** Fraction basse de l'écran réservée aux actions primaires (zone du pouce). */
    thumbZoneRatio: 0.35,
  },

  /** Mouvement réduit au strict nécessaire : tic du compteur, bascule du bandeau. */
  motion: {
    fast: 120,
    base: 200,
  },
} as const;

export type Tokens = typeof tokens;
export type ColorTokens = Tokens['colors'];
export type SpacingToken = keyof Tokens['spacing'];
export type RadiusToken = keyof Tokens['radii'];
export type TypographyToken = keyof Tokens['typography'];
export type SyncState = keyof Tokens['colors']['sync'];
export type ActionRole = keyof Tokens['colors']['action'];
