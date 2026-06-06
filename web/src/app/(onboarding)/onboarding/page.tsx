"use client";

import { useEffect, useReducer } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Button,
  Card,
  CircularProgress,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  ArrowLeft,
  ArrowRight,
  Bird,
  Check,
  Drumstick,
  Egg,
  Info,
} from "lucide-react";
import { useGetMyFarmsQuery, useCreateFarmMutation } from "@/store/api/farmsApi";
import { useGetSubscriptionQuery, useEnableModuleMutation } from "@/store/api/subscriptionApi";
import {
  ONBOARDING_SETTING_KEY,
  isOnboardingCompleted,
  useGetAccountSettingsQuery,
  useUpsertSettingMutation,
} from "@/store/api/accountSettingsApi";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
import { colors } from "@/theme/tokens";
import {
  BUNDLES,
  CUSTOM_BUNDLE_EMAIL,
  LIVESTOCK_TYPES,
  modulesForBundle,
  type LivestockType,
} from "@/constants/bundles";
import { decideResume, type WizardStep } from "./resume";

const TYPE_ICONS: Record<LivestockType, typeof Bird> = {
  BROILER: Drumstick,
  LAYER: Egg,
  MIXED: Bird,
};

interface WizardState {
  resumed: boolean;
  step: WizardStep;
  livestockType: LivestockType | null;
  farmName: string;
  location: string;
  farmId: number | null;
  selectedBundleKey: string | null;
  showErrors: boolean;
}

type Action =
  | { type: "RESUME"; step: WizardStep; farmId: number | null }
  | { type: "SET_TYPE"; value: LivestockType }
  | { type: "SET_FIELD"; field: "farmName" | "location"; value: string }
  | { type: "SET_FARM_ID"; value: number }
  | { type: "SET_BUNDLE"; value: string }
  | { type: "GOTO"; step: WizardStep }
  | { type: "SHOW_ERRORS" };

const initialState: WizardState = {
  resumed: false,
  step: 1,
  livestockType: null,
  farmName: "",
  location: "",
  farmId: null,
  selectedBundleKey: null,
  showErrors: false,
};

function reducer(state: WizardState, action: Action): WizardState {
  switch (action.type) {
    case "RESUME":
      return { ...state, resumed: true, step: action.step, farmId: action.farmId };
    case "SET_TYPE":
      return { ...state, livestockType: action.value };
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "SET_FARM_ID":
      return { ...state, farmId: action.value };
    case "SET_BUNDLE":
      return { ...state, selectedBundleKey: action.value };
    case "GOTO":
      return { ...state, step: action.step, showErrors: false };
    case "SHOW_ERRORS":
      return { ...state, showErrors: true };
    default:
      return state;
  }
}

