"use client";

import { useState } from "react";
import NextLink from "next/link";
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Card,
  Chip,
  IconButton,
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
  Typography,
} from "@mui/material";
import { Pencil, Plus, Power, Stethoscope } from "lucide-react";
import { useHealthGating } from "@/hooks/useHealthGating";
import {
  useDeactivateVeterinarianMutation,
  useGetProgramsQuery,
  useGetTreatmentCatalogQuery,
  useGetVaccinesQuery,
  useGetVeterinariansQuery,
} from "@/store/api/healthApi";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
import { ageLabel, humanizeKey } from "@/lib/health";
import { colors } from "@/theme/tokens";
import { AdvancedLockCard } from "./AdvancedLockCard";
import { VeterinarianDialog } from "./VeterinarianDialog";
import type { Veterinarian } from "@/types";

type TabKey = "vaccines" | "treatments" | "programs" | "vets";

const READ_ONLY_NOTE =
  "Bibliothèque plateforme en lecture seule. L'édition de votre bibliothèque personnalisée arrivera prochainement.";

const headCellSx = { fontWeight: 600 } as const;

export function HealthLibraryView() {
  const { farmId, hasFarm, hasHealth, hasAdvanced } = useHealthGating();
  const [tab, setTab] = useState<TabKey>("vaccines");

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 1 }}>
        <NextLink href="/reglages" style={{ color: "inherit" }}>
          Réglages
        </NextLink>
        <Typography color="text.primary">Sanitaire</Typography>
      </Breadcrumbs>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
        Bibliothèque sanitaire
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Vaccins, traitements, programmes vaccinaux et annuaire de vétérinaires.
      </Typography>

      {hasFarm && !hasHealth ? (
        <AdvancedLockCard
          farmId={farmId}
          title="Module sanitaire inactif"
          description="Activez le module santé pour consulter la bibliothèque sanitaire."
        />
      ) : (
        <Card>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ borderBottom: `1px solid ${colors.neutral[200]}`, px: 1 }}
          >
            <Tab value="vaccines" label="Vaccins" />
            <Tab value="treatments" label="Traitements" />
            <Tab value="programs" label="Programmes" />
            <Tab value="vets" label="Vétérinaires" />
          </Tabs>

          <Box sx={{ p: { xs: 2, md: 2.5 } }}>
            {tab === "vaccines" && <VaccinesTab farmId={farmId} enabled={hasFarm} />}
            {tab === "treatments" &&
              (hasAdvanced ? (
                <TreatmentsTab farmId={farmId} enabled={hasFarm} />
              ) : (
                <AdvancedLockCard
                  farmId={farmId}
                  title="Traitements — module avancé"
                  description="Le catalogue des traitements nécessite health.advanced."
                />
              ))}
            {tab === "programs" && <ProgramsTab farmId={farmId} enabled={hasFarm} />}
            {tab === "vets" &&
              (hasAdvanced ? (
                <VetsTab farmId={farmId} enabled={hasFarm} />
              ) : (
                <AdvancedLockCard
                  farmId={farmId}
                  title="Vétérinaires — module avancé"
                  description="L'annuaire de vétérinaires nécessite health.advanced."
                />
              ))}
          </Box>
        </Card>
      )}
    </Box>
  );
}

function LoadingRows() {
  return (
    <Stack spacing={1} sx={{ p: 1 }}>
      <Skeleton variant="rounded" height={40} />
      <Skeleton variant="rounded" height={40} />
      <Skeleton variant="rounded" height={40} />
    </Stack>
  );
}

