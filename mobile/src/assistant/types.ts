/**
 * Assistant contracts (Phase 1). The UI/flow depends only on these types — it
 * never knows whether an intent came from the rules parser (Phase 1) or, later,
 * an LLM. That decoupling is the whole point: an `IntentParser` implementation
 * can be swapped without touching the confirmation flow.
 *
 * Design reference: docs/12-assistant-ia-strategie.md.
 */

/** A production unit the parser can resolve an intent against. */
export interface AssistantUnit {
  id: number;
  name: string;
  currentCount: number;
}

/** Context handed to a parser: the current lot (if the assistant was opened
 * from one) and the farm's active units (for default/resolution). */
export interface ParseContext {
  unitId?: number | null;
  activeUnits?: AssistantUnit[];
}

/** Phase 1's only intent: record a mortality event. `unitId === null` means the
 * lot still has to be chosen before confirmation. */
export interface MortalityIntent {
  kind: 'MORTALITY';
  count: number;
  reason?: string;
  unitId: number | null;
}

/** Union of supported intents. Grows in later phases (weighing, collection…). */
export type AssistantIntent = MortalityIntent;

export type ParsedIntent = AssistantIntent | null;

/** A parser turns free text (voice transcript or typed) into an intent. Pure,
 * synchronous, no I/O — trivially testable and offline. */
export interface IntentParser {
  parse(text: string, ctx: ParseContext): ParsedIntent;
}

export interface ConfirmationLine {
  label: string;
  value: string;
}

/** Everything needed to render AND read aloud a confirmation card, computed
 * without any network call. */
export interface ConfirmationDraft {
  intent: AssistantIntent;
  title: string;
  lines: ConfirmationLine[];
  /** Sentence read aloud when the card appears (TTS). */
  speech: string;
}
