"use client";

import { Alert, Box, CircularProgress, Typography } from "@mui/material";
import { useSelectedFarm } from "@/hooks/useSelectedFarm";
import { useFarmRole } from "@/hooks/useFarmRole";
import { FarmIdentityCard } from "@/components/settings/FarmIdentityCard";

/**
 * L'identité commerciale de l'exploitation : logo, NINEA, registre du commerce.
 *
 * Réservée au propriétaire — le backend garde l'écriture du logo sur OWNER seul,
 * et une garde de façade qui n'épouserait pas celle du serveur mentirait à
 * l'utilisateur. Un gérant peut lire ces informations partout ailleurs (elles
 * s'impriment sur les factures qu'il édite), il ne peut pas les changer.
 */
export default function FarmIdentitySettingsPage() {
  const { farmId, isLoading } = useSelectedFarm();
  const role = useFarmRole(farmId);

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!farmId) {
    return <Alert severity="info">Créez d&apos;abord une ferme.</Alert>;
  }

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Identité
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Ce que vos clients voient sur vos documents.
        </Typography>
      </Box>

      {role === "OWNER" ? (
        <FarmIdentityCard farmId={farmId} />
      ) : (
        <Alert severity="info">
          Seul le propriétaire de l&apos;exploitation peut modifier son logo et ses mentions légales.
        </Alert>
      )}
    </Box>
  );
}
