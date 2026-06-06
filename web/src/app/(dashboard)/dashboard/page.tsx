"use client";

import { useEffect } from "react";
import {
  Box,
  Card,
  CardContent,
  CircularProgress,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { Bird, CreditCard, TrendingUp, Warehouse } from "lucide-react";
import { useGetProfileQuery } from "@/store/api/authApi";
import { useAppDispatch } from "@/store/hooks";
import { setCurrentUser } from "@/store/slices/authSlice";
import { colors } from "@/theme/tokens";

interface Stat {
  label: string;
  value: string;
  icon: typeof Bird;
  tint: string;
}

const STATS: Stat[] = [
  { label: "Fermes", value: "—", icon: Warehouse, tint: colors.primary[500] },
  { label: "Bandes actives", value: "—", icon: Bird, tint: colors.accent[400] },
  { label: "Performance", value: "—", icon: TrendingUp, tint: colors.info.main },
  { label: "Abonnement", value: "—", icon: CreditCard, tint: colors.success.main },
];

export default function DashboardPage() {
  const dispatch = useAppDispatch();
  const { data: profile, isLoading } = useGetProfileQuery();

  useEffect(() => {
    if (profile) dispatch(setCurrentUser(profile));
  }, [profile, dispatch]);

  return (
    <Stack spacing={4}>
      <Box>
        {isLoading ? (
          <Skeleton variant="text" width={280} height={40} />
        ) : (
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Bienvenue{profile?.fullName ? `, ${profile.fullName}` : ""}
          </Typography>
        )}
        <Typography variant="body1" color="text.secondary">
          Voici un aperçu de votre activité.
        </Typography>
      </Box>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, 1fr)",
            lg: "repeat(4, 1fr)",
          },
        }}
      >
        {STATS.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent>
                <Stack
                  direction="row"
                  sx={{
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      {stat.label}
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>
                      {stat.value}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: 2,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      bgcolor: `${stat.tint}1A`,
                      color: stat.tint,
                    }}
                  >
                    <Icon size={22} />
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          );
        })}
      </Box>

      <Card>
        <CardContent>
          <Stack
            spacing={1.5}
            sx={{ py: 6, textAlign: "center", alignItems: "center" }}
          >
            {isLoading ? (
              <CircularProgress size={28} />
            ) : (
              <>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Bientôt disponible
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ maxWidth: 420 }}
                >
                  La gestion des fermes, de l&apos;équipe et de vos bandes arrive
                  dans les prochaines mises à jour.
                </Typography>
              </>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
