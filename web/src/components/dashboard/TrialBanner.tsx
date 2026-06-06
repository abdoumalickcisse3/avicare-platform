"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Box, Button, IconButton, Stack, Typography } from "@mui/material";
import { Sparkles, X } from "lucide-react";
import { useAppSelector } from "@/store/hooks";
import { useGetMyFarmsQuery } from "@/store/api/farmsApi";
import { useGetSubscriptionQuery } from "@/store/api/subscriptionApi";
import { getCookie, setCookie } from "@/lib/cookies";
import { colors } from "@/theme/tokens";

const DISMISS_COOKIE = "avicare_trial_banner_dismissed";
const DISMISS_MAX_AGE = 24 * 60 * 60; // 24h

function remainingDays(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

/**
 * Dashboard banner. Shows trial status for the selected (or first) farm and a
 * link to its subscription tab; dismissible for 24h via cookie. If the user has
 * no farm yet (onboarding interrupted), nudges them back to /onboarding instead.
 */
export function TrialBanner() {
  const selectedFarmId = useAppSelector((s) => s.ui.selectedFarmId);
  const { data: farms } = useGetMyFarmsQuery();
  const farmId = selectedFarmId ?? (farms && farms.length > 0 ? farms[0].id : undefined);
  const { data: subscription } = useGetSubscriptionQuery(farmId as number, {
    skip: farmId === undefined,
  });

  // Read the dismiss cookie client-only (server snapshot = false) to avoid a
  // hydration mismatch without calling setState inside an effect.
  const cookieDismissed = useSyncExternalStore(
    () => () => {},
    () => getCookie(DISMISS_COOKIE) === "1",
    () => false,
  );
  const [locallyDismissed, setLocallyDismissed] = useState(false);
  const dismissed = cookieDismissed || locallyDismissed;

  if (!farms) return null;

  // No farm yet → onboarding nudge (no trial banner).
  if (farms.length === 0) {
    return (
      <Banner
        bg={colors.primary[50]}
        text={colors.primary[800]}
        icon={<Sparkles size={20} />}
        message="Terminez la configuration de votre exploitation."
        action={
          <Button component={Link} href="/onboarding" variant="contained" color="primary" size="small">
            Compléter l&apos;onboarding
          </Button>
        }
      />
    );
  }

  if (dismissed || !subscription || subscription.status !== "TRIAL") return null;

  const days = remainingDays(subscription.expiresAt);
  const message =
    days != null
      ? `Il vous reste ${days} jour${days > 1 ? "s" : ""} d'essai gratuit.`
      : "Vous êtes en période d'essai gratuit.";

  const handleDismiss = () => {
    setCookie(DISMISS_COOKIE, "1", DISMISS_MAX_AGE);
    setLocallyDismissed(true);
  };

  return (
    <Banner
      bg={colors.accent[50]}
      text={colors.accent[700]}
      icon={<Sparkles size={20} />}
      message={message}
      action={
        <Button
          component={Link}
          href={`/fermes/${farmId}?tab=subscription`}
          variant="contained"
          color="primary"
          size="small"
        >
          Choisir un plan
        </Button>
      }
      onDismiss={handleDismiss}
    />
  );
}

function Banner({
  bg,
  text,
  icon,
  message,
  action,
  onDismiss,
}: {
  bg: string;
  text: string;
  icon: React.ReactNode;
  message: string;
  action: React.ReactNode;
  onDismiss?: () => void;
}) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={1.5}
      sx={{
        alignItems: { sm: "center" },
        justifyContent: "space-between",
        bgcolor: bg,
        color: text,
        borderRadius: 3,
        px: 2.5,
        py: 1.5,
      }}
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
        <Box sx={{ display: "flex" }}>{icon}</Box>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {message}
        </Typography>
      </Stack>
      <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
        {action}
        {onDismiss && (
          <IconButton aria-label="Masquer" size="small" onClick={onDismiss} sx={{ color: text }}>
            <X size={18} />
          </IconButton>
        )}
      </Stack>
    </Stack>
  );
}
