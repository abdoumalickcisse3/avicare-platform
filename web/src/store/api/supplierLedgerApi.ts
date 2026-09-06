import { baseApi } from "./baseApi";
import type { SupplierBalance, SupplierStatement } from "@/types";

/** Backend wraps every payload in { data, meta }; unwrap to the data field. */
interface ApiEnvelope<T> {
  data: T;
}

const base = (farmId: number) => `/api/v1/farms/${farmId}/inventory/suppliers`;

interface LedgerEntryBody {
  amountXof: number;
  entryDate: string;
  label?: string;
  method?: string;
  reference?: string;
  /**
   * Absent est lu comme vrai côté serveur (`Object.notify()` étant final, le DTO ne peut pas
   * s'appeler `notify`). Un paiement doit donc toujours l'envoyer explicitement.
   */
  notifySupplier?: boolean;
}

/**
 * Le compte-courant fournisseur — ce que la ferme doit, ce qu'elle a payé.
 *
 * <p>Une écriture ici ne crée jamais de dépense côté serveur : la charge est enregistrée à la
 * réception du bon d'achat. Mais elle change la trésorerie, donc le tableau de bord et les soldes
 * sont invalidés.
 */
export const supplierLedgerApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getSupplierBalances: build.query<SupplierBalance[], { farmId: number }>({
      query: ({ farmId }) => `${base(farmId)}/balances`,
      transformResponse: (r: ApiEnvelope<SupplierBalance[]>) => r.data,
      providesTags: [{ type: "Supplier", id: "balances" }],
    }),
    getSupplierLedger: build.query<
      SupplierStatement,
      { farmId: number; supplierId: number }
    >({
      query: ({ farmId, supplierId }) => `${base(farmId)}/${supplierId}/ledger`,
      transformResponse: (r: ApiEnvelope<SupplierStatement>) => r.data,
      providesTags: (_r, _e, { supplierId }) => [
        { type: "Supplier", id: `ledger-${supplierId}` },
      ],
    }),
    recordSupplierPayment: build.mutation<
      number,
      { farmId: number; supplierId: number; body: LedgerEntryBody }
    >({
      query: ({ farmId, supplierId, body }) => ({
        url: `${base(farmId)}/${supplierId}/ledger/payments`,
        method: "POST",
        body,
      }),
      transformResponse: (r: ApiEnvelope<number>) => r.data,
      invalidatesTags: (_r, _e, { supplierId }) => [
        { type: "Supplier", id: `ledger-${supplierId}` },
        { type: "Supplier", id: "balances" },
      ],
    }),
    recordSupplierCharge: build.mutation<
      number,
      { farmId: number; supplierId: number; body: LedgerEntryBody }
    >({
      query: ({ farmId, supplierId, body }) => ({
        url: `${base(farmId)}/${supplierId}/ledger/charges`,
        method: "POST",
        body,
      }),
      transformResponse: (r: ApiEnvelope<number>) => r.data,
      invalidatesTags: (_r, _e, { supplierId }) => [
        { type: "Supplier", id: `ledger-${supplierId}` },
        { type: "Supplier", id: "balances" },
      ],
    }),
    deleteLedgerEntry: build.mutation<
      void,
      { farmId: number; supplierId: number; entryId: number }
    >({
      query: ({ farmId, supplierId, entryId }) => ({
        url: `${base(farmId)}/${supplierId}/ledger/entries/${entryId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { supplierId }) => [
        { type: "Supplier", id: `ledger-${supplierId}` },
        { type: "Supplier", id: "balances" },
      ],
    }),
  }),
});

export const {
  useGetSupplierBalancesQuery,
  useGetSupplierLedgerQuery,
  useRecordSupplierPaymentMutation,
  useRecordSupplierChargeMutation,
  useDeleteLedgerEntryMutation,
} = supplierLedgerApi;
