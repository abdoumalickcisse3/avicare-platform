"use client";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { Check } from "lucide-react";
import {
  useCreateChangeRequestMutation,
  useGetSubscriptionQuery,
  useListChangeRequestsQuery,
  useSubmitChangeRequestMutation,
} from "@/store/api/subscriptionApi";
import { apiErrorMessage } from "@/lib/apiError";
import { useToast } from "@/components/feedback/ToastProvider";
import { formatDate } from "@/lib/format";
import { colors } from "@/theme/tokens";
import {
  BUNDLES,
  CUSTOM_BUNDLE_EMAIL,
  bundlePriceLabel,
  moduleLabel,
  type Bundle,
} from "@/constants/bundles";
import type { SubscriptionStatus } from "@/types";

const STATUS_META: Record<
  SubscriptionStatus,
  { label: string; bg: string; fg: string }
> = {
  TRIAL: { label: "Essai", bg: colors.accent[50], fg: colors.accent[700] },
  ACTIVE: { label: "Actif", bg: colors.success.light, fg: colors.success.dark },
  EXPIRED: { label: "Expiré", bg: colors.error.light, fg: colors.error.dark },
  SUSPENDED: { label: "Suspendu", bg: colors.warning.light, fg: colors.warning.dark },
  CANCELLED: { label: "Annulé", bg: colors.neutral[200], fg: colors.neutral[700] },
};

export function FarmSubscriptionTab({ farmId }: { farmId: number }) {
  const { data: subscription, isLoading, error } = useGetSubscriptionQuery(farmId);
  const { data: changeRequests } = useListChangeRequestsQuery(farmId);
  const [createChangeRequest, { isLoading: creating }] =
    useCreateChangeRequestMutation();
  const [submitChangeRequest, { isLoading: submitting }] =
    useSubmitChangeRequestMutation();
  const { showToast } = useToast();

  const pending = changeRequests?.find(
    (cr) => cr.status === "SUBMITTED" || cr.status === "DRAFT",
  );
  const requesting = creating || submitting;

  const requestBundle = async (bundle: Bundle) => {
    if (bundle.custom) {
      window.location.assign(
        `mailto:${CUSTOM_BUNDLE_EMAIL}?subject=${encodeURIComponent(
          "Demande de plan sur mesure — AviCare",
        )}`,
      );
      return;
    }
    try {
      const cr = await createChangeRequest({
        farmId,
        requestedPlan: bundle.key,
        requestedModules: bundle.modules,
      }).unwrap();
      await submitChangeRequest({ farmId, requestId: cr.id }).unwrap();
      showToast("Demande de changement envoyée.", "success");
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  if (isLoading) {
    return <Skeleton variant="rectangular" height={240} sx={{ borderRadius: 2 }} />;
  }
  if (error || !subscription) {
    return (
      <Alert severity="error">
        {error ? apiErrorMessage(error) : "Abonnement introuvable."}
      </Alert>
    );
  }

  const status = STATUS_META[subscription.status];
  const activeModules = subscription.modules.filter((m) => m.mode === "HARD");

  return (
    <Stack spacing={3}>
      {/* Current plan */}
      <Card>
        <CardContent>
          <Stack
            direction="row"
            spacing={1.5}
            sx={{ alignItems: "center", mb: 0.5 }}
          >
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Plan actuel
            </Typography>
            <Chip
              label={status.label}
              size="small"
              sx={{ bgcolor: status.bg, color: status.fg, fontWeight: 600 }}
            />
          </Stack>
          <Typography variant="body1">
            {subscription.planKey
              ? (BUNDLES.find((b) => b.key === subscription.planKey)?.name ??
                subscription.planKey)
              : "Essai gratuit"}
          </Typography>
          {subscription.status === "TRIAL" && subscription.expiresAt && (
            <Typography variant="body2" color="text.secondary">
              Expire le {formatDate(subscription.expiresAt)}
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Active modules */}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5 }}>
            Modules activés
          </Typography>
          {activeModules.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Aucun module activé pour le moment.
            </Typography>
          ) : (
            <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
              {activeModules.map((m) => (
                <Chip
                  key={m.moduleKey}
                  label={moduleLabel(m.moduleKey)}
                  size="small"
                  sx={{ bgcolor: colors.primary[50], color: colors.primary[700] }}
                />
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>

      {/* Change plan */}
      <Box>
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ alignItems: "center", mb: 1.5 }}
        >
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Changer de plan
          </Typography>
          {pending && (
            <Chip
              label="Demande en attente d'approbation"
              size="small"
              sx={{
                bgcolor: colors.warning.light,
                color: colors.warning.dark,
                fontWeight: 600,
              }}
            />
          )}
        </Stack>
        <Box
          sx={{
            display: "grid",
            gap: { xs: 2, md: 3 },
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" },
          }}
        >
          {BUNDLES.map((bundle) => {
            const isCurrent = subscription.planKey === bundle.key;
            return (
              <Card key={bundle.key} sx={{ display: "flex", flexDirection: "column" }}>
                <CardContent sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
                  <Typography sx={{ fontWeight: 700 }}>{bundle.name}</Typography>
                  <Typography
                    sx={{ fontWeight: 700, color: colors.primary[700], mb: 1 }}
                  >
                    {bundlePriceLabel(bundle)}
                  </Typography>
                  <Stack spacing={0.5} sx={{ flex: 1, mb: 2 }}>
                    {bundle.features.map((f) => (
                      <Stack key={f} direction="row" spacing={1} sx={{ alignItems: "center" }}>
                        <Box sx={{ color: colors.success.main, display: "flex" }}>
                          <Check size={14} />
                        </Box>
                        <Typography variant="body2">{f}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                  <Button
                    variant={bundle.custom ? "outlined" : "contained"}
                    color="primary"
                    fullWidth
                    disabled={isCurrent || (!bundle.custom && (requesting || Boolean(pending)))}
                    onClick={() => requestBundle(bundle)}
                  >
                    {isCurrent
                      ? "Plan actuel"
                      : bundle.custom
                        ? "Contacter un expert"
                        : "Demander ce plan"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </Box>
      </Box>
    </Stack>
  );
}
