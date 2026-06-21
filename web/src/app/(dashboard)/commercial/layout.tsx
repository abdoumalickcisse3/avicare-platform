import { CommercialFab } from "@/components/commercial/CommercialFab";

/**
 * Commercial area layout: renders the section pages plus the global "Vente
 * directe" floating action (B5-6b), so the quick-sale flow is reachable from any
 * commercial screen.
 */
export default function CommercialLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <CommercialFab />
    </>
  );
}
