"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Card,
  CardContent,
  Chip,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { ChevronRight, Clock, Egg, Layers, Lock } from "lucide-react";
import {
  useGetGradesQuery,
  useGetTimeslotsQuery,
  useGetTraySettingsQuery,
} from "@/store/api/eggProductionApi";
import { useUpsertFarmSettingMutation } from "@/store/api/farmSettingsApi";
import { useSelectedFarm } from "@/hooks/useSelectedFarm";
import { canManageCatalog, useFarmRole } from "@/hooks/useFarmRole";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
import { isFeatureForbidden } from "@/lib/poultry";
import { sortGradeKeys, timeslotLabel } from "@/lib/layer";
import { formatNumber } from "@/lib/format";
import { colors } from "@/theme/tokens";

function valueString(value: Record<string, unknown>): string | null {
  const v = value?.value;
  return typeof v === "string" ? v : null;
}

const digits = (s: string) => s.replace(/[^\d]/g, "");

export default function LayerSettingsPage() {
  const { farmId, isLoading: farmLoading, hasFarm } = useSelectedFarm();

  const { data: timeslots, isLoading: tLoading, error: tError } = useGetTimeslotsQuery(
    { farmId: farmId as number },
    { skip: !hasFarm },
  );
  const { data: grades } = useGetGradesQuery(
    { farmId: farmId as number },
    { skip: !hasFarm },
  );
  const { data: traySettings } = useGetTraySettingsQuery(
    { farmId: farmId as number },
    { skip: !hasFarm },
  );

  // The backend restricts a farm setting to OWNER/MANAGER by role, not by permission.
  const role = useFarmRole(farmId);
  const canEditTrays = canManageCatalog(role);
  const [upsertSetting, { isLoading: saving }] = useUpsertFarmSettingMutation();
  const { showToast } = useToast();

  // null means "not being edited": the fields show the server value until someone types.
  const [size, setSize] = useState<string | null>(null);
  const [price, setPrice] = useState<string | null>(null);
  const sizeValue = size ?? (traySettings ? String(traySettings.traySize) : "");
  const priceValue = price ?? (traySettings ? String(traySettings.trayPriceXof) : "");
  const dirty =
    traySettings != null &&
    (sizeValue !== String(traySettings.traySize) ||
      priceValue !== String(traySettings.trayPriceXof));

  const saveTraySettings = async () => {
    if (!dirty || !farmId) return;
    try {
      // Two settings, two calls: the endpoint takes one key at a time.
      await upsertSetting({ farmId, key: "tray_size", value: sizeValue }).unwrap();
      await upsertSetting({ farmId, key: "tray_price_xof", value: priceValue }).unwrap();
      setSize(null);
      setPrice(null);
      showToast("Réglages plateaux enregistrés.", "success");
    } catch (e) {
      showToast(apiErrorMessage(e), "error");
    }
  };

  const featureLocked = isFeatureForbidden(tError);
  const sortedGrades = sortGradeKeys((grades ?? []).map((g) => g.key));

  return (
    <Box>
      <Breadcrumbs separator={<ChevronRight size={14} />} sx={{ mb: 1.5 }}>
        <Link
          href="/reglages"
          style={{ color: colors.neutral[500], textDecoration: "none" }}
        >
          Réglages
        </Link>
        <Typography variant="body2" color="text.primary">
          Ponte
        </Typography>
      </Breadcrumbs>

      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Paramètres ponte
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Créneaux de collecte, calibres d&apos;œufs et plateaux effectifs pour cette ferme.
        </Typography>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        Créneaux et calibres sont fixés par la plateforme et s&apos;affichent ici en lecture seule.
        {canEditTrays
          ? " Les plateaux appartiennent à la ferme et se modifient ci-dessous."
          : " Seuls le propriétaire et le gérant peuvent modifier les plateaux."}
      </Alert>

      {!hasFarm && !farmLoading && (
        <Alert severity="info">Créez d&apos;abord une ferme.</Alert>
      )}

      {featureLocked && hasFarm && (
        <Box
          sx={{
            textAlign: "center",
            py: 8,
            border: (t) => `1px dashed ${t.palette.divider}`,
            borderRadius: 3,
          }}
        >
          <Box sx={{ color: colors.neutral[400], mb: 1 }}>
            <Lock size={32} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Module Ponte non activé
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Activez le module pour consulter ces paramètres.
          </Typography>
          <Button
            component={Link}
            href={`/fermes/${farmId}`}
            variant="contained"
            color="primary"
          >
            Voir l&apos;abonnement
          </Button>
        </Box>
      )}

      {!featureLocked && tError && (
        <Alert severity="error">{apiErrorMessage(tError)}</Alert>
      )}

      {hasFarm && !featureLocked && (
        <Stack spacing={3}>
          <Card>
            <CardContent>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 2 }}>
                <Clock size={18} color={colors.primary[500]} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Créneaux de collecte
                </Typography>
              </Stack>
              {tLoading ? (
                <Skeleton variant="rectangular" height={72} sx={{ borderRadius: 2 }} />
              ) : (timeslots ?? []).length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Aucun créneau configuré.
                </Typography>
              ) : (
                <Box
                  sx={{
                    display: "grid",
                    gap: 1.5,
                    gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
                  }}
                >
                  {(timeslots ?? []).map((s) => (
                    <Box
                      key={s.key}
                      sx={{
                        bgcolor: colors.neutral[50],
                        border: `1px solid ${colors.neutral[200]}`,
                        borderRadius: 2,
                        px: 2,
                        py: 1.5,
                      }}
                    >
                      <Typography sx={{ fontWeight: 600 }}>
                        {timeslotLabel(s.key)}
                      </Typography>
                      {valueString(s.value) && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ fontFamily: "var(--font-mono)" }}
                        >
                          {valueString(s.value)}
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 2 }}>
                <Egg size={18} color={colors.accent[400]} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Calibres d&apos;œufs
                </Typography>
              </Stack>
              {sortedGrades.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Aucun calibre configuré.
                </Typography>
              ) : (
                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                  {sortedGrades.map((g) => (
                    <Chip
                      key={g}
                      label={g}
                      sx={{
                        fontWeight: 600,
                        bgcolor: colors.accent[50],
                        color: colors.accent[700],
                      }}
                    />
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 2 }}>
                <Layers size={18} color={colors.info.main} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Plateaux
                </Typography>
              </Stack>
              {canEditTrays ? (
                <>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <TextField
                      label="Taille d'un plateau"
                      value={sizeValue}
                      onChange={(e) => setSize(digits(e.target.value))}
                      disabled={!traySettings}
                      inputMode="numeric"
                      helperText="Nombre d'œufs par plateau"
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      label="Prix indicatif d'un plateau"
                      value={priceValue}
                      onChange={(e) => setPrice(digits(e.target.value))}
                      disabled={!traySettings}
                      inputMode="numeric"
                      helperText="En XOF — sert de prix par défaut à la vente"
                      sx={{ flex: 1 }}
                    />
                  </Stack>
                  <Stack direction="row" sx={{ justifyContent: "flex-end", mt: 2 }}>
                    <Button
                      variant="contained"
                      onClick={saveTraySettings}
                      disabled={!dirty || saving}
                    >
                      Enregistrer
                    </Button>
                  </Stack>
                </>
              ) : (
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <Box
                    sx={{
                      flex: 1,
                      bgcolor: colors.neutral[50],
                      border: `1px solid ${colors.neutral[200]}`,
                      borderRadius: 2,
                      px: 2,
                      py: 1.5,
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      Taille d&apos;un plateau
                    </Typography>
                    <Typography
                      sx={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "1.25rem" }}
                    >
                      {traySettings ? `${traySettings.traySize} œufs` : "—"}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      flex: 1,
                      bgcolor: colors.neutral[50],
                      border: `1px solid ${colors.neutral[200]}`,
                      borderRadius: 2,
                      px: 2,
                      py: 1.5,
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      Prix indicatif d&apos;un plateau
                    </Typography>
                    <Typography
                      sx={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "1.25rem" }}
                    >
                      {traySettings ? `${formatNumber(traySettings.trayPriceXof)} XOF` : "—"}
                    </Typography>
                  </Box>
                </Stack>
              )}
            </CardContent>
          </Card>
        </Stack>
      )}
    </Box>
  );
}
