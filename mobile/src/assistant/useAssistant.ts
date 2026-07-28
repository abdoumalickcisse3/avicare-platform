/**
 * Assistant orchestrator (Phase 1). Pipeline: free text → intent (rules
 * parser) → confirmation draft (computed offline) → on confirm, the existing
 * offline queue. Handles the two clarifications a mortality entry can need: an
 * unrecognized phrase, and an ambiguous lot.
 */
import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { useListProductionUnitsQuery } from '@/store/api/productionUnitsApi';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';
import { enqueueFieldMutation } from '@/field/enqueueMutation';
import { formatNumber } from '@/lib/format';
import { mortalityParser } from './parsers/mortalityParser';
import { toMutation } from './intentRegistry';
import type { AssistantUnit, ConfirmationDraft, MortalityIntent } from './types';

interface UnitChoice {
  intent: MortalityIntent;
  units: AssistantUnit[];
}

function buildMortalityDraft(intent: MortalityIntent, unit: AssistantUnit | undefined): ConfirmationDraft {
  const after = unit ? Math.max(0, unit.currentCount - intent.count) : null;
  const lines = [
    { label: 'Sujets morts', value: formatNumber(intent.count) },
    { label: 'Lot', value: unit?.name ?? '—' },
  ];
  if (after !== null) lines.push({ label: 'Effectif après', value: formatNumber(after) });
  if (intent.reason) lines.push({ label: 'Motif', value: intent.reason });

  const speech = unit
    ? `Mortalité de ${intent.count} sujets sur le lot ${unit.name}. Effectif après : ${after}. Confirmer ?`
    : `Mortalité de ${intent.count} sujets. Confirmer ?`;

  return { intent, title: 'Mortalité', lines, speech };
}

export interface Assistant {
  draft: ConfirmationDraft | null;
  /** A clarification/error message to show and read aloud, or null. */
  message: string | null;
  /** Set when the lot is ambiguous and must be chosen. */
  unitChoice: UnitChoice | null;
  submit: (text: string) => void;
  chooseUnit: (unitId: number) => void;
  confirm: () => void;
  cancel: () => void;
}

export function useAssistant({ unitId }: { unitId?: number | null } = {}): Assistant {
  const farmId = useSelector(selectSelectedFarmId);
  const { data: units } = useListProductionUnitsQuery(farmId ?? skipToken);

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

  function reset() {
    setDraft(null);
    setMessage(null);
    setUnitChoice(null);
  }

  function finalize(intent: MortalityIntent) {
    const unit = activeUnits.find((u) => u.id === intent.unitId);
    setDraft(buildMortalityDraft(intent, unit));
    setMessage(null);
    setUnitChoice(null);
  }

  function submit(text: string) {
    const intent = mortalityParser.parse(text, { unitId, activeUnits });
    if (!intent) {
      setDraft(null);
      setUnitChoice(null);
      setMessage("Je n'ai pas compris. Dites par exemple : « dix sont morts ».");
      return;
    }
    if (intent.unitId == null) {
      // Ambiguous lot — ask which one.
      setDraft(null);
      setMessage('Sur quel lot ?');
      setUnitChoice({ intent, units: activeUnits });
      return;
    }
    finalize(intent);
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

  return { draft, message, unitChoice, submit, chooseUnit, confirm, cancel: reset };
}
