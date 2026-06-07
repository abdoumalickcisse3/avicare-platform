"use client";

import Link from "next/link";
import {
  Box,
  Button,
  Card,
  Stack,
  Typography,
} from "@mui/material";
import { ArrowRight, Info } from "lucide-react";
import { colors } from "@/theme/tokens";

/**
 * Light post-signup screen (A6-3 rescope). The account, farm and plan are
 * already set up during the signup wizard; this is a single optional "first
 * batch" step — skip-only in V1 (no batch-create endpoint) — before the
 * dashboard.
 */
export default function OnboardingPage() {
  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Box sx={{ px: { xs: 2, sm: 4 }, pt: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: colors.primary[600] }}>
          AviCare
        </Typography>
      </Box>

      <Box
        sx={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: { xs: 2, sm: 4 },
        }}
      >
        <Box sx={{ width: "100%", maxWidth: 560 }}>
          <Stack spacing={3}>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                Bienvenue sur AviCare 🎉
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Votre compte et votre ferme sont prêts. Dernière étape : votre
                premier lot.
              </Typography>
            </Box>

            <Card sx={{ p: 3 }}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
                <Box sx={{ color: colors.info.main, mt: 0.25 }}>
                  <Info size={20} />
                </Box>
                <Typography variant="body2" color="text.secondary">
                  La création de lots sera disponible dans la prochaine version.
                  Vous pourrez créer votre premier lot depuis le menu Élevage.
                </Typography>
              </Stack>
            </Card>

            <Button
              component={Link}
              href="/dashboard"
              variant="contained"
              color="primary"
              size="large"
              endIcon={<ArrowRight size={18} />}
              sx={{ height: 48, alignSelf: "flex-start" }}
            >
              Aller au tableau de bord
            </Button>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}
