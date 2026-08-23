"use client";

import { Alert } from "@mui/material";
import PartnerNetwork from "@/components/settings/PartnerNetwork";
import { useSelectedFarm } from "@/hooks/useSelectedFarm";

export default function PartenairesPage() {
  const { farmId } = useSelectedFarm();
  if (!farmId) {
    return <Alert severity="info">Sélectionnez une ferme pour gérer votre réseau.</Alert>;
  }
  return <PartnerNetwork farmId={farmId} />;
}
