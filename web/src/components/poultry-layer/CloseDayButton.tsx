"use client";

import { CircularProgress } from "@mui/material";
import { Button } from "@mui/material";
import { Lock } from "lucide-react";
import { useCloseDayMutation } from "@/store/api/eggProductionApi";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
import { isFeatureForbidden } from "@/lib/poultry";

/**
 * Closes the current day's production for a unit (recompute aggregate from
 * collections). Reserved for MANAGER/OWNER server-side; a 403 surfaces as a
 * clear "réservé aux gérants" toast rather than a generic error.
 */
export function CloseDayButton({
  farmId,
  unitId,
}: {
  farmId: number;
  unitId: number;
}) {
  const { showToast } = useToast();
  const [closeDay, { isLoading }] = useCloseDayMutation();

  const onClose = async () => {
    try {
      await closeDay({ farmId, unitId }).unwrap();
      showToast("Journée clôturée — agrégat recalculé.", "success");
    } catch (err) {
      showToast(
        isFeatureForbidden(err)
          ? "Action réservée aux gérants et propriétaires."
          : apiErrorMessage(err),
        "error",
      );
    }
  };

  return (
    <Button
      variant="outlined"
      color="primary"
      onClick={onClose}
      disabled={isLoading}
      startIcon={
        isLoading ? <CircularProgress size={16} color="inherit" /> : <Lock size={18} />
      }
    >
      Clôturer la journée
    </Button>
  );
}
