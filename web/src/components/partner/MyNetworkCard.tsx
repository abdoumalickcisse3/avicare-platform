"use client";

import Link from "next/link";
import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
import { useGetMyPartnersQuery } from "@/store/api/partnersApi";
import type { FarmPartner } from "@/types";
import { colors } from "@/theme/tokens";
import { PartnerLogo } from "./PartnerLogo";

/**
 * Co-branding block: the partners whose network this farm has joined. Renders nothing when the farm
 * has no confirmed partner — most farms have none, and an empty card would just take up room.
 * Deliberately quiet: it identifies the network, it does not advertise it.
 */
export default function MyNetworkCard({ farmId }: { farmId: number }) {
  const { data: partners = [] } = useGetMyPartnersQuery({ farmId });
  const confirmed = partners.filter((p) => p.status === "CONFIRMED");

  if (confirmed.length === 0) return null;

  return (
    <Card>
      <CardContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Mon réseau
        </Typography>
        <Stack spacing={1.5}>
          {confirmed.map((p) => (
            <Stack key={p.membershipId} direction="row" sx={{ alignItems: "center", gap: 1.5 }}>
              <PartnerLogo name={p.partnerName} logoUrl={p.partnerLogoUrl} />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {p.partnerName}
              </Typography>
            </Stack>
          ))}
        </Stack>
        <Typography
          component={Link}
          href="/reglages/partenaires"
          variant="caption"
          sx={{ display: "inline-block", mt: 1.5, color: colors.primary[600] }}
        >
          Gérer le partage
        </Typography>
      </CardContent>
    </Card>
  );
}
