/**
 * On-device rules layer: try each specific parser in order and return the first
 * match. Covers the obvious phrasings offline/for free; anything not matched
 * falls back to the backend LLM (see `useAssistant`).
 */
import type { AssistantIntent, ParseContext } from '../types';
import { weighingParser } from './weighingParser';
import { mortalityParser } from './mortalityParser';

export function rulesParse(text: string, ctx: ParseContext): AssistantIntent | null {
  // Specific keywords first (weighing), then the mortality fallback.
  return weighingParser.parse(text, ctx) ?? mortalityParser.parse(text, ctx) ?? null;
}
