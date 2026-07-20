/**
 * Mobile theme entry point.
 *
 * All components in later tasks import from `@/theme`, never from `@/theme/tokens`:
 * the facade stays stable even if the implementation changes.
 *
 *   import { tokens } from '@/theme';
 *
 * No literal colour, spacing, or font-size value should appear anywhere but
 * `tokens.ts` (doc 10: "no hardcoded business value", applied here to the visuals).
 */

export { tokens, fontFamily } from './tokens';
export type {
  Tokens,
  ColorTokens,
  SpacingToken,
  RadiusToken,
  TypographyToken,
  SyncState,
  ActionRole,
  IconToken,
} from './tokens';
