"use client";

import { useState } from "react";
import NextLink from "next/link";
import {
  Box,
  Breadcrumbs,
  Button,
  Card,
  Chip,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { Bird, Plus } from "lucide-react";
import { useGetBreedsQuery } from "@/store/api/breedsApi";
import { useSelectedFarm } from "@/hooks/useSelectedFarm";
import { useFarmRole, canManageCatalog } from "@/hooks/useFarmRole";
import { colors } from "@/theme/tokens";
import { BreedDialog, BREED_PROFILE_LABELS } from "./BreedDialog";

const headCellSx = { fontWeight: 600 } as const;

/**
 * Lets a farm declare a breed the platform catalogue does not have (Goliath, Kuroiler, "locale
 * améliorée"...) and see the ones it already declared. Standard breeds stay in the create-batch
 * dropdown regardless — this screen only manages the farm's own additions.
 */
export function BreedLibraryView() {
  const { farmId, isLoading: farmLoading, hasFarm } = useSelectedFarm();
  const role = useFarmRole(farmId);
  const canManage = canManageCatalog(role);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: breeds = [], isLoading } = useGetBreedsQuery(undefined, { skip: !hasFarm });
  const ownBreeds = breeds.filter((b) => b.farmId === farmId);

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 1 }}>
        <NextLink href="/reglages" style={{ color: "inherit" }}>
          Réglages
        </NextLink>
        <Typography color="text.primary">Souches</Typography>
      </Breadcrumbs>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
        Souches
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Déclarez une souche absente du catalogue (Goliath, Kuroiler, locale améliorée…) ; les
        souches standards restent disponibles partout sans rien déclarer.
      </Typography>

      <Card>
        <Box sx={{ p: { xs: 2, md: 2.5 } }}>
          {canManage && (
            <Stack direction="row" sx={{ justifyContent: "flex-end", mb: 2 }}>
              <Button
                variant="contained"
                color="secondary"
                startIcon={<Plus size={16} />}
                onClick={() => setDialogOpen(true)}
              >
                Déclarer une souche
              </Button>
            </Stack>
          )}

          {farmLoading || isLoading ? (
            <Stack spacing={1}>
              <Skeleton variant="rounded" height={40} />
              <Skeleton variant="rounded" height={40} />
            </Stack>
          ) : ownBreeds.length === 0 ? (
            <Stack sx={{ alignItems: "center", py: 4 }} spacing={1}>
              <Bird size={28} color={colors.primary[500]} />
              <Typography variant="body2" color="text.secondary">
                Aucune souche personnalisée déclarée pour cette exploitation.
              </Typography>
            </Stack>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={headCellSx}>Nom</TableCell>
                    <TableCell sx={headCellSx}>Profil</TableCell>
                    <TableCell sx={headCellSx} align="right">
                      Cible
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {ownBreeds.map((b) => (
                    <TableRow key={b.id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{b.name}</TableCell>
                      <TableCell>
                        {b.profile ? (
                          <Chip
                            size="small"
                            label={BREED_PROFILE_LABELS[b.profile]}
                            sx={{ bgcolor: colors.primary[50], color: colors.primary[700] }}
                          />
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell align="right" sx={{ fontFamily: "var(--font-mono)" }}>
                        {b.defaultTargetWeightG != null && b.defaultTargetAgeDays != null
                          ? `${b.defaultTargetWeightG} g / ${b.defaultTargetAgeDays} j`
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      </Card>

      {farmId && (
        <BreedDialog open={dialogOpen} onClose={() => setDialogOpen(false)} farmId={farmId} />
      )}
    </Box>
  );
}
