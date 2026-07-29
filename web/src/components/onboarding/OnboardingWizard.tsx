"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Button, LinearProgress, Stack, Typography } from "@mui/material";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { colors, radii, shadows } from "@/theme/tokens";
import { useSelectedFarm } from "@/hooks/useSelectedFarm";
import {
  ONBOARDING_STEPS,
  WELCOME_PENDING_KEY,
  type OnboardingStepId,
} from "./onboardingSteps";
import { WizardContext, type NextHandler } from "./wizardContext";
import { WelcomeStep } from "./steps/WelcomeStep";
import { FarmStep } from "./steps/FarmStep";
import { LivestockStep } from "./steps/LivestockStep";
import { CatalogReviewStep } from "./steps/CatalogReviewStep";
import { DoneStep } from "./steps/DoneStep";

const RAIL_WIDTH = 300;

/**
 * Guided post-signup wizard. The account + farm already exist; this walks the
 * owner through configuring the farm and each module (élevage, stock,
 * commercial, finance) with platform smart-defaults pre-filled, so a single
 * pass leaves the farm ready to run. Green rail + numbered timeline on the left,
 * one focused panel on the right, orange CTA in the footer.
 */
export function OnboardingWizard() {
  const router = useRouter();
  const { farmId } = useSelectedFarm();

  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [canAdvance, setCanAdvance] = useState(true);
  const [nextLabel, setNextLabel] = useState<string | null>(null);
  const nextHandlerRef = useRef<NextHandler | null>(null);

  const step = ONBOARDING_STEPS[index];
  const isFirst = index === 0;
  const isLast = index === ONBOARDING_STEPS.length - 1;

  // A step registers its commit action (persists then returns true to advance).
  const registerNext = useCallback((handler: NextHandler | null) => {
    nextHandlerRef.current = handler;
  }, []);

  const goToDashboard = useCallback(() => {
    try {
      localStorage.setItem(WELCOME_PENDING_KEY, "1");
    } catch {
      // storage may be unavailable — the popup is a nicety, not a blocker.
    }
    router.replace("/dashboard");
  }, [router]);

  const advance = useCallback(async () => {
    if (isLast) {
      goToDashboard();
      return;
    }
    const handler = nextHandlerRef.current;
    if (handler) {
      setBusy(true);
      try {
        const ok = await handler();
        if (!ok) return;
      } finally {
        setBusy(false);
      }
    }
    // Reset per-step footer state before moving on.
    nextHandlerRef.current = null;
    setCanAdvance(true);
    setNextLabel(null);
    setIndex((i) => Math.min(i + 1, ONBOARDING_STEPS.length - 1));
  }, [isLast, goToDashboard]);

  const back = useCallback(() => {
    nextHandlerRef.current = null;
    setCanAdvance(true);
    setNextLabel(null);
    setIndex((i) => Math.max(i - 1, 0));
  }, []);

  const ctx = useMemo(
    () => ({ farmId, registerNext, setCanAdvance, setNextLabel }),
    [farmId, registerNext],
  );

  const content = useMemo(() => {
    switch (step.id as OnboardingStepId) {
      case "welcome":
        return <WelcomeStep />;
      case "farm":
        return <FarmStep />;
      case "livestock":
        return <LivestockStep />;
      case "stock":
        return (
          <CatalogReviewStep
            category="inventory_items"
            title="Votre stock"
            subtitle="Vos articles de départ — aliments, consommables, équipements. Ajustez plus tard dans Réglages."
            accent="Articles pré-remplis"
            emptyHint="Aucun article pour l'instant. Vous en ajouterez depuis Stock."
          />
        );
      case "commercial":
        return (
          <CatalogReviewStep
            category="sales_channels"
            title="Votre commercial"
            subtitle="Vos circuits de vente — détail, grossiste, marché. Vos clients et prix se règlent ensuite dans Commercial."
            accent="Circuits pré-remplis"
            emptyHint="Aucun circuit pour l'instant. Vous en ajouterez depuis Commercial."
          />
        );
      case "finance":
        return (
          <CatalogReviewStep
            category="expense_categories"
            title="Vos finances"
            subtitle="Vos catégories de dépenses pour suivre les coûts dès le premier jour."
            accent="Catégories pré-remplies"
            emptyHint="Aucune catégorie pour l'instant. Vous en ajouterez depuis Finance."
          />
        );
      case "done":
        return <DoneStep />;
    }
  }, [step.id]);

  const ctaLabel = nextLabel ?? (isLast ? "Aller au tableau de bord" : "Continuer");

  return (
    <WizardContext.Provider value={ctx}>
      <Box sx={{ minHeight: "100vh", display: "flex", bgcolor: colors.neutral[50] }}>
        <Rail index={index} />

        <Box
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
          }}
        >
          {/* Compact progress — visible on mobile where the rail is hidden. */}
          <Box sx={{ display: { xs: "block", md: "none" }, px: 3, pt: 3 }}>
            <Typography
              sx={{ fontWeight: 700, color: colors.primary[600], mb: 1 }}
            >
              Étape {index + 1} / {ONBOARDING_STEPS.length} · {step.label}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={((index + 1) / ONBOARDING_STEPS.length) * 100}
              sx={{
                height: 6,
                borderRadius: radii.full,
                bgcolor: colors.neutral[200],
                "& .MuiLinearProgress-bar": { bgcolor: colors.accent[400] },
              }}
            />
          </Box>

          <Box
            sx={{
              flex: 1,
              display: "flex",
              justifyContent: "center",
              px: { xs: 3, md: 6 },
              py: { xs: 4, md: 6 },
              overflowY: "auto",
            }}
          >
            <Box sx={{ width: "100%", maxWidth: 640 }}>{content}</Box>
          </Box>

          {/* Footer: ghost Back + orange CTA. */}
          <Box
            sx={{
              borderTop: `1px solid ${colors.neutral[200]}`,
              bgcolor: colors.neutral[0],
              px: { xs: 3, md: 6 },
              py: 2.5,
            }}
          >
            <Stack
              direction="row"
              sx={{
                maxWidth: 640,
                mx: "auto",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Button
                onClick={back}
                disabled={isFirst || busy}
                startIcon={<ArrowLeft size={18} />}
                sx={{
                  color: colors.neutral[500],
                  visibility: isFirst ? "hidden" : "visible",
                  "&:hover": { bgcolor: colors.neutral[100] },
                }}
              >
                Retour
              </Button>

              <Button
                onClick={advance}
                disabled={!canAdvance || busy}
                endIcon={!isLast && <ArrowRight size={18} />}
                sx={{
                  bgcolor: colors.accent[400],
                  color: colors.neutral[0],
                  fontWeight: 700,
                  px: 3.5,
                  height: 48,
                  borderRadius: radii.lg,
                  boxShadow: shadows.sm,
                  "&:hover": { bgcolor: colors.accent[500] },
                  "&.Mui-disabled": {
                    bgcolor: colors.neutral[200],
                    color: colors.neutral[400],
                  },
                }}
              >
                {busy ? "…" : ctaLabel}
              </Button>
            </Stack>
          </Box>
        </Box>
      </Box>
    </WizardContext.Provider>
  );
}

