"use client";

import { useEffect, useMemo, useState } from "react";
import { Box, Stack, TextField, Typography } from "@mui/material";
import { Bird, Check, Egg, Layers } from "lucide-react";
import { colors, radii } from "@/theme/tokens";
import {
  useGetMyFarmsQuery,
  useUpdateFarmMutation,
} from "@/store/api/farmsApi";
import { ALL_FOCUS_TOKENS, PRODUCTION_FOCUS } from "@/constants/productionFocus";
import { useWizard } from "../wizardContext";
import { StepHeader } from "./StepHeader";

type Focus = "broiler" | "layer" | "mixed";

/**
 * The wizard asks for one answer, not a set: "Mixte" is the two tokens together. The tokens and
 * their wording come from the shared list so a new species reaches this screen and the create-farm
 * dialog at the same time.
 */
const FOCUS_ICONS = { broiler: Bird, layer: Egg } as const;

const FOCUS_OPTIONS: {
  id: Focus;
  label: string;
  hint: string;
  icon: typeof Bird;
  tokens: string[];
}[] = [
  ...PRODUCTION_FOCUS.map((o) => ({
    id: o.token as Focus,
    label: o.short,
    hint: o.hint,
    icon: FOCUS_ICONS[o.token],
    tokens: [o.token] as string[],
  })),
  {
    id: "mixed" as Focus,
    label: "Mixte",
    hint: PRODUCTION_FOCUS.map((o) => o.short).join(" et ").toLowerCase(),
    icon: Layers,
    tokens: [...ALL_FOCUS_TOKENS],
  },
];

/** Farm identity: name, location, capacity, production focus. Persists to the
 * farm created at signup via updateFarm. */
export function FarmStep() {
  const { farmId, registerNext, setCanAdvance } = useWizard();
  const { data: farms } = useGetMyFarmsQuery();
  const [updateFarm] = useUpdateFarmMutation();

  const farm = useMemo(
    () => farms?.find((f) => f.id === farmId),
    [farms, farmId],
  );

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [capacity, setCapacity] = useState("");
  const [focus, setFocus] = useState<Focus>("broiler");
  const [error, setError] = useState<string | null>(null);
  const [prefilledId, setPrefilledId] = useState<number | null>(null);

  // Prefill from the fetched farm exactly once (render-body pattern: guarded so
  // it runs a single time per farm, without an effect-driven cascade).
  if (farm && prefilledId !== farm.id) {
    setPrefilledId(farm.id);
    setName(farm.name ?? "");
    setLocation(farm.location ?? "");
    setCapacity(farm.capacity != null ? String(farm.capacity) : "");
    const f = farm.productionFocus ?? [];
    setFocus(
      f.includes("broiler") && f.includes("layer")
        ? "mixed"
        : f.includes("layer")
          ? "layer"
          : "broiler",
    );
  }

  const valid = name.trim().length > 0;

  useEffect(() => {
    setCanAdvance(valid);
  }, [valid, setCanAdvance]);

  useEffect(() => {
    registerNext(async () => {
      if (!farmId || !valid) return false;
      setError(null);
      try {
        const tokens = FOCUS_OPTIONS.find((o) => o.id === focus)!.tokens;
        await updateFarm({
          id: farmId,
          body: {
            name: name.trim(),
            location: location.trim() || undefined,
            capacity: capacity ? Number(capacity) : undefined,
            productionFocus: tokens,
          },
        }).unwrap();
        return true;
      } catch {
        setError("Enregistrement impossible. Vérifiez votre connexion et réessayez.");
        return false;
      }
    });
  }, [farmId, valid, name, location, capacity, focus, updateFarm, registerNext]);

  return (
    <Box>
      <StepHeader
        eyebrow="Étape 2 · Votre ferme"
        title="Parlez-nous de votre ferme"
        subtitle="Ces informations personnalisent vos tableaux de bord et vos alertes."
      />

      <Stack spacing={3}>
        <Field label="Nom de la ferme" required>
          <TextField
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex. Ferme Ndiaye"
            fullWidth
            size="medium"
          />
        </Field>

        <Field label="Localisation">
          <TextField
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Ex. Thiès, Sénégal"
            fullWidth
          />
        </Field>

        <Field label="Capacité (nombre de têtes)">
          <TextField
            value={capacity}
            onChange={(e) => setCapacity(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="Ex. 5 000"
            fullWidth
            slotProps={{ htmlInput: { inputMode: "numeric" } }}
          />
        </Field>

        <Field label="Type de production">
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            {FOCUS_OPTIONS.map((o) => {
              const selected = focus === o.id;
              const Icon = o.icon;
              return (
                <Box
                  key={o.id}
                  role="radio"
                  aria-checked={selected}
                  tabIndex={0}
                  onClick={() => setFocus(o.id)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setFocus(o.id)}
                  sx={{
                    flex: 1,
                    cursor: "pointer",
                    p: 2,
                    borderRadius: `${radii.lg}px`,
                    border: `1.5px solid ${selected ? colors.primary[500] : colors.neutral[200]}`,
                    bgcolor: selected ? colors.primary[50] : colors.neutral[0],
                    boxShadow: selected ? `0 1px 2px ${colors.primary[100]}` : "none",
                    transition: "border-color .15s, background-color .15s",
                    outline: "none",
                    "&:hover": {
                      borderColor: selected ? colors.primary[500] : colors.neutral[300],
                    },
                    "&:focus-visible": { boxShadow: `0 0 0 3px ${colors.primary[100]}` },
                  }}
                >
                  <Stack direction="row" sx={{ alignItems: "flex-start", justifyContent: "space-between" }}>
                    <Box
                      sx={{
                        width: 42,
                        height: 42,
                        borderRadius: `${radii.md}px`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        bgcolor: selected ? colors.primary[100] : colors.neutral[100],
                        color: selected ? colors.primary[600] : colors.neutral[500],
                        transition: "background-color .15s, color .15s",
                      }}
                    >
                      <Icon size={22} />
                    </Box>
                    <Box
                      aria-hidden
                      sx={{
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: `2px solid ${selected ? colors.primary[500] : colors.neutral[300]}`,
                        bgcolor: selected ? colors.primary[500] : "transparent",
                        transition: "all .15s",
                      }}
                    >
                      {selected && <Check size={12} color={colors.neutral[0]} strokeWidth={3} />}
                    </Box>
                  </Stack>
                  <Typography sx={{ mt: 1.5, fontWeight: 700, color: colors.neutral[800] }}>
                    {o.label}
                  </Typography>
                  <Typography sx={{ fontSize: 13, color: colors.neutral[500] }}>
                    {o.hint}
                  </Typography>
                </Box>
              );
            })}
          </Stack>
        </Field>

        {error && (
          <Typography sx={{ color: colors.error.main, fontSize: 14 }}>
            {error}
          </Typography>
        )}
      </Stack>
    </Box>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Box>
      <Typography
        sx={{ fontWeight: 600, fontSize: 14, mb: 0.75, color: colors.neutral[700] }}
      >
        {label}
        {required && <Box component="span" sx={{ color: colors.error.main }}> *</Box>}
      </Typography>
      {children}
    </Box>
  );
}
