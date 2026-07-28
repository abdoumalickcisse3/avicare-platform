/**
 * Uniform confirmation-card builder for every intent — used by BOTH paths (the
 * local rules parser and the backend LLM). The AI only extracts the intent; the
 * mobile builds the card the same way regardless of source. Everything here is
 * computed offline from the intent + the already-loaded units.
 */
import { formatNumber } from '@/lib/format';
import type { AssistantIntent, AssistantUnit, ConfirmationDraft } from './types';

const TITLES: Record<AssistantIntent['kind'], string> = {
  MORTALITY: 'Mortalité',
  DAILY_RECORD: 'Saisie journalière',
  WEIGHING: 'Pesée',
  EGG_COLLECTION: "Collecte d'œufs",
};

function avg(nums: number[]): number {
  return nums.length ? Math.round(nums.reduce((s, n) => s + n, 0) / nums.length) : 0;
}

export function buildConfirmation(intent: AssistantIntent, units: AssistantUnit[]): ConfirmationDraft {
  const unit = units.find((u) => u.id === intent.unitId);
  const lotName = unit?.name ?? '—';
  const lines: ConfirmationDraft['lines'] = [];
  let speech = '';

  switch (intent.kind) {
    case 'MORTALITY': {
      const after = unit ? Math.max(0, unit.currentCount - intent.count) : null;
      lines.push({ label: 'Sujets morts', value: formatNumber(intent.count) });
      lines.push({ label: 'Lot', value: lotName });
      if (after !== null) lines.push({ label: 'Effectif après', value: formatNumber(after) });
      if (intent.reason) lines.push({ label: 'Motif', value: intent.reason });
      speech = `Mortalité de ${intent.count} sujets sur le lot ${lotName}.${after !== null ? ` Effectif après : ${after}.` : ''} Confirmer ?`;
      break;
    }
    case 'DAILY_RECORD': {
      lines.push({ label: 'Mortalité', value: formatNumber(intent.mortalityCount) });
      if (intent.feedKg != null) lines.push({ label: 'Aliment', value: `${formatNumber(intent.feedKg)} kg` });
      if (intent.waterL != null) lines.push({ label: 'Eau', value: `${formatNumber(intent.waterL)} L` });
      lines.push({ label: 'Lot', value: lotName });
      speech = `Saisie journalière sur le lot ${lotName} : ${intent.mortalityCount} morts. Confirmer ?`;
      break;
    }
    case 'WEIGHING': {
      lines.push({ label: 'Pesées', value: formatNumber(intent.weights.length) });
      lines.push({ label: 'Moyenne', value: `${formatNumber(avg(intent.weights))} g` });
      lines.push({ label: 'Lot', value: lotName });
      speech = `Pesée de ${intent.weights.length} sujets, moyenne ${avg(intent.weights)} grammes, sur le lot ${lotName}. Confirmer ?`;
      break;
    }
    case 'EGG_COLLECTION': {
      lines.push({ label: 'Œufs', value: formatNumber(intent.totalEggs) });
      if (intent.brokenEggs != null) lines.push({ label: 'Cassés', value: formatNumber(intent.brokenEggs) });
      lines.push({ label: 'Créneau', value: intent.timeslotKey });
      lines.push({ label: 'Lot', value: lotName });
      speech = `Collecte de ${intent.totalEggs} œufs sur le lot ${lotName}. Confirmer ?`;
      break;
    }
  }

  return { intent, title: TITLES[intent.kind], lines, speech };
}
