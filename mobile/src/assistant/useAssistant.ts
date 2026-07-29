/**
 * Assistant orchestrator (Phase 2, hybrid). Pipeline:
 *   text → on-device rules (offline, free) → if understood, confirm.
 *        → else, online → backend `/assistant/interpret` (LLM + dry-run) → draft
 *          or clarification; offline → ask to retry online.
 * The card is built uniformly from the intent (see `buildConfirmation`), so the
 * rules path and the LLM path look identical. On confirm, the entry goes through
 * the existing offline queue.
 */
import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { useListProductionUnitsQuery } from '@/store/api/productionUnitsApi';
import { useInterpretMutation } from '@/store/api/assistantApi';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';
import { enqueueFieldMutation } from '@/field/enqueueMutation';
import { rulesParse } from './parsers';
import { intentFromInterpret } from './llm/fromInterpret';
import { buildConfirmation } from './drafts';
import { toMutation } from './intentRegistry';
import type { AssistantIntent, AssistantUnit, ConfirmationDraft } from './types';

interface UnitChoice {
  intent: AssistantIntent;
  units: AssistantUnit[];
}

export interface Assistant {
  draft: ConfirmationDraft | null;
  message: string | null;
  unitChoice: UnitChoice | null;
  /** True while the backend LLM is being queried. */
  thinking: boolean;
  submit: (text: string) => Promise<void>;
  chooseUnit: (unitId: number) => void;
  confirm: () => void;
  cancel: () => void;
}

export function useAssistant({ unitId }: { unitId?: number | null } = {}): Assistant {
  const farmId = useSelector(selectSelectedFarmId);
  const { data: units } = useListProductionUnitsQuery(farmId ?? skipToken);
  const [interpret] = useInterpretMutation();

  const activeUnits = useMemo<AssistantUnit[]>(
    () =>
      (units ?? [])
        .filter((u) => u.status === 'ACTIVE')
        .map((u) => ({ id: u.id, name: u.name || `Lot #${u.id}`, currentCount: u.currentCount })),
    [units],
  );

  const [draft, setDraft] = useState<ConfirmationDraft | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [unitChoice, setUnitChoice] = useState<UnitChoice | null>(null);
  const [thinking, setThinking] = useState(false);

  function reset() {
    setDraft(null);
    setMessage(null);
    setUnitChoice(null);
    setThinking(false);
  }

  /** Turn a resolved intent into either a lot question or a confirmation card. */
  function finalize(intent: AssistantIntent) {
    if (intent.unitId == null) {
      setDraft(null);
      setMessage('Sur quel lot ?');
      setUnitChoice({ intent, units: activeUnits });
      return;
    }
    setDraft(buildConfirmation(intent, activeUnits));
    setMessage(null);
    setUnitChoice(null);
  }

  async function submit(text: string) {
    setMessage(null);
    setUnitChoice(null);

    // 1) On-device rules — offline, free, covers the common phrases.
    const local = rulesParse(text, { unitId, activeUnits });
    if (local) {
      finalize(local);
      return;
    }

    // 2) Backend LLM fallback — only online.
    if (farmId == null) {
      setMessage("Je n'ai pas compris.");
      return;
    }
    setThinking(true);
    try {
      const resp = await interpret({ farmId, text, unitId }).unwrap();
      setThinking(false);
      if (resp.kind === 'CLARIFICATION') {
        setMessage(resp.message ?? "Je n'ai pas compris.");
        return;
      }
      const intent = intentFromInterpret(resp);
      if (!intent) {
        setMessage('Action non prise en charge pour le moment.');
        return;
      }
      finalize(intent);
    } catch {
      setThinking(false);
      setMessage('Serveur injoignable. Réessayez en ligne.');
    }
  }

  function chooseUnit(id: number) {
    if (!unitChoice) return;
    finalize({ ...unitChoice.intent, unitId: id });
  }

  function confirm() {
    if (!draft || farmId == null) return;
    const mutation = toMutation(draft.intent, farmId);
    if (!mutation) return;
    enqueueFieldMutation(mutation);
    reset();
  }

  return { draft, message, unitChoice, thinking, submit, chooseUnit, confirm, cancel: reset };
}
