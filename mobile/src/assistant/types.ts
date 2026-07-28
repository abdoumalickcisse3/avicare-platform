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

/** `unitId === null` means the lot still has to be chosen before confirmation. */
export interface MortalityIntent {
  kind: 'MORTALITY';
  count: number;
  reason?: string;
  unitId: number | null;
}

/** Broiler daily entry (feed/water/mortality/observations). */
export interface DailyRecordIntent {
  kind: 'DAILY_RECORD';
  mortalityCount: number;
  feedKg?: number;
  waterL?: number;
  observations?: string;
  unitId: number | null;
}

/** A weighing sample (individual weights in grams). */
export interface WeighingIntent {
  kind: 'WEIGHING';
  weights: number[];
  notes?: string;
  unitId: number | null;
}

/** An egg collection for a timeslot. */
export interface EggCollectionIntent {
  kind: 'EGG_COLLECTION';
  totalEggs: number;
  brokenEggs?: number;
  timeslotKey: string;
  unitId: number | null;
}

/** Union of supported intents (Phase 2: the four field actions). */
export type AssistantIntent = MortalityIntent | DailyRecordIntent | WeighingIntent | EggCollectionIntent;

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
