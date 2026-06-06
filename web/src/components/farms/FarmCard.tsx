"use client";

import Link from "next/link";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from "@mui/material";
import { ArrowRight, Bird, MapPin } from "lucide-react";
import { colors } from "@/theme/tokens";
import type { Farm } from "@/types";

interface FarmCardProps {
  farm: Farm;
}

/**
 * Farm summary card for the list grid. Inspired by the Stitch "Liste des fermes"
 * design but limited to data the backend actually returns (name, location,
 * capacity, active status) — no fabricated batch/production/health metrics.
 */
export function FarmCard({ farm }: FarmCardProps) {
  return (
    <Card sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Box
        sx={{
          height: 96,
          background: `linear-gradient(135deg, ${colors.primary[600]} 0%, ${colors.primary[800]} 100%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: colors.neutral[0],
          position: "relative",
        }}
      >
        <Bird size={32} strokeWidth={1.5} />
        <Chip
          label={farm.active ? "Opérationnel" : "Inactif"}
          size="small"
          sx={{
            position: "absolute",
            top: 12,
            right: 12,
            fontWeight: 600,
            fontSize: "0.7rem",
            bgcolor: farm.active ? colors.success.light : colors.neutral[200],
            color: farm.active ? colors.success.dark : colors.neutral[700],
          }}
        />
      </Box>

      <CardContent sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          {farm.name}
        </Typography>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            color: "text.secondary",
            mt: 0.5,
          }}
        >
          <MapPin size={14} />
          <Typography variant="body2" color="text.secondary">
            {farm.location ?? "Localisation non renseignée"}
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} sx={{ mt: 2, mb: 2 }}>
          <Chip
            variant="outlined"
            size="small"
            label={
              farm.capacity != null
                ? `Capacité ${farm.capacity.toLocaleString("fr-SN")} têtes`
                : "Capacité non définie"
            }
          />
        </Stack>

        <Button
          component={Link}
          href={`/fermes/${farm.id}`}
          variant="outlined"
          fullWidth
          endIcon={<ArrowRight size={16} />}
          sx={{ mt: "auto" }}
        >
          Gérer l&apos;exploitation
        </Button>
      </CardContent>
    </Card>
  );
}
