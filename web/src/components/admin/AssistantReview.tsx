"use client";

import { useState } from "react";
import {
  Alert,
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
  TextField,
  Typography,
} from "@mui/material";
import { Bot, Search } from "lucide-react";
import {
  useGetAssistantFarmStatusQuery,
  useGetAssistantStatsQuery,
  useGetAssistantTurnsQuery,
  useSetAssistantEnabledMutation,
} from "@/store/api/adminApi";

const KIND_LABELS: Record<string, string> = {
  ANSWER: "Réponse",
  DRAFT: "Brouillon d'action",
  CLARIFICATION: "Demande de précision",
};

/**
 * Reading what the assistant actually answered.
 *
 * Its failure mode is a confident wrong answer, which no error rate surfaces — the only way to
 * catch it is for a human to read the turns. That is what this screen is for; the counters are
 * context, not a score.
 */
export function AssistantReview() {
  const [farmFilter, setFarmFilter] = useState("");
  const [appliedFarm, setAppliedFarm] = useState<number | undefined>(undefined);

  const { data: turns = [], isLoading } = useGetAssistantTurnsQuery({
    farmId: appliedFarm,
    limit: 50,
  });
  const { data: stats = {} } = useGetAssistantStatsQuery({ days: 30 });
  const { data: status } = useGetAssistantFarmStatusQuery(
    { farmId: appliedFarm as number },
    { skip: !appliedFarm },
  );
  const [setEnabled, { isLoading: switching }] = useSetAssistantEnabledMutation();

  const apply = () => {
    const parsed = Number(farmFilter);
    setAppliedFarm(Number.isFinite(parsed) && parsed > 0 ? parsed : undefined);
  };

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
          Assistant IA
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Relire ce que l&apos;assistant a répondu, et l&apos;activer ou non par ferme.
        </Typography>
      </Box>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
            Sur 30 jours
          </Typography>
          {Object.keys(stats).length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Aucune interaction enregistrée.
            </Typography>
          ) : (
            <Stack direction="row" sx={{ gap: 3, flexWrap: "wrap" }}>
              {Object.entries(stats).map(([kind, count]) => (
                <Box key={kind}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {count}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {KIND_LABELS[kind] ?? kind}
                  </Typography>
                </Box>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
            <TextField
              size="small"
              label="Filtrer par ferme (id)"
              value={farmFilter}
              onChange={(e) => setFarmFilter(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && apply()}
            />
            <Button variant="outlined" startIcon={<Search size={16} />} onClick={apply}>
              Filtrer
            </Button>
          </Stack>

          {appliedFarm && status && (
            <Alert
              severity={status.enabled ? "success" : "warning"}
              sx={{ mb: 2 }}
              action={
                <Button
                  size="small"
                  disabled={switching}
                  onClick={() => setEnabled({ farmId: appliedFarm, enabled: !status.enabled })}
                >
                  {status.enabled ? "Désactiver" : "Réactiver"}
                </Button>
              }
            >
              {status.enabled
                ? `L'assistant répond pour la ferme ${appliedFarm}.`
                : `L'assistant est désactivé pour la ferme ${appliedFarm} : elle voit un message l'invitant à contacter le support.`}
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent sx={{ overflowX: "auto" }}>
          <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 1.5 }}>
            <Bot size={18} />
            <Typography variant="subtitle2">Derniers échanges</Typography>
          </Stack>
          {isLoading ? (
            <CircularProgress size={22} />
          ) : turns.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Aucun échange à relire.
            </Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Ferme</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Demande</TableCell>
                  <TableCell>Réponse retenue</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {turns.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{t.farmId}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        variant="outlined"
                        label={KIND_LABELS[t.kind ?? ""] ?? t.kind ?? "—"}
                      />
                    </TableCell>
                    <TableCell sx={{ maxWidth: 320 }}>
                      <Typography variant="body2">{t.text}</Typography>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 320 }}>
                      <Typography variant="caption" color="text.secondary">
                        {t.summary ?? t.action ?? "—"}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}
