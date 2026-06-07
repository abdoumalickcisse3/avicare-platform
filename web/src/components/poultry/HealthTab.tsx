"use client";

import NextLink from "next/link";
import { Box, Button, Card, Stack, Typography } from "@mui/material";
import { HeartPulse, Sparkles } from "lucide-react";
import { colors } from "@/theme/tokens";

export function HealthTab({ farmId }: { farmId: number }) {
  return (
    <Card
      sx={{
        py: 6,
        px: 3,
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 1.5,
      }}
    >
      <Box
        sx={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: colors.accent[50],
          color: colors.accent[500],
        }}
      >
        <HeartPulse size={28} />
      </Box>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        Module sanitaire — bientôt disponible
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
        Programmes de vaccination, traitements et alertes sanitaires arrivent dans
        une prochaine version. Activez le module avancé pour en être informé en
        priorité.
      </Typography>
      <Stack direction="row" spacing={1.5} sx={{ mt: 1 }}>
        <Button
          component={NextLink}
          href={`/fermes/${farmId}?tab=subscription`}
          variant="contained"
          color="primary"
          startIcon={<Sparkles size={18} />}
          sx={{ fontWeight: 700 }}
        >
          Voir les modules
        </Button>
      </Stack>
    </Card>
  );
}
