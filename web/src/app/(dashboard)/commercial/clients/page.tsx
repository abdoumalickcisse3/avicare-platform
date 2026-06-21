"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  IconButton,
  LinearProgress,
  Menu,
  MenuItem,
  Skeleton,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { MoreVertical, Plus, Search } from "lucide-react";
import {
  useDeactivateClientMutation,
  useGetClientsQuery,
} from "@/store/api/clientsApi";
import { useCommercialGating } from "@/hooks/useCommercialGating";
import { ClientDialog } from "@/components/commercial/ClientDialog";
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
import type { Client } from "@/types";

const mono = { fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" } as const;

function CreditCell({ client }: { client: Client }) {
  const ratio = creditRatio(client);
  const color = creditColor(client);
  return (
    <Stack spacing={0.5} sx={{ minWidth: 140 }}>
      <Typography sx={{ ...mono, fontWeight: 600, color }}>
        {formatCurrency(client.currentBalanceXof)}
      </Typography>
      {ratio != null ? (
        <LinearProgress
          variant="determinate"
          value={Math.min(ratio * 100, 100)}
          sx={{
            height: 6,
            borderRadius: 3,
            bgcolor: colors.neutral[200],
            "& .MuiLinearProgress-bar": { bgcolor: color },
          }}
        />
      ) : (
        <Typography variant="caption" color="text.secondary">
          Pas de limite
        </Typography>
      )}
    </Stack>
  );
}

export default function ClientsPage() {
  const router = useRouter();
  const { farmId, hasFarm, hasCommercial } = useCommercialGating();
  const { showToast } = useToast();
  const { data: clients, isLoading } = useGetClientsQuery(
    { farmId: farmId as number },
    { skip: !hasFarm || !hasCommercial },
  );
  const [deactivate] = useDeactivateClientMutation();

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [menuEl, setMenuEl] = useState<null | HTMLElement>(null);
  const [menuClient, setMenuClient] = useState<Client | null>(null);

  const debtorsCount = useMemo(
    () => (clients ?? []).filter((c) => c.currentBalanceXof > 0).length,
    [clients],
  );

  const filtered = useMemo(() => {
    const base =
      tab === "debtors"
        ? [...(clients ?? [])]
            .filter((c) => c.currentBalanceXof > 0)
            .sort((a, b) => b.currentBalanceXof - a.currentBalanceXof)
        : (clients ?? []);
    const q = search.trim().toLowerCase();
    return q
      ? base.filter(
          (c) =>
            c.displayName.toLowerCase().includes(q) ||
            (c.phone ?? "").toLowerCase().includes(q),
        )
      : base;
  }, [clients, search, tab]);

  if (hasFarm && !hasCommercial) {
    return <Alert severity="info">Activez le module Commercial pour gérer vos clients.</Alert>;
  }

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (c: Client) => {
    setEditing(c);
    setDialogOpen(true);
    setMenuEl(null);
  };
  const remove = async (c: Client) => {
    setMenuEl(null);
    try {
      await deactivate({ farmId: farmId as number, id: c.id }).unwrap();
      showToast("Client désactivé.", "success");
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" }, mb: 3 }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Clients
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Votre carnet clients et leurs encours.
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="primary"
          startIcon={<Plus size={18} />}
          onClick={openCreate}
          disabled={!hasFarm}
        >
          Nouveau client
        </Button>
      </Stack>

      <Tabs
        value={tab}
        onChange={(_e, v) => setTab(v)}
        sx={{ mb: 2, borderBottom: `1px solid ${colors.neutral[200]}` }}
      >
        <Tab key="all" value="all" label={`Tous${clients?.length ? ` (${clients.length})` : ""}`} />
        <Tab
          key="debtors"
          value="debtors"
          label={`Débiteurs${debtorsCount ? ` (${debtorsCount})` : ""}`}
        />
      </Tabs>

      <TextField
        placeholder="Rechercher un client…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        size="small"
        sx={{ mb: 2, maxWidth: 360 }}
        fullWidth
        slotProps={{
          input: {
            startAdornment: (
              <Search size={16} style={{ marginRight: 8, color: colors.neutral[400] }} />
            ),
          },
        }}
      />

      {isLoading && <Skeleton variant="rectangular" height={240} sx={{ borderRadius: 3 }} />}

      {!isLoading && filtered.length === 0 && (
        <Box
          sx={{
            textAlign: "center",
            py: 8,
            border: (t) => `1px dashed ${t.palette.divider}`,
            borderRadius: 3,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {tab === "debtors" ? "Aucun débiteur" : "Aucun client"}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {tab === "debtors"
              ? "Tous vos clients sont à jour."
              : "Ajoutez votre premier client pour suivre ses commandes et son encours."}
          </Typography>
          {tab === "all" && (
            <Button variant="contained" color="primary" startIcon={<Plus size={18} />} onClick={openCreate}>
              Nouveau client
            </Button>
          )}
        </Box>
      )}

      {!isLoading && filtered.length > 0 && (
        <TableContainer sx={{ border: `1px solid ${colors.neutral[200]}`, borderRadius: 3 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Nom</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Téléphone</TableCell>
                <TableCell>Encours</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((c) => (
                <TableRow
                  key={c.id}
                  hover
                  sx={{ cursor: "pointer" }}
                  onClick={() => router.push(`/commercial/clients/${c.id}`)}
                >
                  <TableCell>
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                      <Avatar
                        sx={{
                          width: 36,
                          height: 36,
                          bgcolor: colors.primary[100],
                          color: colors.primary[700],
                          fontSize: 14,
                          fontWeight: 700,
                        }}
                      >
                        {initials(c.displayName)}
                      </Avatar>
                      <Box>
                        <Typography sx={{ fontWeight: 600 }}>{c.displayName}</Typography>
                        {c.legalName && (
                          <Typography variant="caption" color="text.secondary">
                            {c.legalName}
                          </Typography>
                        )}
                      </Box>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Chip label={CLIENT_TYPE_LABELS[c.clientType]} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>{c.phone ?? "—"}</TableCell>
                  <TableCell>
                    <CreditCell client={c} />
                  </TableCell>
                  <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                    <IconButton
                      size="small"
                      aria-label="Actions"
                      onClick={(e) => {
                        setMenuEl(e.currentTarget);
                        setMenuClient(c);
                      }}
                    >
                      <MoreVertical size={18} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Menu anchorEl={menuEl} open={!!menuEl} onClose={() => setMenuEl(null)}>
        <MenuItem onClick={() => menuClient && openEdit(menuClient)}>Modifier</MenuItem>
        <MenuItem
          onClick={() => menuClient && remove(menuClient)}
          sx={{ color: colors.error.main }}
        >
          Désactiver
        </MenuItem>
      </Menu>

      {farmId && (
        <ClientDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          farmId={farmId}
          client={editing}
        />
      )}
    </Box>
  );
}