/** Left green rail: brand + vertical numbered timeline. Hidden below md. */
function Rail({ index }: { index: number }) {
  return (
    <Box
      sx={{
        display: { xs: "none", md: "flex" },
        flexDirection: "column",
        width: RAIL_WIDTH,
        flexShrink: 0,
        px: 4,
        py: 5,
        color: colors.neutral[0],
        background: `linear-gradient(160deg, ${colors.primary[700]} 0%, ${colors.primary[900]} 100%)`,
      }}
    >
      <Typography sx={{ fontWeight: 800, fontSize: 24, letterSpacing: "-0.02em" }}>
        Jawdi
      </Typography>
      <Typography sx={{ color: colors.primary[200], fontSize: 14, mt: 0.5, mb: 5 }}>
        Configurons votre ferme
      </Typography>

      <Stack spacing={0} sx={{ flex: 1 }}>
        {ONBOARDING_STEPS.map((s, i) => {
          const done = i < index;
          const active = i === index;
          const isLast = i === ONBOARDING_STEPS.length - 1;
          return (
            <Box key={s.id} sx={{ display: "flex", gap: 1.75 }}>
              <Stack sx={{ alignItems: "center" }}>
                <Box
                  sx={{
                    width: 30,
                    height: 30,
                    borderRadius: radii.full,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    fontSize: 14,
                    fontWeight: 700,
                    transition: "all .2s",
                    bgcolor: done
                      ? colors.accent[400]
                      : active
                        ? colors.neutral[0]
                        : "rgba(255,255,255,0.12)",
                    color: done
                      ? colors.neutral[0]
                      : active
                        ? colors.primary[700]
                        : colors.primary[200],
                    boxShadow: active ? `0 0 0 4px rgba(255,255,255,0.18)` : "none",
                  }}
                >
                  {done ? <Check size={16} /> : i + 1}
                </Box>
                {!isLast && (
                  <Box
                    sx={{
                      width: 2,
                      flex: 1,
                      minHeight: 26,
                      my: 0.5,
                      bgcolor: done ? colors.accent[400] : "rgba(255,255,255,0.14)",
                    }}
                  />
                )}
              </Stack>
              <Typography
                sx={{
                  pt: 0.5,
                  pb: isLast ? 0 : 1,
                  fontSize: 15,
                  fontWeight: active ? 700 : 500,
                  color: active
                    ? colors.neutral[0]
                    : done
                      ? "rgba(255,255,255,0.85)"
                      : colors.primary[200],
                }}
              >
                {s.label}
              </Typography>
            </Box>
          );
        })}
      </Stack>

      <Typography sx={{ color: colors.primary[300], fontSize: 12, mt: 3 }}>
        Environ 2 minutes. Vous pourrez tout modifier dans Réglages.
      </Typography>
    </Box>
  );
}
