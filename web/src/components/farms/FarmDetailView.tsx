"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { MapPin, Pencil, Trash2 } from "lucide-react";
import {
  useDeleteFarmMutation,
  useGetFarmQuery,
} from "@/store/api/farmsApi";
import { apiErrorMessage } from "@/lib/apiError";
import { useToast } from "@/components/feedback/ToastProvider";
import { colors } from "@/theme/tokens";
import { CreateFarmDialog } from "./CreateFarmDialog";
import { FarmTeamTab } from "./FarmTeamTab";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

type TabKey = "overview" | "team" | "subscription" | "settings";

const OVERVIEW_STATS = [
  { label: "Effectif total", hint: "Sujets actifs" },
  { label: "Taux de mortalité", hint: "Moyenne pondérée" },
  { label: "Production (7j)", hint: "Taux de ponte" },
  { label: "Aliment (journalier)", hint: "Indice de conversion" },
];

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ py: 6, textAlign: "center" }}>
      <Typography variant="body2" color="text.secondary">
        {children}
      </Typography>
    </Box>
  );
}

export function FarmDetailView({ farmId }: { farmId: number }) {
  const router = useRouter();
  const { showToast } = useToast();
  const { data: farm, isLoading, error } = useGetFarmQuery(farmId);
  const [deleteFarm, { isLoading: deleting }] = useDeleteFarmMutation();

  const [tab, setTab] = useState<TabKey>("overview");
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleDelete = async () => {
    try {
      await deleteFarm(farmId).unwrap();
      showToast("Ferme supprimée.", "success");
      router.push("/fermes");
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  if (isLoading) {
    return (
      <Stack spacing={2}>
        <Skeleton variant="text" width={240} height={48} />
        <Skeleton variant="rectangular" height={48} sx={{ borderRadius: 2 }} />
        <Skeleton variant="rectangular" height={240} sx={{ borderRadius: 2 }} />
      </Stack>
    );
  }

  if (error || !farm) {
    return (
      <Alert severity="error">
        {error ? apiErrorMessage(error) : "Ferme introuvable."}
      </Alert>
    );
  }

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 1 }}>
        <Link href="/fermes" style={{ color: "inherit" }}>
          Fermes
        </Link>
        <Typography color="text.primary">{farm.name}</Typography>
      </Breadcrumbs>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { sm: "flex-start" }, mb: 3 }}
      >
        <Box>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {farm.name}
            </Typography>
            <Chip
              label={farm.active ? "Opérationnel" : "Inactif"}
              size="small"
              sx={{
                fontWeight: 600,
                bgcolor: farm.active ? colors.success.light : colors.neutral[200],
                color: farm.active ? colors.success.dark : colors.neutral[700],
              }}
            />
          </Stack>
          {farm.location && (
            <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", color: "text.secondary", mt: 0.5 }}>
              <MapPin size={14} />
              <Typography variant="body2" color="text.secondary">
                {farm.location}
              </Typography>
            </Stack>
          )}
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<Pencil size={16} />}
            onClick={() => setEditOpen(true)}
          >
            Modifier
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<Trash2 size={16} />}
            onClick={() => setDeleteOpen(true)}
          >
            Supprimer
          </Button>
        </Stack>
      </Stack>

      <Tabs
        value={tab}
        onChange={(_e, v: TabKey) => setTab(v)}
        sx={{ borderBottom: `1px solid ${colors.neutral[200]}`, mb: 3 }}
      >
        <Tab label="Vue d'ensemble" value="overview" />
        <Tab label="Équipe" value="team" />
        <Tab label="Abonnement" value="subscription" />
        <Tab label="Paramètres" value="settings" />
      </Tabs>

      {tab === "overview" && (
        <Box>
          <Box
            sx={{
              display: "grid",
              gap: { xs: 2, md: 3 },
              gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" },
              mb: 3,
            }}
          >
            {OVERVIEW_STATS.map((stat) => (
              <Card key={stat.label}>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">
                    {stat.label}
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, my: 0.5 }}>
                    —
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {stat.hint} · bientôt disponible
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                Activité récente
              </Typography>
              <Placeholder>
                Les indicateurs de production seront disponibles une fois le
                module élevage activé.
              </Placeholder>
            </CardContent>
          </Card>
        </Box>
      )}

      {tab === "team" && <FarmTeamTab farmId={farmId} />}

      {tab === "subscription" && (
        <Placeholder>Gestion de l&apos;abonnement — à venir (Sprint A6-3).</Placeholder>
      )}

      {tab === "settings" && (
        <Placeholder>Paramètres de la ferme — à venir.</Placeholder>
      )}

      <CreateFarmDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        farm={farm}
      />
      <ConfirmDialog
        open={deleteOpen}
        title="Supprimer cette ferme ?"
        message={`La ferme « ${farm.name} » sera supprimée. Cette action est irréversible.`}
        confirmLabel="Supprimer"
        danger
        loading={deleting}
        onConfirm={handleDelete}
        onClose={() => setDeleteOpen(false)}
      />
    </Box>
  );
}
