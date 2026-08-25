/**
 * On-device rules layer: try each specific parser in order and return the first
 * match. Covers the obvious phrasings offline/for free; anything not matched
 * falls back to the backend LLM (see `useAssistant`).
 */
import type { AssistantIntent, ParseContext } from '../types';
import { weighingParser } from './weighingParser';
import { mortalityParser } from './mortalityParser';
import { dailyRecordParser } from './dailyRecordParser';
import { eggCollectionParser } from './eggCollectionParser';
import { vaccinationParser } from './vaccinationParser';
import { observationParser } from './observationParser';

export function rulesParse(text: string, ctx: ParseContext): AssistantIntent | null {
  // Order matters: the specific phrasings first, the mortality catch-all last. A daily entry and
  // an egg collection both mention counts a bare mortality parser would happily claim.
  return (
    dailyRecordParser.parse(text, ctx) ??
    eggCollectionParser.parse(text, ctx) ??
    vaccinationParser.parse(text, ctx) ??
    weighingParser.parse(text, ctx) ??
    mortalityParser.parse(text, ctx) ??
    // Loosest gate, so it runs last: it must never pre-empt a death, a weighing or a collection.
    observationParser.parse(text, ctx) ??
    null
  );
}
