"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CircularProgress,
  MenuItem,
  Select,
  Snackbar,
  Switch,
  Typography,
} from "@mui/material";
import { useSelectedFarm } from "@/hooks/useSelectedFarm";
import {
  useGetNotificationPreferencesQuery,
  useUpdateNotificationPreferencesMutation,
} from "@/store/api/notificationsApi";
import type {
  NotificationChannelKey,
  NotificationPreference,
  NotificationSeverity,
} from "@/types";
import { colors } from "@/theme/tokens";

/** FR labels for each notification category (backend enum → display). */
const CATEGORY_LABELS: Record<string, string> = {
  MORTALITY_ANOMALY: "Mortalité anormale",
  VACCINATION_LATE: "Vaccination en retard",
  WITHDRAWAL_ENDING: "Délai d'attente",
  CRITICAL_OBSERVATION: "Observation critique",
  LOW_STOCK: "Stock bas",
  NEGATIVE_STOCK: "Stock négatif",
  PO_OVERDUE: "Commande en retard",
  CREDIT_EXCEEDED: "Encours dépassé",
  INVOICE_OVERDUE: "Facture en retard",
};

const SEVERITIES: NotificationSeverity[] = ["INFO", "WARNING", "CRITICAL"];
const SEVERITY_LABELS: Record<NotificationSeverity, string> = {
  INFO: "Toutes",
  WARNING: "Importantes",
  CRITICAL: "Critiques",
};

const CHANNELS: { key: NotificationChannelKey; label: string }[] = [
  { key: "IN_APP", label: "Cloche" },
  { key: "WHATSAPP", label: "WhatsApp" },
];

function keyOf(category: string, channel: NotificationChannelKey) {
  return `${category}::${channel}`;
}

export default function NotificationPreferencesPage() {
  const { farmId } = useSelectedFarm();
  const { data, isLoading } = useGetNotificationPreferencesQuery(
    { farmId: farmId as number },
    { skip: !farmId },
  );
  const [update, { isLoading: isSaving }] = useUpdateNotificationPreferencesMutation();

  // Edit buffer keyed by category::channel, seeded edge-triggered when the grid loads.
  const [buffer, setBuffer] = useState<Record<string, NotificationPreference>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    const next: Record<string, NotificationPreference> = {};
    for (const p of data) next[keyOf(p.category, p.channel)] = { ...p };
    setBuffer(next);
  }, [data]);

  const categories = Array.from(new Set((data ?? []).map((p) => p.category)));

  const patch = (
    category: string,
    channel: NotificationChannelKey,
    change: Partial<NotificationPreference>,
  ) => {
    setBuffer((prev) => {
      const k = keyOf(category, channel);
      const base = prev[k] ?? { category, channel, enabled: false, minSeverity: "INFO" };
      return { ...prev, [k]: { ...base, ...change } };
    });
  };

  const save = async () => {
    if (!farmId) return;
    await update({ farmId, preferences: Object.values(buffer) }).unwrap();
    setSaved(true);
  };

  if (!farmId) {
    return <Alert severity="info">Sélectionnez une ferme pour gérer les notifications.</Alert>;
  }
  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Notifications
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Choisissez, par catégorie, les alertes reçues sur la cloche et par WhatsApp. Le WhatsApp
          utilise le numéro de votre profil.
        </Typography>
      </Box>

      <Card sx={{ overflowX: "auto" }}>
        <Box sx={{ minWidth: 620 }}>
          {/* Header row */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "1.4fr 1fr 1fr",
              px: 2,
              py: 1.5,
              borderBottom: `1px solid ${colors.neutral[200]}`,
              bgcolor: colors.neutral[50],
            }}
          >
            <Typography sx={{ fontWeight: 700, fontSize: "0.8rem" }}>Catégorie</Typography>
            {CHANNELS.map((c) => (
              <Typography key={c.key} sx={{ fontWeight: 700, fontSize: "0.8rem" }}>
                {c.label}
              </Typography>
            ))}
          </Box>

          {categories.map((category) => (
            <Box
              key={category}
              sx={{
                display: "grid",
                gridTemplateColumns: "1.4fr 1fr 1fr",
                alignItems: "center",
                px: 2,
                py: 1.25,
                borderBottom: `1px solid ${colors.neutral[100]}`,
              }}
            >
              <Typography sx={{ fontSize: "0.9rem", fontWeight: 600 }}>
                {CATEGORY_LABELS[category] ?? category}
              </Typography>
              {CHANNELS.map((c) => {
                const pref = buffer[keyOf(category, c.key)];
                const enabled = pref?.enabled ?? false;
                const minSeverity = pref?.minSeverity ?? "INFO";
                return (
                  <Box key={c.key} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Switch
                      checked={enabled}
                      onChange={(e) => patch(category, c.key, { enabled: e.target.checked })}
                      inputProps={{ "aria-label": `${category} ${c.key}` }}
                    />
                    <Select
                      size="small"
                      value={minSeverity}
                      disabled={!enabled}
                      onChange={(e) =>
                        patch(category, c.key, {
                          minSeverity: e.target.value as NotificationSeverity,
                        })
                      }
                      sx={{ minWidth: 120, fontSize: "0.8rem" }}
                    >
                      {SEVERITIES.map((s) => (
                        <MenuItem key={s} value={s} sx={{ fontSize: "0.8rem" }}>
                          {SEVERITY_LABELS[s]}
                        </MenuItem>
                      ))}
                    </Select>
                  </Box>
                );
              })}
            </Box>
          ))}
        </Box>
      </Card>

      <Box sx={{ mt: 3, display: "flex", justifyContent: "flex-end" }}>
        <Button variant="contained" onClick={save} disabled={isSaving}>
          {isSaving ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </Box>

      <Snackbar
        open={saved}
        autoHideDuration={3000}
        onClose={() => setSaved(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="success" onClose={() => setSaved(false)}>
          Préférences enregistrées
        </Alert>
      </Snackbar>
    </Box>
  );
}
