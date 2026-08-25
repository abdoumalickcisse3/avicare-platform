"use client";

import { useState } from "react";
import Link from "next/link";
import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
import { useGetMyPartnersQuery } from "@/store/api/partnersApi";
import type { FarmPartner } from "@/types";
import { colors } from "@/theme/tokens";

/** Partner logo, falling back to the initial when there is no URL or the image fails to load. */
function PartnerLogo({ partner }: { partner: FarmPartner }) {
  const [broken, setBroken] = useState(false);
  const initial = (partner.partnerName ?? "?").charAt(0).toUpperCase();

  const frame = {
    width: 36,
    height: 36,
    borderRadius: 1.5,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    bgcolor: colors.primary[50],
    color: colors.primary[600],
  };

  if (!partner.partnerLogoUrl || broken) {
    return (
      <Box sx={{ ...frame, fontWeight: 700 }} aria-hidden>
        {initial}
      </Box>
    );
  }

  return (
    <Box sx={frame}>
      <Box
        component="img"
        src={partner.partnerLogoUrl}
        alt={partner.partnerName ?? ""}
        onError={() => setBroken(true)}
        sx={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
    </Box>
  );
}

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
              <PartnerLogo partner={p} />
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
