"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Fab } from "@mui/material";
import { Plus } from "lucide-react";
import { useCommercialGating } from "@/hooks/useCommercialGating";
import { QuickSaleDialog } from "./QuickSaleDialog";

/**
 * Global "Vente directe" action for the commercial area (Sprint B5-6b) — a
 * floating button always within thumb's reach, since recording a cash sale is the
 * farmer's most frequent action. Shown only when the farm has the commercial
 * module; the backend stays the real guard.
 */
export function CommercialFab() {
  const { farmId, hasFarm, hasCommercial } = useCommercialGating();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  if (!hasFarm || !hasCommercial) return null;
  // Hidden on the print/PDF pages — the invoice must stand alone, no app chrome.
  if (pathname?.endsWith("/imprimer")) return null;

  return (
    <>
      <Fab
        color="primary"
        variant="extended"
        onClick={() => setOpen(true)}
        sx={{ position: "fixed", bottom: 24, right: 24, zIndex: (t) => t.zIndex.speedDial, gap: 1 }}
      >
        <Plus size={20} />
        Vente directe
      </Fab>
      {farmId && (
        <QuickSaleDialog open={open} onClose={() => setOpen(false)} farmId={farmId} />
      )}
    </>
  );
}
