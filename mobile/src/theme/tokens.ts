/**
 * Jawdi mobile — design tokens ("field mode" — B7).
 *
 * React Native port of `docs/10-design-system.md` (§2 palette, §3 typography, §4 spacing,
 * §9 accessibility), extended with the field decisions from
 * `docs/superpowers/specs/2026-07-20-b7-mobile-design-direction.md`.
 *
 * Dependency-free module: no imports, compiles standalone, compatible with `strict`.
 * All values are in density-independent points (dp/pt), never physical pixels.
 *
 * Two rules govern every colour pair (see design direction §4):
 *   1. WCAG AA  — ratio ≥ 4.5:1 (body text) or ≥ 3:1 (text ≥ 18dp).
 *   2. The "sun" gate — absolute relative-luminance gap ΔL ≥ 0.75.
 * A pair that passes (1) but fails (2) stays readable at a desk and becomes illegible
 * under strong ambient light: it can never carry a value that must be read.
 */

/**
 * Fonts loaded by `expo-font`/`@expo-google-fonts` in `app/_layout.tsx`.
 *
 * React Native (Android especially) does NOT synthesize a weight from a single
 * custom family + `fontWeight`: each weight must be a distinctly-named family
 * whose weight is baked in. So the interface font (web: Outfit) and the digit
 * font (web: JetBrains Mono) are exposed here per weight, and each typography
 * variant below points at the exact weighted family it needs — matching the
 * web's Outfit / JetBrains Mono typography rather than falling back to the
 * device system font.
 */
export const fontFamily = {
  /** Interface, labels, body text (default = medium). */
  sans: 'Outfit_500Medium',
  sansMedium: 'Outfit_500Medium',
  sansSemiBold: 'Outfit_600SemiBold',
  sansBold: 'Outfit_700Bold',
  /** Digits: counters, weighings, tables. Fixed-width = stable columns. */
  mono: 'JetBrainsMono_700Bold',
} as const;

/**
 * Raw ramps sourced from doc 10 §2. Screens never consume these ramps
 * directly: they go through `tokens.colors.field` and `tokens.colors.sync`.
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

/** Deepest green of the primary ramp (locked, identical to `primary[900]`). The only text colour allowed on orange. */
const earth = primary[900];

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
  /** Vet / treatments (mirrors web `vet`). */
  vet: '#7C3AED',
  vetLight: '#EDE9FE',
  vetDark: '#5B21B6',
  /** Clients / commercial people (brief: violet). */
  clients: '#9333EA',
  clientsLight: '#F3E8FF',
  clientsDark: '#6B21A8',
} as const;

/**
 * Semantic aliases for field screens. Single white surface, text pushed to the
 * maximum luminance gap, thick rules: under strong light a 1dp `neutral-200` rule
 * (1.26:1) disappears, a solid white fill never does.
 */
const field = {
  /** Field screen background — pure white, not `neutral-50`: maximum luminance. */
  background: neutral[0],
  /** Elevated surfaces outside the field flow (login, farm picker). */
  surface: neutral[0],
  /** Primary text — 17.49:1, ΔL 0.990. The best pair available. */
  text: neutral[900],
  /** Secondary text — 10.27:1, ΔL 0.948. Replaces the web's `neutral-500` (ΔL 0.831). */
  textMuted: neutral[700],
  /** Text on an inverted dark background. */
  textInverse: neutral[0],
  /** Structural rules and borders, drawn at `layout.ruleWidth`. */
  rule: neutral[700],
  /** Decorative separator carrying no information (dense lists outside the field flow). */
  ruleSubtle: neutral[300],
  /** Disabled control — never used to hide information. */
  disabled: neutral[400],
} as const;

/**
 * The three sync states. Colour never carries the information alone:
 * every state is paired with an icon and a word (colour-blindness + sun-washout).
 *
 * `stripe` = full-height header stripe, identifies the state at the edge of peripheral vision.
 * `bg`/`fg` = the pair actually read. Display priority: failed > pending > synced.
 */
const sync = {
  /** Up to date. Calm: if the normal state shouts, the abnormal one no longer stands out. */
  synced: {
    stripe: primary[600],
    bg: neutral[0],
    fg: neutral[900],
  },
  /** Pending (offline or currently sending). Brand orange as a stripe only. */
  pending: {
    stripe: accent[400],
    bg: neutral[0],
    fg: neutral[900],
  },
  /** Rejected by the server (definitive 4xx, doc 08 §7.3). The only state shown as a solid fill. */
  failed: {
    stripe: semantic.errorDark,
    bg: semantic.error,
    fg: neutral[0],
  },
} as const;

/**
 * Action roles. Semantic split driven by the contrast measurements:
 *   green  = accumulate (repeated, reversible) — white on primary-600, 6.44:1, ΔL 0.887
 *   orange = commit (once per screen)          — earth on accent-400, 6.79:1, ΔL 0.400
 * Orange fails the sun gate: it can only carry a label memorised by position,
 * never a value to read. Its `earth` border restores a high-ΔL edge.
 */