export default function OnboardingPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [state, dispatch] = useReducer(reducer, initialState);

  const { data: farms, isLoading: farmsLoading } = useGetMyFarmsQuery();
  const { data: settings, isLoading: settingsLoading } =
    useGetAccountSettingsQuery();
  const firstFarmId = farms && farms.length > 0 ? farms[0].id : undefined;
  const { data: subscription, isLoading: subLoading } = useGetSubscriptionQuery(
    firstFarmId as number,
    { skip: firstFarmId === undefined },
  );

  const [createFarm, { isLoading: creating }] = useCreateFarmMutation();
  const [enableModule, { isLoading: enabling }] = useEnableModuleMutation();
  const [upsertSetting, { isLoading: finishing }] = useUpsertSettingMutation();

  const queriesReady =
    !farmsLoading &&
    !settingsLoading &&
    (firstFarmId === undefined || !subLoading);

  useEffect(() => {
    if (state.resumed || !queriesReady || !farms || !settings) return;
    const activeModuleCount = subscription
      ? subscription.modules.filter((m) => m.mode === "HARD").length
      : 0;
    const decision = decideResume({
      onboardingCompleted: isOnboardingCompleted(settings),
      farms,
      activeModuleCount,
    });
    if (decision.kind === "completed") {
      router.replace("/dashboard");
      return;
    }
    dispatch({ type: "RESUME", step: decision.step, farmId: decision.farmId ?? null });
  }, [state.resumed, queriesReady, farms, settings, subscription, router]);

  if (!state.resumed) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  const goToStep2 = async () => {
    if (!state.livestockType || !state.farmName.trim()) {
      dispatch({ type: "SHOW_ERRORS" });
      return;
    }
    if (state.farmId) {
      dispatch({ type: "GOTO", step: 2 });
      return;
    }
    try {
      const farm = await createFarm({
        name: state.farmName.trim(),
        location: state.location.trim() || undefined,
      }).unwrap();
      dispatch({ type: "SET_FARM_ID", value: farm.id });
      dispatch({ type: "GOTO", step: 2 });
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  const activateBundleAndContinue = async () => {
    const farmId = state.farmId;
    const bundle = BUNDLES.find((b) => b.key === state.selectedBundleKey);
    if (!bundle || !farmId) {
      dispatch({ type: "SHOW_ERRORS" });
      return;
    }
    if (bundle.custom) {
      window.location.assign(
        `mailto:${CUSTOM_BUNDLE_EMAIL}?subject=${encodeURIComponent(
          "Demande de plan sur mesure — AviCare",
        )}`,
      );
      dispatch({ type: "GOTO", step: 3 });
      return;
    }
    const modules = modulesForBundle(bundle, state.livestockType ?? "MIXED");
    try {
      // Parallel activation; if any module fails we surface the error and stay
      // on the step (onboarding is not marked complete).
      await Promise.all(
        modules.map((moduleKey) =>
          enableModule({ farmId, moduleKey }).unwrap(),
        ),
      );
      dispatch({ type: "GOTO", step: 3 });
    } catch (err) {
      showToast(
        `Échec de l'activation du plan : ${apiErrorMessage(err)}`,
        "error",
      );
    }
  };

  const finishOnboarding = async () => {
    try {
      await upsertSetting({
        key: ONBOARDING_SETTING_KEY,
        value: { completed: true },
      }).unwrap();
      router.replace("/dashboard");
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Topbar: logo + progress */}
      <Box sx={{ px: { xs: 2, sm: 4 }, pt: 3 }}>
        <Stack
          direction="row"
          sx={{ alignItems: "center", justifyContent: "space-between", mb: 1.5 }}
        >
          <Typography
            variant="h6"
            sx={{ fontWeight: 700, color: colors.primary[600] }}
          >
            AviCare
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Étape {state.step} / 3
          </Typography>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={(state.step / 3) * 100}
          sx={{ height: 6, borderRadius: 3 }}
        />
      </Box>

      {/* Step content */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          p: { xs: 2, sm: 4 },
        }}
      >
        <Box sx={{ width: "100%", maxWidth: 640, mt: { xs: 2, sm: 6 } }}>
          {state.step === 1 && (
            <Stack spacing={3}>
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  Votre exploitation
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Quel type d&apos;élevage gérez-vous ? Nous configurerons votre
                  espace en conséquence.
                </Typography>
              </Box>

              <Stack spacing={1.5}>
                {LIVESTOCK_TYPES.map((t) => {
                  const Icon = TYPE_ICONS[t.value];
                  const selected = state.livestockType === t.value;
                  return (
                    <Card
                      key={t.value}
                      onClick={() => dispatch({ type: "SET_TYPE", value: t.value })}
                      role="radio"
                      aria-checked={selected}
                      tabIndex={0}
                      sx={{
                        p: 2,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 2,
                        borderColor: selected
                          ? colors.primary[500]
                          : colors.neutral[200],
                        borderWidth: selected ? 2 : 1,
                        bgcolor: selected ? colors.primary[50] : colors.neutral[0],
                      }}
                    >
                      <Box sx={{ color: colors.primary[600] }}>
                        <Icon size={28} strokeWidth={1.75} />
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ fontWeight: 600 }}>{t.label}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {t.description}
                        </Typography>
                      </Box>
                      {selected && (
                        <Box sx={{ color: colors.primary[600] }}>
                          <Check size={20} />
                        </Box>
                      )}
                    </Card>
                  );
                })}
              </Stack>
              {state.showErrors && !state.livestockType && (
                <Typography variant="body2" color="error">
                  Veuillez choisir un type d&apos;élevage.
                </Typography>
              )}

              <TextField
                label="Nom de la ferme"
                placeholder="Ex : Ferme Avicole du Saloum"
                fullWidth
                required
                value={state.farmName}
                onChange={(e) =>
                  dispatch({ type: "SET_FIELD", field: "farmName", value: e.target.value })
                }
                error={state.showErrors && !state.farmName.trim()}
                helperText={
                  state.showErrors && !state.farmName.trim()
                    ? "Nom requis"
                    : undefined
                }
              />
              <TextField
                label="Localisation (optionnel)"
                placeholder="Ex : Thiès, Sénégal"
                fullWidth
                value={state.location}
                onChange={(e) =>
                  dispatch({ type: "SET_FIELD", field: "location", value: e.target.value })
                }
              />
            </Stack>
          )}

          {state.step === 2 && (
            <Stack spacing={3}>
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  Votre formule
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Choisissez le plan adapté à votre exploitation. Vous pourrez en
                  changer à tout moment.
                </Typography>
              </Box>

              <Stack spacing={1.5}>
                {BUNDLES.map((b) => {
                  const selected = state.selectedBundleKey === b.key;
                  return (
                    <Card
                      key={b.key}
                      onClick={() => dispatch({ type: "SET_BUNDLE", value: b.key })}
                      role="radio"
                      aria-checked={selected}
                      tabIndex={0}
                      sx={{
                        p: 2.5,
                        cursor: "pointer",
                        borderColor: selected
                          ? colors.primary[500]
                          : colors.neutral[200],
                        borderWidth: selected ? 2 : 1,
                        bgcolor: selected ? colors.primary[50] : colors.neutral[0],
                      }}
                    >
                      <Stack
                        direction="row"
                        sx={{ justifyContent: "space-between", alignItems: "baseline" }}
                      >
                        <Typography sx={{ fontWeight: 700 }}>{b.name}</Typography>
                        <Typography
                          sx={{ fontWeight: 700, color: colors.primary[700] }}
                        >
                          {b.priceLabel}
                        </Typography>
                      </Stack>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {b.description}
                      </Typography>
                      <Stack spacing={0.5}>
                        {b.features.map((f) => (
                          <Stack
                            key={f}
                            direction="row"
                            spacing={1}
                            sx={{ alignItems: "center" }}
                          >
                            <Box sx={{ color: colors.success.main, display: "flex" }}>
                              <Check size={16} />
                            </Box>
                            <Typography variant="body2">{f}</Typography>
                          </Stack>
                        ))}
                      </Stack>
                    </Card>
                  );
                })}
              </Stack>
              {state.showErrors && !state.selectedBundleKey && (
                <Typography variant="body2" color="error">
                  Veuillez sélectionner une formule.
                </Typography>
              )}
            </Stack>
          )}

          {state.step === 3 && (
            <Stack spacing={3}>
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  Votre premier lot
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Dernière étape : votre premier lot d&apos;animaux.
                </Typography>
              </Box>

              <Card sx={{ p: 3 }}>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
                  <Box sx={{ color: colors.info.main, mt: 0.25 }}>
                    <Info size={20} />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    La création de lots sera disponible dans la prochaine
                    version. Vous pourrez créer votre premier lot depuis le menu
                    Élevage.
                  </Typography>
                </Stack>
              </Card>
            </Stack>
          )}

          {/* Navigation */}
          <Stack
            direction="row"
            sx={{ justifyContent: "space-between", mt: 4 }}
          >
            <Button
              variant="text"
              color="inherit"
              startIcon={<ArrowLeft size={18} />}
              disabled={state.step === 1}
              onClick={() =>
                dispatch({ type: "GOTO", step: (state.step - 1) as WizardStep })
              }
            >
              Retour
            </Button>

            {state.step === 1 && (
              <Button
                variant="contained"
                color="primary"
                endIcon={
                  creating ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : (
                    <ArrowRight size={18} />
                  )
                }
                disabled={creating}
                onClick={goToStep2}
              >
                Continuer
              </Button>
            )}
            {state.step === 2 && (
              <Button
                variant="contained"
                color="primary"
                endIcon={
                  enabling ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : (
                    <ArrowRight size={18} />
                  )
                }
                disabled={enabling}
                onClick={activateBundleAndContinue}
              >
                Continuer
              </Button>
            )}
            {state.step === 3 && (
              <Button
                variant="contained"
                color="primary"
                disabled={finishing}
                startIcon={
                  finishing ? <CircularProgress size={16} color="inherit" /> : null
                }
                onClick={finishOnboarding}
              >
                Plus tard · Terminer
              </Button>
            )}
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}
