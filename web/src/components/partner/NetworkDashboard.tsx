"use client";

import { useRouter } from "next/navigation";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { Handshake, LogOut } from "lucide-react";
import {
  useGetNetworkDashboardQuery,
  useGetNetworkFarmsQuery,
  useGetPartnerProfileQuery,
  usePartnerLogoutMutation,
} from "@/store/api/partnerApi";
import { partnerTokenStorage } from "@/lib/partnerStorage";
import NetworkAlerts from "./NetworkAlerts";
import type { PartnerProfile, RiskLevel } from "@/types";
import { colors } from "@/theme/tokens";

const TYPE_LABEL: Record<PartnerProfile["type"], string> = {
  FEED_SUPPLIER: "Provendier",
  VET: "Vétérinaire",
};

function fmt(n: number | null | undefined): string {
  return n == null ? "—" : n.toLocaleString("fr-FR");
}
function fmtPct(n: number | null | undefined): string {
  return n == null ? "—" : `${n.toFixed(1)} %`;
}

const RISK: Record<RiskLevel, { label: string; color: "success" | "warning" | "error" }> = {
  OK: { label: "À jour", color: "success" },
  WATCH: { label: "À surveiller", color: "warning" },
  AT_RISK: { label: "À risque", color: "error" },
};

/** Partner-portal read-only network view ("Voir"): profile header, KPI cards, per-farm table. */
export default function NetworkDashboard() {
  const router = useRouter();
  const { data: me } = useGetPartnerProfileQuery();
  const { data: dash, isLoading: dashLoading } = useGetNetworkDashboardQuery();
  const { data: farms = [] } = useGetNetworkFarmsQuery();
  const [logout] = usePartnerLogoutMutation();

  const onLogout = async () => {
    const refreshToken = partnerTokenStorage.getRefresh();
    if (refreshToken) await logout({ refreshToken }).catch(() => {});
    partnerTokenStorage.clear();
    router.replace("/portal/login");
  };

  const kpis = [
    { label: "Fermes", value: fmt(dash?.farmCount) },
    { label: "Fermes actives", value: fmt(dash?.activeFarmCount) },
    { label: "Aliment (kg)", value: fmt(dash?.totalFeedKg) },
    { label: "Mortalité moy.", value: fmtPct(dash?.avgMortalityRate) },
  ];

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto", px: { xs: 2, md: 3 }, py: { xs: 3, md: 4 } }}>
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 2 }}
      >
        <Stack direction="row" sx={{ alignItems: "center", gap: 1.5 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: colors.primary[50],
              color: colors.primary[600],
            }}
          >
            <Handshake size={22} />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {me?.name ?? "Mon réseau"}
            </Typography>
            {me?.type && <Chip size="small" label={TYPE_LABEL[me.type]} sx={{ mt: 0.5 }} />}
          </Box>
        </Stack>
        <Button variant="outlined" startIcon={<LogOut size={16} />} onClick={onLogout}>
          Déconnexion
        </Button>
      </Stack>

      <NetworkAlerts />

      <Box
        sx={{
          display: "grid",
          gap: { xs: 1.5, md: 2 },
          gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(4, 1fr)" },
          mb: 3,
        }}
      >
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                {k.label}
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>
                {dashLoading ? <CircularProgress size={18} /> : k.value}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5 }}>
            Fermes du réseau
          </Typography>
          {farms.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
              Aucune ferme dans votre réseau.
            </Typography>
          ) : (
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small" sx={{ minWidth: 640 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Ferme</TableCell>
                    <TableCell>Statut</TableCell>
                    <TableCell>Suivi</TableCell>
                    <TableCell align="right">Aliment (kg)</TableCell>
                    <TableCell align="right">Mortalité</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {farms.map((f) => (
                    <TableRow key={f.farmId}>
                      <TableCell sx={{ fontWeight: 600 }}>{f.farmName}</TableCell>
                      <TableCell>
                        {f.active == null ? (
                          "—"
                        ) : (
                          <Chip
                            size="small"
                            color={f.active ? "success" : "default"}
                            label={f.active ? "Actif" : "Inactif"}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        {f.riskLevel == null ? (
                          "—"
                        ) : (
                          <Chip
                            size="small"
                            variant="outlined"
                            color={RISK[f.riskLevel].color}
                            label={RISK[f.riskLevel].label}
                          />
                        )}
                      </TableCell>
                      <TableCell align="right">{fmt(f.feedKg)}</TableCell>
                      <TableCell align="right">{fmtPct(f.mortalityRate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