const action = {
  /** Counter increment, repeated action. */
  accumulate: { bg: primary[600], fg: neutral[0], border: primary[800] },
  /** Validation / submission. One per screen (doc 10 §6 "golden rule"). */
  commit: {
    bg: accent[400],
    fg: earth,
    border: earth,
    /**
     * Pressed state — earth on accent-500, 5.33:1 (design direction §4: "restricted —
     * pressed state only"). Kept next to `bg` so screens never have to reach into the
     * raw `accent` ramp for this pairing; `fg`/`border` stay `earth` in both states.
     */
    pressedBg: accent[500],
  },
  /** Correction, back, soft cancel. */
  secondary: { bg: neutral[0], fg: neutral[900], border: neutral[700] },
  /** Destructive. */
  danger: { bg: semantic.error, fg: neutral[0], border: semantic.errorDark },
} as const;

/**
 * Field typography scale. In React Native `lineHeight` is an absolute dp value,
 * not a CSS multiplier: heights are therefore pre-computed.
 * `fontWeight` is typed as a string literal, the only form `TextStyle` accepts.
 */
const typography = {
  /** Counter reading — the hero of every entry screen. */
  numeric: {
    fontFamily: fontFamily.mono,
    fontSize: 64,
    lineHeight: 68,
    fontWeight: '700',
    letterSpacing: -1,
  },
  /** Digit in a list row (headcount, medium weight). */
  numericSm: {
    fontFamily: fontFamily.mono,
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  displayLg: {
    fontFamily: fontFamily.sansBold,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  displayMd: {
    fontFamily: fontFamily.sansSemiBold,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  headingLg: {
    fontFamily: fontFamily.sansSemiBold,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '600',
    letterSpacing: 0,
  },
  headingMd: {
    fontFamily: fontFamily.sansSemiBold,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
    letterSpacing: 0,
  },
  /** Default body copy in field mode — one notch above the web (doc 10: 14dp). */
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
  /** Absolute floor. Never for a business value. */
  bodySm: {
    fontFamily: fontFamily.sans,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    letterSpacing: 0,
  },
  /** Field label, in caps (doc 10 §3: caps tolerated only at this level). */
  label: {
    fontFamily: fontFamily.sansSemiBold,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  /** Button text. */
  button: {
    fontFamily: fontFamily.sansSemiBold,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  /** Status word in the sync banner. */
  syncLabel: {
    fontFamily: fontFamily.sansBold,
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

  /** 4dp scale, carried over as-is from doc 10 §4. */
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
   * Touch targets. `min` and `button` come from doc 10 §9; the others are
   * field decisions (gloved or wet hand, repeated tap).
   */
  touch: {
    /** Accessibility floor — incidental controls only. */
    min: 44,
    /** Secondary / cancel button (brief: 48dp). */
    secondary: 48,
    /** Standard button outside an entry screen (doc 10 §9). */
    button: 48,
    /** Primary button, standard screens (brief: 56dp — gloved/field use). */
    primaryButton: 56,
    /** Primary CTA on an action screen (brief: 72dp — "Enregistrer" géant). */
    cta: 72,
    /** Quick-action tile on the dashboard (brief: ≥ 96dp). */
    quickAction: 104,
    /** Any control on an entry screen. */
    field: 64,
    /** Increment pad, tapped dozens of times in a row. ≈ 15 mm. */
    counterPrimary: 96,
    /** Decrement / correction. Deliberately smaller than the increment. */
    counterSecondary: 64,
    /** Key of the built-in numeric keypad. */
    keypadKey: 64,
    /** Minimum gap between two targets (doc 10 §9). */
    gap: 8,
    /** Minimum gap between a repeated target and a target with the opposite effect. */
    gapDanger: 24,
  },

  layout: {
    /** Horizontal margin of field screens. */
    screenPadding: 16,
    /** Breathing room between two blocks — replaces the card border. */
    sectionGap: 24,
    /** Persistent bottom action bar, outside the safe-area inset. */
    actionBarHeight: 88,
    /** Sync banner — sized to remain a legal target. */
    syncRibbonHeight: 44,
    /** Header stripe of the sync banner. */
    syncStripeWidth: 6,
    /** Thickness of structural rules. A 1dp rule is invisible in full daylight. */
    ruleWidth: 2,
    /** Thickness of button borders. */
    borderWidth: 2,
    /** Bottom fraction of the screen reserved for primary actions (thumb zone). */
    thumbZoneRatio: 0.35,
  },

  /**
   * Icon sizes (design direction §7, gap #9 vs doc 10's 20/24dp Lucide default):
   * bumped up for the same reason as the body-text bump — legibility at arm's length,
   * under glare, on a dusty screen.
   */
  icons: {
    /** Minimum icon size anywhere in field mode. */
    default: 24,
    /** Icon size inside the sync banner only — the one icon that is permanently on screen. */
    syncBanner: 28,
  },

  /** Motion kept to the strict minimum: counter tick, banner toggle. */
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
export type IconToken = keyof Tokens['icons'];
