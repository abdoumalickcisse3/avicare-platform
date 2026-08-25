"use client";

import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import { Download } from "lucide-react";
import { useGetRestockForecastQuery } from "@/store/api/partnerApi";
import { downloadCsv, toCsv } from "@/lib/csv";
import type { RestockForecastRow } from "@/types";

const HORIZON_DAYS = 30;

function fmtKg(n: number | null): string {
  return n == null ? "—" : `≥ ${n.toLocaleString("fr-FR")} kg`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function exportRows(rows: RestockForecastRow[]): void {
  const csv = toCsv(
    ["Ferme", "Bande", "Effectif", "Fin prévue", "Jours restants", "Aliment estimé (kg)", "Méthode"],
    rows.map((r) => [
      r.farmName,
      r.batchName,
      r.headcount,
      r.expectedEndDate,
      r.daysToEnd,
      r.estimatedFeedKg,
      r.forecastMethod === "GROWTH" ? "Croissance réelle" : "Âge théorique",
    ]),
  );
  downloadCsv(`recommandes-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}

/**
 * Upcoming restocks across the network (couche « Développer »): when each batch ends and how much
 * feed is still to deliver before then. Only farms that opted into the forecast scope appear — the
 * empty state says so, because a partner must not read a farmer's choice as a broken screen.
 */
export default function RestockForecast() {
  const { data } = useGetRestockForecastQuery({ horizonDays: HORIZON_DAYS });
  const rows = data?.rows ?? [];
  const summary = data?.summary;

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
            Aucun éleveur de votre réseau ne partage encore ses prévisions de recommande.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Stack spacing={3}>
      <Box
        sx={{
          display: "grid",
          gap: { xs: 1.5, md: 2 },
          gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(2, minmax(0, 260px))" },
        }}
      >
        <Card>
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              Tonnage à venir ({HORIZON_DAYS} j)
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>
              {fmtKg(summary?.estimatedFeedKg ?? null)}
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              Bandes concernées
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>
              {summary?.batchCount ?? 0}
            </Typography>
          </CardContent>
        </Card>
      </Box>

      <Card>
        <CardContent>
          <Stack
            direction="row"
            sx={{ justifyContent: "space-between", alignItems: "center", mb: 1.5, gap: 2 }}
          >
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Prochaines recommandes
            </Typography>
            <Button
              size="small"
              variant="outlined"
              startIcon={<Download size={16} />}
              onClick={() => exportRows(rows)}
            >
              Exporter (CSV)
            </Button>
          </Stack>

          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
            Estimation basse : elle extrapole la consommation observée, qui augmente avec l&apos;âge
            des animaux.
          </Typography>

          <Box sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 720 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Ferme</TableCell>
                  <TableCell>Bande</TableCell>
                  <TableCell align="right">Effectif</TableCell>
                  <TableCell>Fin prévue</TableCell>
                  <TableCell align="right">Jours</TableCell>
                  <TableCell align="right">Aliment estimé</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.unitId}>
                    <TableCell sx={{ fontWeight: 600 }}>{r.farmName}</TableCell>
                    <TableCell>{r.batchName ?? "—"}</TableCell>
                    <TableCell align="right">{r.headcount.toLocaleString("fr-FR")}</TableCell>
                    <TableCell>
                      <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
                        {fmtDate(r.expectedEndDate)}
                        {r.forecastMethod === "THEORETICAL" && (
                          <Tooltip title="Aucune pesée : date calculée sur l'âge cible, pas sur la croissance réelle.">
                            <Chip size="small" variant="outlined" label="théorique" />
                          </Tooltip>
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell align="right">{r.daysToEnd}</TableCell>
                    <TableCell align="right">{fmtKg(r.estimatedFeedKg)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </CardContent>
      </Card>
    </Stack>
  );
}
