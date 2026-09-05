"use client";

import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import { EyeOff } from "lucide-react";
import { useGetNetworkFarmQuery } from "@/store/api/partnerApi";
import type { NetworkFarmRow, RiskLevel } from "@/types";

const RISK: Record<RiskLevel, { label: string; color: "success" | "warning" | "error" }> = {
  OK: { label: "À jour", color: "success" },
  WATCH: { label: "À surveiller", color: "warning" },
  AT_RISK: { label: "À risque", color: "error" },
};

/**
 * One farm of the network, asked for at the moment it is opened.
 *
 * <p>The table is a snapshot from page load, and a partner about to call a farmer should see where
 * the farm stands now. The dialog also does what a table of dashes cannot: it says <b>why</b> a
 * figure is absent. A missing metric is never "zero" or "unknown" — it means the farmer has not
 * shared that scope, which is the whole trust boundary of the portal, and a partner who reads a
 * dash as "nothing happened" will call the wrong farmer.
 */
export function NetworkFarmDialog({
  farm,
  onClose,
}: {
  farm: NetworkFarmRow | null;
  onClose: () => void;
}) {
  const { data, isFetching, isError } = useGetNetworkFarmQuery(farm?.farmId ?? 0, {
    skip: farm === null,
  });
  // Fall back to the row while the fresh figures are in flight, so the dialog opens with content.
  const shown = data ?? farm;

  return (
    <Dialog open={farm !== null} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 700 }}>{shown?.farmName ?? "Ferme"}</DialogTitle>
      <DialogContent dividers>
        {isError && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Chiffres non rafraîchis — ceux-ci datent du chargement de la page.
          </Alert>
        )}
        {isFetching && (
          <Stack direction="row" sx={{ gap: 1, alignItems: "center", mb: 2 }}>
            <CircularProgress size={14} />
            <Typography variant="caption" color="text.secondary">
              Mise à jour…
            </Typography>
          </Stack>
        )}

        <Stack spacing={2}>
          <Field label="Suivi">
            {shown?.riskLevel == null ? (
              <NotShared what="son activité" />
            ) : (
              <Chip
                size="small"
                variant="outlined"
                color={RISK[shown.riskLevel].color}
                label={RISK[shown.riskLevel].label}
              />
            )}
          </Field>

          <Field label="Statut">
            {shown?.active == null ? (
              <NotShared what="son activité" />
            ) : (
              <Chip
                size="small"
                color={shown.active ? "success" : "default"}
                label={shown.active ? "Actif" : "Inactif"}
              />
            )}
          </Field>

          <Field label="Aliment consommé">
            {shown?.feedKg == null ? (
              <NotShared what="sa consommation d'aliment" />
            ) : (
              <Typography sx={{ fontWeight: 600 }}>
                {shown.feedKg.toLocaleString("fr-FR")} kg
              </Typography>
            )}
          </Field>

          <Field label="Mortalité">
            {shown?.mortalityRate == null ? (
              <NotShared what="la santé de son cheptel" />
            ) : (
              <Typography sx={{ fontWeight: 600 }}>
                {shown.mortalityRate.toFixed(1)} %
              </Typography>
            )}
          </Field>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Fermer</Button>
      </DialogActions>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
        {label}
      </Typography>
      {children}
    </Box>
  );
}

/** An absent figure is a choice of the farmer's, not a gap in the data. Say so. */
function NotShared({ what }: { what: string }) {
  return (
    <Stack direction="row" sx={{ gap: 0.75, alignItems: "center" }}>
      <EyeOff size={14} />
      <Typography variant="body2" color="text.secondary">
        Cette ferme ne partage pas {what}.
      </Typography>
    </Stack>
  );
}
