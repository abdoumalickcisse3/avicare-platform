import { SupplierLedgerView } from "@/components/inventory/SupplierLedgerView";

/**
 * Fiche fournisseur — compte-courant. En Next 16 `params` est une Promise ; on l'attend dans ce
 * composant serveur et on passe l'identifiant à la vue client qui possède le chargement.
 */
export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SupplierLedgerView supplierId={Number(id)} />;
}
