"use client";

import Link from "next/link";
import { ArrowRight, ChevronRight, MapPin } from "lucide-react";
import {
  Box,
  Card,
  CardContent,
  Chip,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { colors } from "@/theme/tokens";
import { useGetMyFarmsQuery } from "@/store/api/farmsApi";
import type { Farm } from "@/types";

const FOCUS_LABEL: Record<string, string> = { broiler: "Chair", layer: "Ponte" };

interface FarmsTableProps {
  selectedFarmId?: number;
}

/**
 * "Vos fermes" — the farms table from the Avicare Design System (Stitch),
 * bound to the user's real farms. Shows name, location, production focus and
 * status; the farm currently in focus is highlighted. Each row links to the
 * farm detail page.
 */
export function FarmsTable({ selectedFarmId }: FarmsTableProps) {
  const { data: farms, isLoading } = useGetMyFarmsQuery();

  return (
    <Card>
      <CardContent>
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
          <Typography sx={{ fontWeight: 700, fontSize: "1rem" }}>Vos fermes</Typography>
          {farms && farms.length > 0 && (
            <Chip
              size="small"
              label={`${farms.filter((f) => f.active).length} active${farms.filter((f) => f.active).length > 1 ? "s" : ""}`}
              sx={{ bgcolor: colors.success.light, color: colors.success.dark, fontWeight: 700, height: 22 }}
            />
          )}
        </Stack>

        {isLoading ? (
          <Stack spacing={1.5} sx={{ py: 1 }}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} variant="rectangular" height={44} sx={{ borderRadius: 1 }} />
            ))}
          </Stack>
        ) : !farms || farms.length === 0 ? (
          <Box sx={{ py: 4, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              Aucune ferme pour le moment.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 520 }}>
              <TableHead>
                <TableRow>
                  {["Ferme", "Localisation", "Production", "Statut", ""].map((h, i) => (
                    <TableCell
                      key={h || i}
                      align={i === 4 ? "right" : "left"}
                      sx={{
                        border: 0,
                        color: "text.secondary",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        fontSize: "0.68rem",
                        fontWeight: 700,
                        py: 1,
                      }}
                    >
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {farms.map((farm: Farm) => {
                  const isSelected = farm.id === selectedFarmId;
                  return (
                    <TableRow
                      key={farm.id}
                      component={Link}
                      href={`/fermes/${farm.id}`}
                      sx={{
                        textDecoration: "none",
                        cursor: "pointer",
                        bgcolor: isSelected ? alpha(colors.primary[500], 0.06) : "transparent",
                        "&:hover": { bgcolor: alpha(colors.primary[500], 0.09) },
                        "& td": { border: 0, borderTop: `1px solid ${colors.neutral[100]}` },
                      }}
                    >
                      <TableCell sx={{ py: 1.25 }}>
                        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                          {isSelected && (
                            <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: colors.primary[500], flexShrink: 0 }} />
                          )}
                          <Typography variant="body2" sx={{ fontWeight: 600, color: "text.primary" }}>
                            {farm.name}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell sx={{ py: 1.25 }}>
                        <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", color: "text.secondary" }}>
                          {farm.location ? (
                            <>
                              <MapPin size={13} />
                              <Typography variant="body2" color="text.secondary">
                                {farm.location}
                              </Typography>
                            </>
                          ) : (
                            <Typography variant="body2" color="text.disabled">—</Typography>
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell sx={{ py: 1.25 }}>
                        <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5 }}>
                          {farm.productionFocus.length > 0 ? (
                            farm.productionFocus.map((f) => (
                              <Chip
                                key={f}
                                size="small"
                                label={FOCUS_LABEL[f] ?? f}
                                sx={{ height: 20, fontSize: "0.68rem", bgcolor: colors.primary[50], color: colors.primary[700] }}
                              />
                            ))
                          ) : (
                            <Typography variant="body2" color="text.disabled">—</Typography>
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell sx={{ py: 1.25 }}>
                        <Chip
                          size="small"
                          label={farm.active ? "Active" : "Inactive"}
                          sx={{
                            height: 20,
                            fontSize: "0.68rem",
                            fontWeight: 600,
                            bgcolor: farm.active ? colors.success.light : colors.neutral[100],
                            color: farm.active ? colors.success.dark : colors.neutral[600],
                          }}
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ py: 1.25, color: "text.disabled" }}>
                        <ChevronRight size={16} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        )}

        <Box sx={{ mt: 1.5, textAlign: "center" }}>
          <Typography
            component={Link}
            href="/fermes"
            variant="body2"
            sx={{
              color: colors.primary[600],
              fontWeight: 600,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 0.5,
              "&:hover": { textDecoration: "underline" },
            }}
          >
            Voir toutes les fermes <ArrowRight size={14} />
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}
