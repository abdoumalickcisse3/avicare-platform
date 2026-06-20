"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Alert,
  Avatar,
  Box,
  Breadcrumbs,
  Button,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { Mail, MapPin, Pencil, Phone, Power } from "lucide-react";
import {
  useDeactivateClientMutation,
  useGetClientQuery,
} from "@/store/api/clientsApi";
import { useCommercialGating } from "@/hooks/useCommercialGating";
import { ClientDialog } from "./ClientDialog";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
import {
  CLIENT_TYPE_LABELS,
  creditColor,
  creditRatio,
  initials,
} from "@/lib/commercial";
import { formatCurrency } from "@/lib/format";
import { colors } from "@/theme/tokens";

const mono = { fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" } as const;

export function ClientDetailView({ clientId }: { clientId: number }) {
  const { farmId, hasFarm, hasCommercial } = useCommercialGating();
  const { showToast } = useToast();
  const skip = !hasFarm || !hasCommercial;
  const { data: client, isLoading } = useGetClientQuery(
    { farmId: farmId as number, id: clientId },
    { skip },
  );
  const [deactivate] = useDeactivateClientMutation();
  const [editOpen, setEditOpen] = useState(false);

  if (hasFarm && !hasCommercial) {
    return <Alert severity="info">Activez le module Commercial pour consulter ce client.</Alert>;
  }
  if (isLoading) return <Skeleton variant="rectangular" height={360} sx={{ borderRadius: 3 }} />;
  if (!client) return <Alert severity="error">Client introuvable.</Alert>;

  const ratio = creditRatio(client);
  const color = creditColor(client);

  const onDeactivate = async () => {
    try {
      await deactivate({ farmId: farmId as number, id: client.id }).unwrap();
      showToast("Client désactivé.", "success");
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link href="/commercial/clients" style={{ color: colors.neutral[500], textDecoration: "none" }}>
          Clients
        </Link>
        <Typography color="text.primary">{client.displayName}</Typography>
      </Breadcrumbs>

      {/* Header: identity + status + actions */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" }, mb: 3 }}
      >
        <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
          <Avatar
            sx={{
              width: 52,
              height: 52,
              bgcolor: colors.primary[100],
              color: colors.primary[700],
              fontWeight: 700,
            }}
          >
            {initials(client.displayName)}
          </Avatar>
          <Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                {client.displayName}
              </Typography>
              <Chip label={CLIENT_TYPE_LABELS[client.clientType]} size="small" variant="outlined" />
              <Chip
                label={client.active ? "Actif" : "Inactif"}
                size="small"
                sx={{
                  bgcolor: client.active ? colors.success.light : colors.neutral[200],
                  color: client.active ? colors.success.dark : colors.neutral[600],
                  fontWeight: 600,
                }}
              />
            </Stack>
            {client.legalName && (
              <Typography variant="body2" color="text.secondary">
                {client.legalName}
              </Typography>
            )}
          </Box>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            color="inherit"
            startIcon={<Power size={16} />}
            onClick={onDeactivate}
            disabled={!client.active}
          >
            Désactiver
          </Button>
          <Button variant="contained" startIcon={<Pencil size={16} />} onClick={() => setEditOpen(true)}>
            Éditer
          </Button>
        </Stack>
      </Stack>

      <Box
        sx={{
          display: "grid",
          gap: { xs: 2, md: 3 },
          gridTemplateColumns: { xs: "1fr", md: "2fr 1fr" },
        }}
      >
        {/* Encours — the signature card */}
        <Card>
          <CardContent>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              Encours actuel
            </Typography>
            <Typography variant="h3" sx={{ ...mono, fontWeight: 700, color, mt: 0.5 }}>
              {formatCurrency(client.currentBalanceXof)}
            </Typography>
            {ratio != null ? (
              <Box sx={{ mt: 1.5 }}>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(ratio * 100, 100)}
                  sx={{
                    height: 8,
                    borderRadius: 4,
                    bgcolor: colors.neutral[200],
                    "& .MuiLinearProgress-bar": { bgcolor: color },
                  }}
                />
                <Typography variant="caption" sx={{ color: colors.neutral[600], mt: 0.5, display: "block" }}>
                  {Math.round(ratio * 100)}% de la limite de {formatCurrency(client.creditLimitXof!)}
                  {ratio > 1 && " — dépassée"}
                </Typography>
              </Box>
            ) : (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                Aucune limite de crédit définie
              </Typography>
            )}
          </CardContent>
        </Card>

        {/* Contact */}
        <Card>
          <CardContent>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              Contact
            </Typography>
            <Stack spacing={1} sx={{ mt: 1.5, color: colors.neutral[700], fontSize: 14 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Phone size={15} /> <span>{client.phone ?? "—"}</span>
              </Stack>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Mail size={15} /> <span>{client.email ?? "—"}</span>
              </Stack>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <MapPin size={15} />
                <span>{[client.address, client.city].filter(Boolean).join(", ") || "—"}</span>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Box>

      {/* Orders / invoices / payments history land in B5-6c/d. */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Historique commercial
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Les commandes, factures et paiements de ce client apparaîtront ici.
          </Typography>
        </CardContent>
      </Card>

      {farmId && (
        <ClientDialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
          farmId={farmId}
          client={client}
        />
      )}
    </Box>
  );
}
