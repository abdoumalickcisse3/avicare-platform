/**
 * Uniform confirmation-card builder for every intent — used by BOTH paths (the
 * local rules parser and the backend LLM). The AI only extracts the intent; the
 * mobile builds the card the same way regardless of source. Everything here is
 * computed offline from the intent + the already-loaded units.
 */
import { formatNumber } from '@/lib/format';
import { isLotBased, type AssistantIntent, type AssistantUnit, type ConfirmationDraft } from './types';

const TITLES: Record<AssistantIntent['kind'], string> = {
  MORTALITY: 'Mortalité',
  DAILY_RECORD: 'Saisie journalière',
  WEIGHING: 'Pesée',
  EGG_COLLECTION: "Collecte d'œufs",
  VACCINATION: 'Vaccination',
  HEALTH_OBSERVATION: 'Observation santé',
  CREATE_CLIENT: 'Nouveau client',
  ADJUST_STOCK: 'Ajustement stock',
  RECORD_PAYMENT: 'Encaissement',
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'espèces',
  MOBILE_MONEY: 'mobile money',
  BANK_TRANSFER: 'virement',
};

const SEVERITY_LABELS: Record<string, string> = {
  NORMAL: 'normale',
  WARNING: 'à surveiller',
  CRITICAL: 'critique',
};

const CLIENT_TYPE_LABELS: Record<string, string> = {
  INDIVIDUAL: 'particulier',
  BUSINESS: 'entreprise',
  WHOLESALER: 'grossiste',
};

function avg(nums: number[]): number {
  return nums.length ? Math.round(nums.reduce((s, n) => s + n, 0) / nums.length) : 0;
}

export function buildConfirmation(intent: AssistantIntent, units: AssistantUnit[]): ConfirmationDraft {
  const unit = isLotBased(intent) ? units.find((u) => u.id === intent.unitId) : undefined;
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
    case 'VACCINATION': {
      lines.push({ label: 'Vaccin', value: intent.vaccineLabel });
      lines.push({ label: 'Sujets', value: formatNumber(intent.subjectsCount) });
      lines.push({ label: 'Lot', value: lotName });
      speech = `Vaccination du lot ${lotName} avec ${intent.vaccineLabel}, ${intent.subjectsCount} sujets. Confirmer ?`;
      break;
    }
    case 'HEALTH_OBSERVATION': {
      lines.push({ label: 'Observation', value: intent.title });
      if (intent.severity) lines.push({ label: 'Gravité', value: SEVERITY_LABELS[intent.severity] ?? intent.severity });
      if (intent.suspectedDisease) lines.push({ label: 'Suspicion', value: intent.suspectedDisease });
      lines.push({ label: 'Lot', value: lotName });
      speech = `Observation sur le lot ${lotName} : ${intent.title}. Confirmer ?`;
      break;
    }
    case 'CREATE_CLIENT': {
      lines.push({ label: 'Client', value: intent.displayName });
      lines.push({ label: 'Type', value: CLIENT_TYPE_LABELS[intent.clientType] ?? intent.clientType });
      speech = `Nouveau client : ${intent.displayName}. Confirmer ?`;
      break;
    }
    case 'ADJUST_STOCK': {
      const unit = intent.unit ? ` ${intent.unit}` : '';
      const sign = intent.delta >= 0 ? '+' : '−';
      const move = `${sign}${formatNumber(Math.abs(intent.delta))}${unit}`;
      lines.push({ label: 'Article', value: intent.articleKey });
      lines.push({ label: 'Mouvement', value: move });
      if (intent.before != null && intent.after != null) {
        lines.push({ label: 'Stock', value: `${formatNumber(intent.before)} → ${formatNumber(intent.after)}${unit}` });
      }
      const verb = intent.delta >= 0 ? 'Réception' : 'Sortie';
      speech = `${verb} de ${Math.abs(intent.delta)}${unit} de ${intent.articleKey}. Confirmer ?`;
      break;
    }
    case 'RECORD_PAYMENT': {
      lines.push({ label: 'Montant', value: `${formatNumber(intent.amountXof)} F CFA` });
      if (intent.clientName) lines.push({ label: 'Client', value: intent.clientName });
      if (intent.invoiceNumber) lines.push({ label: 'Facture', value: intent.invoiceNumber });
      if (intent.method) lines.push({ label: 'Moyen', value: PAYMENT_METHOD_LABELS[intent.method] ?? intent.method });
      const who = intent.clientName ? ` de ${intent.clientName}` : '';
      speech = `Encaissement de ${intent.amountXof} francs${who}. Confirmer ?`;
      break;
    }
  }

  return { intent, title: TITLES[intent.kind], lines, speech };
}