function VaccinesTab({ farmId, enabled }: { farmId?: number; enabled: boolean }) {
  const { data = [], isLoading } = useGetVaccinesQuery(
    { farmId: farmId as number },
    { skip: !enabled || !farmId },
  );
  if (isLoading) return <LoadingRows />;
  return (
    <>
      <Alert severity="info" sx={{ mb: 2 }}>
        {READ_ONLY_NOTE}
      </Alert>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={headCellSx}>Vaccin</TableCell>
              <TableCell sx={headCellSx}>Maladie ciblée</TableCell>
              <TableCell sx={headCellSx}>Voie</TableCell>
              <TableCell sx={headCellSx}>Type</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((v) => (
              <TableRow key={v.key} hover>
                <TableCell sx={{ fontWeight: 600 }}>{v.label}</TableCell>
                <TableCell>{humanizeKey(v.disease)}</TableCell>
                <TableCell>
                  {v.route && <Chip size="small" label={v.route} sx={{ bgcolor: colors.neutral[100] }} />}
                </TableCell>
                <TableCell>{v.activeStrain ? "Souche active" : "Inactivé"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}

function TreatmentsTab({ farmId, enabled }: { farmId?: number; enabled: boolean }) {
  const { data = [], isLoading } = useGetTreatmentCatalogQuery(
    { farmId: farmId as number },
    { skip: !enabled || !farmId },
  );
  if (isLoading) return <LoadingRows />;
  return (
    <>
      <Alert severity="info" sx={{ mb: 2 }}>
        {READ_ONLY_NOTE}
      </Alert>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={headCellSx}>Traitement</TableCell>
              <TableCell sx={headCellSx}>Molécule</TableCell>
              <TableCell sx={headCellSx}>Classe</TableCell>
              <TableCell sx={headCellSx} align="right">
                Délai œufs / viande
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((t) => (
              <TableRow key={t.key} hover>
                <TableCell sx={{ fontWeight: 600 }}>{t.label}</TableCell>
                <TableCell>{humanizeKey(t.molecule)}</TableCell>
                <TableCell>{humanizeKey(t.drugClass)}</TableCell>
                <TableCell align="right" sx={{ fontFamily: "var(--font-mono)" }}>
                  {t.withdrawalDaysEggs ?? "?"} j / {t.withdrawalDaysMeat ?? "?"} j
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}

function ProgramsTab({ farmId, enabled }: { farmId?: number; enabled: boolean }) {
  const { data = [], isLoading } = useGetProgramsQuery(
    { farmId: farmId as number },
    { skip: !enabled || !farmId },
  );
  if (isLoading) return <LoadingRows />;
  return (
    <>
      <Alert severity="info" sx={{ mb: 2 }}>
        {READ_ONLY_NOTE}
      </Alert>
      <Stack spacing={2}>
        {data.map((p) => (
          <Box key={p.key} sx={{ border: `1px solid ${colors.neutral[200]}`, borderRadius: 2, p: 2 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1, flexWrap: "wrap" }}>
              <Typography sx={{ fontWeight: 700 }}>{p.label}</Typography>
              {p.breedKeys.map((b) => (
                <Chip key={b} size="small" label={humanizeKey(b)} sx={{ bgcolor: colors.primary[50], color: colors.primary[700] }} />
              ))}
            </Stack>
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
              {p.schedule.map((s, i) => (
                <Chip
                  key={`${s.vaccineKey}-${i}`}
                  size="small"
                  label={`${ageLabel(s.ageValue, s.ageUnit)} · ${humanizeKey(s.vaccineKey)}`}
                  sx={{ bgcolor: colors.neutral[100], fontFamily: "var(--font-mono)" }}
                />
              ))}
            </Stack>
          </Box>
        ))}
      </Stack>
    </>
  );
}

function VetsTab({ farmId, enabled }: { farmId?: number; enabled: boolean }) {
  const { showToast } = useToast();
  const { data = [], isLoading } = useGetVeterinariansQuery(
    { farmId: farmId as number },
    { skip: !enabled || !farmId },
  );
  const [deactivate] = useDeactivateVeterinarianMutation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Veterinarian | null>(null);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (v: Veterinarian) => {
    setEditing(v);
    setDialogOpen(true);
  };
  const onDeactivate = async (id: number) => {
    try {
      await deactivate({ farmId: farmId as number, id }).unwrap();
      showToast("Vétérinaire désactivé.", "success");
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  return (
    <>
      <Stack direction="row" sx={{ justifyContent: "flex-end", mb: 2 }}>
        <Button variant="contained" color="secondary" startIcon={<Plus size={16} />} onClick={openCreate}>
          Ajouter un vétérinaire
        </Button>
      </Stack>
      {isLoading ? (
        <LoadingRows />
      ) : data.length === 0 ? (
        <Stack sx={{ alignItems: "center", py: 4 }} spacing={1}>
          <Stethoscope size={28} color={colors.vet.main} />
          <Typography variant="body2" color="text.secondary">
            Aucun vétérinaire dans votre annuaire.
          </Typography>
        </Stack>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={headCellSx}>Nom</TableCell>
                <TableCell sx={headCellSx}>Spécialité</TableCell>
                <TableCell sx={headCellSx}>Téléphone</TableCell>
                <TableCell sx={headCellSx}>Localisation</TableCell>
                <TableCell sx={headCellSx} align="right">
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map((v) => (
                <TableRow key={v.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{v.fullName}</TableCell>
                  <TableCell>{v.speciality ?? "—"}</TableCell>
                  <TableCell sx={{ fontFamily: "var(--font-mono)" }}>{v.phone ?? "—"}</TableCell>
                  <TableCell>{v.location ?? "—"}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" aria-label="Modifier" onClick={() => openEdit(v)}>
                      <Pencil size={16} />
                    </IconButton>
                    <IconButton size="small" aria-label="Désactiver" onClick={() => onDeactivate(v.id)}>
                      <Power size={16} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {farmId && (
        <VeterinarianDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          farmId={farmId}
          veterinarian={editing}
        />
      )}
    </>
  );
}
