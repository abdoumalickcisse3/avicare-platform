"use client";

import { Box, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import { useGetAdminFarmQuery, useGetAdminMeQuery, useSetFarmModuleMutation } from "@/store/api/adminApi";

function fmtDate(iso: string | null): string {
  if (!iso) return "Jamais";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card sx={{ flex: 1, minWidth: 150 }}>
      <CardContent>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5 }}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}

/** The 360° sheet: who is on the farm, what it has enabled, and who else can see it. */
/** Modules a staff member can toggle. Mirrors the platform's V1 module keys. */
const TOGGLEABLE_MODULES = [
  "poultry.broiler",
  "poultry.layer",
  "health.basic",
  "inventory",
  "commercial",
  "finance",
];

function holds(permissions: string[], required: string): boolean {
  if (permissions.includes("*") || permissions.includes(required)) return true;
  const c = required.indexOf(":");
  return c > 0 && permissions.includes(`${required.slice(0, c)}:*`);
}

export function FarmDetailPanel({ farmId }: { farmId: number }) {
  const { data: farm, isLoading } = useGetAdminFarmQuery({ farmId });
  const { data: me } = useGetAdminMeQuery();
  const [setModule] = useSetFarmModuleMutation();
  const canWrite = holds(me?.permissions ?? [], "tenants:write");

  if (isLoading) return null;
  if (!farm) {
    return (
      <Typography variant="body2" color="text.secondary">
        Ferme introuvable.
      </Typography>
    );
  }

  return (
    <Stack spacing={3}>
      <Stack direction="row" sx={{ alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {farm.name}
        </Typography>
        <Chip
          size="small"
          color={farm.active ? "success" : "default"}
          label={farm.active ? "Active" : "Inactive"}
        />
        <Typography variant="body2" color="text.secondary">
          {farm.currency} · {farm.timezone}
        </Typography>
      </Stack>

      <Stack direction="row" sx={{ gap: 2, flexWrap: "wrap" }}>
        <Stat label="Membres" value={farm.memberCount} />
        <Stat label="Lots actifs" value={farm.activeUnitCount} />
        <Stat label="Effectif" value={farm.totalHeadcount.toLocaleString("fr-FR")} />
        <Stat label="Dernière saisie" value={fmtDate(farm.lastActivityAt)} />
      </Stack>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5 }}>
            Modules activés
          </Typography>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            {TOGGLEABLE_MODULES.map((m) => {
              const enabled = farm.enabledModules.includes(m);
              return (
                <Chip
                  key={m}
                  size="small"
                  label={m}
                  color={enabled ? "success" : "default"}
                  variant={enabled ? "filled" : "outlined"}
                  onClick={
                    canWrite
                      ? () => setModule({ farmId, moduleKey: m, enabled: !enabled })
                      : undefined
                  }
                />
              );
            })}
          </Box>
          {!canWrite && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
              Lecture seule — permission tenants:write requise.
            </Typography>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5 }}>
            Réseaux partenaires
          </Typography>
          {farm.partners.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Cette ferme n&apos;a rejoint aucun réseau.
            </Typography>
          ) : (
            <Stack spacing={1}>
              {farm.partners.map((p) => (
                <Stack
                  key={p.partnerId}
                  direction="row"
                  sx={{ alignItems: "center", gap: 1.5, flexWrap: "wrap" }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {p.partnerName ?? `Partenaire #${p.partnerId}`}
                  </Typography>
                  {p.type && <Chip size="small" variant="outlined" label={p.type} />}
                  <Chip
                    size="small"
                    color={p.status === "CONFIRMED" ? "success" : "default"}
                    label={p.status}
                  />
                </Stack>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}
