"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import { Building2, Handshake, HeartPulse, LogOut, ShieldCheck, Users } from "lucide-react";
import { useGetAdminMeQuery } from "@/store/api/adminApi";
import { adminTokenStorage } from "@/lib/adminStorage";
import { colors } from "@/theme/tokens";

interface NavEntry {
  href: string;
  label: string;
  icon: typeof Building2;
  /** Permission required to see the entry; the wildcard covers everything. */
  permission: string;
}

const NAV: NavEntry[] = [
  { href: "/console/fermes", label: "Fermes", icon: Building2, permission: "tenants:read" },
  { href: "/console/utilisateurs", label: "Utilisateurs", icon: Users, permission: "users:read" },
  { href: "/console/sante", label: "Santé", icon: HeartPulse, permission: "tenants:read" },
  { href: "/console/partenaires", label: "Partenaires", icon: Handshake, permission: "partners:read" },
];

function holds(permissions: string[], required: string): boolean {
  if (permissions.includes("*") || permissions.includes(required)) return true;
  const c = required.indexOf(":");
  return c > 0 && permissions.includes(`${required.slice(0, c)}:*`);
}

/**
 * Console shell: a permanently distinct dark header so the back-office is never mistaken for the
 * farmer app, and a navigation built from the caller's own permissions — an entry they cannot use
 * is not rendered at all.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: me } = useGetAdminMeQuery();

  const entries = useMemo(
    () => NAV.filter((e) => holds(me?.permissions ?? [], e.permission)),
    [me],
  );

  const onLogout = () => {
    adminTokenStorage.clear();
    router.replace("/console/login");
  };

  return (
    <Box sx={{ minHeight: "100dvh" }}>
      <Box sx={{ bgcolor: colors.neutral[900], color: colors.neutral[0], px: { xs: 2, md: 3 }, py: 1.5 }}>
        <Stack
          direction="row"
          sx={{ alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}
        >
          <Stack direction="row" sx={{ alignItems: "center", gap: 1.5 }}>
            <ShieldCheck size={20} />
            <Typography sx={{ fontWeight: 700 }}>Console Jawdi</Typography>
            {me?.superAdmin && (
              <Chip size="small" label="Super-admin" sx={{ bgcolor: colors.neutral[700], color: colors.neutral[0] }} />
            )}
          </Stack>
          <Stack direction="row" sx={{ alignItems: "center", gap: 2 }}>
            {entries.map((e) => {
              const Icon = e.icon;
              const active = pathname.startsWith(e.href);
              return (
                <Typography
                  key={e.href}
                  component={Link}
                  href={e.href}
                  variant="body2"
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.75,
                    color: active ? colors.neutral[0] : colors.neutral[300],
                    fontWeight: active ? 700 : 500,
                  }}
                >
                  <Icon size={16} />
                  {e.label}
                </Typography>
              );
            })}
            <Button
              size="small"
              onClick={onLogout}
              startIcon={<LogOut size={15} />}
              sx={{ color: colors.neutral[300] }}
            >
              Quitter
            </Button>
          </Stack>
        </Stack>
      </Box>

      <Box sx={{ maxWidth: 1200, mx: "auto", px: { xs: 2, md: 3 }, py: { xs: 3, md: 4 } }}>
        {children}
      </Box>
    </Box>
  );
}
