/**
 * Point d'entrée du thème mobile.
 *
 * Tous les composants des tâches suivantes importent depuis `@/theme`, jamais
 * depuis `@/theme/tokens` : la façade reste stable si l'implémentation bouge.
 *
 *   import { tokens } from '@/theme';
 *
 * Aucune valeur littérale de couleur, d'espacement ou de taille de police ne doit
 * apparaître ailleurs que dans `tokens.ts` (doc 10 : « aucune valeur métier en dur »,
 * appliqué ici au visuel).
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
} from './tokens';
