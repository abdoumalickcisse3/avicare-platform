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
import { useGetVaccinesQuery } from '@/store/api/healthApi';
import { useGetStockItemsQuery } from '@/store/api/inventoryStockApi';
import { useInterpretMutation } from '@/store/api/assistantApi';
import { useRecordPaymentMutation } from '@/store/api/paymentsApi';
import { useCreateSaleMutation } from '@/store/api/salesApi';
import { useCreatePurchaseOrderMutation } from '@/store/api/purchaseOrdersApi';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';
import { enqueueFieldMutation } from '@/field/enqueueMutation';
import type { ArticleSource, PaymentMethod, ProductType } from '@/types';
import { rulesParse } from './parsers';
import { intentFromInterpret } from './llm/fromInterpret';
import { buildConfirmation } from './drafts';
import { toMutation } from './intentRegistry';
import {
  isLotBased,
  isOnline,
  type AssistantIntent,
  type AssistantUnit,
  type ConfirmationDraft,
  type LotBasedIntent,
} from './types';

interface UnitChoice {
  intent: LotBasedIntent;
  units: AssistantUnit[];
}

export interface Assistant {
  draft: ConfirmationDraft | null;
  message: string | null;
  /** A read-only answer to a question (no confirmation) — from the backend loop. */
  answer: string | null;
  unitChoice: UnitChoice | null;
  /** True while the backend LLM is being queried. */
  thinking: boolean;
  /** True while an online action (e.g. payment) is being submitted. */
  submitting: boolean;
  submit: (text: string) => Promise<void>;
  chooseUnit: (unitId: number) => void;
  /** Confirms the current draft. Resolves true when the sheet should close
   * (offline entry enqueued, or online mutation succeeded), false on failure. */
  confirm: () => Promise<boolean>;
  cancel: () => void;
}

export function useAssistant({ unitId }: { unitId?: number | null } = {}): Assistant {
  const farmId = useSelector(selectSelectedFarmId);
  const { data: units } = useListProductionUnitsQuery(farmId ?? skipToken);
  // Served from the RTK Query cache offline; empty until the farmer has opened a health screen
  // once, in which case the vaccination parser simply declines and the LLM takes over.
  const { data: vaccines } = useGetVaccinesQuery(farmId ? { farmId } : skipToken);
  const { data: stockItems } = useGetStockItemsQuery(farmId ? { farmId } : skipToken);
  const [interpret] = useInterpretMutation();
  const [recordPayment] = useRecordPaymentMutation();
  const [createSale] = useCreateSaleMutation();
  const [createPurchaseOrder] = useCreatePurchaseOrderMutation();

  const activeUnits = useMemo<AssistantUnit[]>(
    () =>
      (units ?? [])
        .filter((u) => u.status === 'ACTIVE')
        .map((u) => ({ id: u.id, name: u.name || `Lot #${u.id}`, currentCount: u.currentCount })),
    [units],
  );

  const [draft, setDraft] = useState<ConfirmationDraft | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [unitChoice, setUnitChoice] = useState<UnitChoice | null>(null);
  const [thinking, setThinking] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setDraft(null);
    setMessage(null);
    setAnswer(null);
    setUnitChoice(null);
    setThinking(false);
    setSubmitting(false);
  }

  /** Turn a resolved intent into either a lot question or a confirmation card.
   * Lot-less intents (e.g. client creation) skip the lot choice. */
  function finalize(intent: AssistantIntent) {
    if (isLotBased(intent) && intent.unitId == null) {
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
    setAnswer(null);
    setUnitChoice(null);

    // 1) On-device rules — offline, free, covers the common phrases.
    const local = rulesParse(text, { unitId, activeUnits, vaccines, stockItems });
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
      if (resp.kind === 'ANSWER') {
        setAnswer(resp.message ?? '');
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

  /** Submit an online intent against its live mutation; throws on failure. */
  async function submitOnline(intent: AssistantIntent, farm: number): Promise<void> {
    if (intent.kind === 'RECORD_PAYMENT') {
      await recordPayment({
        farmId: farm,
        body: {
          invoiceId: intent.invoiceId,
          amountXof: intent.amountXof,
          method: (intent.method as PaymentMethod | undefined) ?? 'CASH',
        },
      }).unwrap();
      return;
    }
    if (intent.kind === 'QUICK_SALE') {
      const broiler = intent.productType === 'BROILER';
      await createSale({
        farmId: farm,
        body: {
          clientId: null, // walk-in cash sale
          lines: [
            {
              articleKey: intent.productType,
              articleSource: 'PRODUCTION' as ArticleSource,
              quantity: intent.quantity,
              unitPriceXof: intent.unitPriceXof as number,
              productType: intent.productType as ProductType,
              ...(broiler ? { productionUnitId: intent.unitId as number } : {}),
            },
          ],
        },
      }).unwrap();
      return;
    }
    if (intent.kind === 'PURCHASE') {
      await createPurchaseOrder({
        farmId: farm,
        body: {
          supplierId: intent.supplierId,
          lines: [
            {
              articleKey: intent.articleKey,
              articleSource: intent.articleSource as ArticleSource,
              orderedQuantity: intent.quantity,
              unitPriceXof: intent.unitPriceXof as number,
            },
          ],
        },
      }).unwrap();
      return;
    }
    throw new Error(`unsupported online intent: ${intent.kind}`);
  }

  /** A blocking precondition for an online intent (missing required input), or null. */
  function onlineBlocker(intent: AssistantIntent): string | null {
    if ((intent.kind === 'QUICK_SALE' || intent.kind === 'PURCHASE') && intent.unitPriceXof == null) {
      return 'Précisez le prix unitaire.';
    }
    if (intent.kind === 'QUICK_SALE' && intent.productType === 'BROILER' && intent.unitId == null) {
      return 'De quel lot vendez-vous ?';
    }
    return null;
  }

  async function confirm(): Promise<boolean> {
    if (!draft || farmId == null) return false;
    const intent = draft.intent;

    if (isOnline(intent)) {
      const blocker = onlineBlocker(intent);
      if (blocker) {
        setMessage(blocker);
        return false;
      }
      setSubmitting(true);
      setMessage(null);
      try {
        await submitOnline(intent, farmId);
        reset();
        return true;
      } catch {
        setSubmitting(false);
        setMessage("Échec de l'enregistrement. Réessayez.");
        return false;
      }
    }

    // Offline field queue.
    const mutation = toMutation(intent, farmId);
    if (!mutation) return false;
    enqueueFieldMutation(mutation);
    reset();
    return true;
  }

  return {
    draft,
    message,
    answer,
    unitChoice,
    thinking,
    submitting,
    submit,
    chooseUnit,
    confirm,
    cancel: reset,
  };
}
