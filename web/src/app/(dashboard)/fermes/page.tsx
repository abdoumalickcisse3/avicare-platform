"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { Plus } from "lucide-react";
import { useGetMyFarmsQuery } from "@/store/api/farmsApi";
import { apiErrorMessage } from "@/lib/apiError";
import { FarmCard } from "@/components/farms/FarmCard";
import { CreateFarmDialog } from "@/components/farms/CreateFarmDialog";

const GRID_SX = {
  display: "grid",
  gap: { xs: 2, md: 3 },
  gridTemplateColumns: {
    xs: "1fr",
    sm: "repeat(2, 1fr)",
    lg: "repeat(3, 1fr)",
  },
} as const;

export default function FarmsPage() {
  const { data: farms, isLoading, error } = useGetMyFarmsQuery();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" }, mb: 3 }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Mes Fermes
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Gérez vos exploitations avicoles et surveillez leurs performances.
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="primary"
          startIcon={<Plus size={18} />}
          onClick={() => setCreateOpen(true)}
        >
          Nouvelle ferme
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {apiErrorMessage(error)}
        </Alert>
      )}

      {isLoading && (
        <Box sx={GRID_SX}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton
              key={i}
              variant="rectangular"
              height={260}
              sx={{ borderRadius: 3 }}
            />
          ))}
        </Box>
      )}

      {!isLoading && !error && farms && farms.length === 0 && (
        <Box
          sx={{
            textAlign: "center",
            py: 8,
            border: (t) => `1px dashed ${t.palette.divider}`,
            borderRadius: 3,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Aucune ferme pour le moment
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Créez votre première exploitation pour commencer.
          </Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={<Plus size={18} />}
            onClick={() => setCreateOpen(true)}
          >
            Créer une ferme
          </Button>
        </Box>
      )}

      {!isLoading && !error && farms && farms.length > 0 && (
        <Box sx={GRID_SX}>
          {farms.map((farm) => (
            <FarmCard key={farm.id} farm={farm} />
          ))}
        </Box>
      )}

      <CreateFarmDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </Box>
  );
}
