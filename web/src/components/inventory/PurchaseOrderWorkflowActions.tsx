"use client";

import { Button, Stack } from "@mui/material";
import { Ban, PackageCheck, Send } from "lucide-react";
import type { PurchaseOrderStatus } from "@/types";

/**
 * State-conditional workflow buttons for a purchase order (Sprint B4-7).
 * DRAFT → submit; SENT → receive / cancel; DRAFT → cancel. RECEIVED/CANCELLED
 * are terminal (no actions). The parent owns the mutations and dialogs.
 */
export function PurchaseOrderWorkflowActions({
  status,
  onSubmit,
  onReceive,
  onCancel,
  busy,
}: {
  status: PurchaseOrderStatus;
  onSubmit: () => void;
  onReceive: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  if (status === "RECEIVED" || status === "CANCELLED") return null;

  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
      {status === "DRAFT" && (
        <Button
          variant="contained"
          color="primary"
          startIcon={<Send size={18} />}
          onClick={onSubmit}
          disabled={busy}
        >
          Envoyer au fournisseur
        </Button>
      )}
      {status === "SENT" && (
        <Button
          variant="contained"
          color="primary"
          startIcon={<PackageCheck size={18} />}
          onClick={onReceive}
          disabled={busy}
        >
          Réceptionner
        </Button>
      )}
      <Button
        variant="outlined"
        color="error"
        startIcon={<Ban size={18} />}
        onClick={onCancel}
        disabled={busy}
      >
        Annuler le bon
      </Button>
    </Stack>
  );
}
