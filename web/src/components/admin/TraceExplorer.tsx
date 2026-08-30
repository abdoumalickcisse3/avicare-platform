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
  Dialog,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { Search, X } from "lucide-react";
import { useGetTraceQuery, useSearchTracesQuery } from "@/store/api/adminApi";
import { apiErrorMessage } from "@/lib/apiError";
import { colors } from "@/theme/tokens";
import type { RequestTraceRow } from "@/types";

/** Green under 400, orange for a refusal, red for a failure — the eye sorts before the filter. */
function statusColor(status: number | null): string {
  if (status === null) return colors.neutral[500];
  if (status >= 500) return "#b3261e";
  if (status >= 400) return "#b26a00";
  return "#1b7f4d";
}

function Field({ label, value }: { label: string; value: string | number | null }) {
  if (value === null || value === "") return null;
  return (
    <Stack direction="row" sx={{ gap: 1, alignItems: "baseline" }}>
      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 110 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ wordBreak: "break-word" }}>
        {value}
      </Typography>
    </Stack>
  );
}

function Payload({ label, content }: { label: string; content: string | null }) {
  if (!content) return null;
  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Box
        component="pre"
        sx={{
          mt: 0.5,
          p: 1.5,
          bgcolor: colors.neutral[50],
          borderRadius: 1,
          fontSize: 12,
          maxHeight: 260,
          overflow: "auto",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {content}
      </Box>
    </Box>
  );
}

/** The trace, opened. Payloads arrive already masked and truncated by the backend. */
function TraceDetail({ id, onClose }: { id: number; onClose: () => void }) {
  const { data, isLoading, error } = useGetTraceQuery({ id });

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span>Trace #{id}</span>
        <Button size="small" onClick={onClose} startIcon={<X size={15} />}>
          Fermer
        </Button>
      </DialogTitle>
      <DialogContent dividers>
        {isLoading && <CircularProgress size={22} />}
        {error && <Alert severity="error">{apiErrorMessage(error)}</Alert>}
        {data && (
          <Stack sx={{ gap: 0.75 }}>
            <Field label="Identifiant" value={data.requestId} />
            <Field label="Requête" value={`${data.method} ${data.path}`} />
            <Field label="Route" value={data.routePattern} />
            <Field label="Statut" value={data.statusCode} />
            <Field label="Durée" value={data.durationMs === null ? null : `${data.durationMs} ms`} />
            <Field label="Utilisateur" value={data.userEmail ?? data.userId} />
            <Field label="Ferme" value={data.farmId} />
            <Field label="IP" value={data.ip} />
            <Field label="Début" value={new Date(data.startedAt).toLocaleString("fr-FR")} />
            {data.auditActions.length > 0 && (
              <Stack direction="row" sx={{ gap: 0.5, flexWrap: "wrap", mt: 1 }}>
                {data.auditActions.map((action, index) => (
                  <Chip key={`${action}-${index}`} size="small" label={action} />
                ))}
              </Stack>
            )}
            {data.errorMessage && (
              <Alert severity="error" sx={{ mt: 1 }}>
                {data.errorMessage}
              </Alert>
            )}
            <Payload label="Corps de la requête (secrets masqués)" content={data.requestBody} />
            <Payload label="Réponse" content={data.responseBody} />
            <Payload label="Stack trace" content={data.stackTrace} />
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Trace explorer: the answer to "I got an error this morning at 10:37".
 *
 * <p>The user reads out the reference their error message showed; it is pasted here and the request
 * comes back with its payload, its timing and its stack trace. The identifier field matches on the
 * full correlation id, which is what the short reference is the head of.
 *
 * <p>The table itself never shows a payload — opening one trace is a deliberate act, and it is
 * audited server-side as {@code trace.view}.
 */
export function TraceExplorer() {
  const [requestId, setRequestId] = useState("");
  const [email, setEmail] = useState("");
  const [path, setPath] = useState("");
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);

  const { data, isFetching, error } = useSearchTracesQuery({
    requestId: requestId.trim() || undefined,
    email: email.trim() || undefined,
    path: path.trim() || undefined,
    errorsOnly,
    size: 50,
  });

  const rows: RequestTraceRow[] = data?.items ?? [];

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        Traces
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Recherchez la requête d&apos;un utilisateur à partir de la référence affichée dans son
        message d&apos;erreur. Erreurs, écritures et lectures lentes sont conservées 30 jours.
      </Typography>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} sx={{ gap: 2, alignItems: "center" }}>
            <TextField
              size="small"
              label="Référence / identifiant"
              value={requestId}
              onChange={(e) => setRequestId(e.target.value)}
              sx={{ flex: 1, minWidth: 220 }}
            />
            <TextField
              size="small"
              label="Email utilisateur"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              sx={{ flex: 1 }}
            />
            <TextField
              size="small"
              label="Endpoint"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              sx={{ flex: 1 }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={errorsOnly}
                  onChange={(e) => setErrorsOnly(e.target.checked)}
                  size="small"
                />
              }
              label="Erreurs seulement"
            />
          </Stack>
        </CardContent>
      </Card>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {apiErrorMessage(error)}
        </Alert>
      )}

      <Card variant="outlined">
        <CardContent>
          {isFetching && <CircularProgress size={22} sx={{ mb: 1 }} />}
          {!isFetching && rows.length === 0 && (
            <Stack direction="row" sx={{ gap: 1, alignItems: "center", py: 2 }}>
              <Search size={16} />
              <Typography variant="body2" color="text.secondary">
                Aucune trace pour ces critères.
              </Typography>
            </Stack>
          )}
          {rows.length > 0 && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Requête</TableCell>
                  <TableCell>Statut</TableCell>
                  <TableCell>Durée</TableCell>
                  <TableCell>Utilisateur</TableCell>
                  <TableCell>Référence</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow
                    key={row.id}
                    hover
                    sx={{ cursor: "pointer" }}
                    onClick={() => setOpenId(row.id)}
                  >
                    <TableCell>{new Date(row.startedAt).toLocaleString("fr-FR")}</TableCell>
                    <TableCell sx={{ maxWidth: 320, wordBreak: "break-all" }}>
                      <strong>{row.method}</strong> {row.path}
                    </TableCell>
                    <TableCell sx={{ color: statusColor(row.statusCode), fontWeight: 700 }}>
                      {row.statusCode ?? "—"}
                    </TableCell>
                    <TableCell>{row.durationMs === null ? "—" : `${row.durationMs} ms`}</TableCell>
                    <TableCell>{row.userEmail ?? "—"}</TableCell>
                    <TableCell sx={{ fontFamily: "monospace", fontSize: 12 }}>
                      {row.requestId.split("-")[0].toUpperCase()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {openId !== null && <TraceDetail id={openId} onClose={() => setOpenId(null)} />}
    </Box>
  );
}
