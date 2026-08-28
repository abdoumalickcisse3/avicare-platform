"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Box,
  Card,
  CardContent,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useGetAdminFarmsQuery } from "@/store/api/adminApi";
import { colors } from "@/theme/tokens";

/** Days without any entry past which a farm is worth a support call. */
const STALE_DAYS = 14;

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function activityLabel(iso: string | null): { text: string; stale: boolean } {
  const days = daysSince(iso);
  // Never is not "a long time ago": it is a farm that has not started.
  if (days === null) return { text: "Jamais", stale: true };
  if (days === 0) return { text: "Aujourd'hui", stale: false };
  return { text: `Il y a ${days} j`, stale: days >= STALE_DAYS };
}

/** Farm directory. Filtering is client-side over an already-loaded list — 14 farms today. */
export function FarmTable() {
  const [query, setQuery] = useState("");
  const { data: farms = [], isLoading } = useGetAdminFarmsQuery();

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? farms.filter((f) => f.name.toLowerCase().includes(needle)) : farms;
  }, [farms, query]);

  return (
    <Card>
      <CardContent>
        <Stack
          direction="row"
          sx={{ justifyContent: "space-between", alignItems: "center", mb: 2, gap: 2, flexWrap: "wrap" }}
        >
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Fermes {farms.length > 0 && `(${farms.length})`}
          </Typography>
          <TextField
            size="small"
            placeholder="Rechercher une ferme"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            sx={{ minWidth: 240 }}
          />
        </Stack>

        {!isLoading && rows.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
            Aucune ferme ne correspond.
          </Typography>
        ) : (
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 680 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Ferme</TableCell>
                  <TableCell align="right">Membres</TableCell>
                  <TableCell align="right">Lots actifs</TableCell>
                  <TableCell>Dernière saisie</TableCell>
                  <TableCell>Statut</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((f) => {
                  const activity = activityLabel(f.lastActivityAt);
                  return (
                    <TableRow key={f.farmId} hover>
                      <TableCell>
                        <Typography
                          component={Link}
                          href={`/console/fermes/${f.farmId}`}
                          variant="body2"
                          sx={{ fontWeight: 600, color: colors.primary[600] }}
                        >
                          {f.name}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{f.memberCount}</TableCell>
                      <TableCell align="right">{f.activeUnitCount}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          variant="outlined"
                          color={activity.stale ? "warning" : "default"}
                          label={activity.text}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={f.active ? "success" : "default"}
                          label={f.active ? "Active" : "Inactive"}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
