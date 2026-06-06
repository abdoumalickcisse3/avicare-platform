"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import {
  Bird,
  CreditCard,
  LayoutDashboard,
  Settings,
  Users,
  Warehouse,
} from "lucide-react";
import { colors } from "@/theme/tokens";

export const SIDEBAR_WIDTH = 260;

interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  enabled: boolean;
}

/** Nav skeleton — only the dashboard is live in A6-1; the rest land in A6-2/A6-3. */
const NAV_ITEMS: NavItem[] = [
  { label: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard, enabled: true },
  { label: "Fermes", href: "/farms", icon: Warehouse, enabled: false },
  { label: "Équipe", href: "/team", icon: Users, enabled: false },
  { label: "Élevage", href: "/livestock", icon: Bird, enabled: false },
  { label: "Abonnement", href: "/subscription", icon: CreditCard, enabled: false },
  { label: "Paramètres", href: "/settings", icon: Settings, enabled: false },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        bgcolor: colors.neutral[0],
        borderRight: `1px solid ${colors.neutral[200]}`,
      }}
    >
      <Box sx={{ px: 3, py: 2.5 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: colors.primary[600] }}>
          AviCare
        </Typography>
      </Box>

      <List sx={{ px: 1.5, flex: 1 }}>
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          const button = (
            <ListItemButton
              selected={active}
              disabled={!item.enabled}
              onClick={onNavigate}
              sx={{
                borderRadius: 2,
                mb: 0.5,
                "&.Mui-selected": {
                  bgcolor: colors.primary[50],
                  color: colors.primary[700],
                  "& .MuiListItemIcon-root": { color: colors.primary[600] },
                  "&:hover": { bgcolor: colors.primary[100] },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                <Icon size={20} />
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                slotProps={{
                  primary: { sx: { fontSize: "0.9rem", fontWeight: 500 } },
                }}
              />
            </ListItemButton>
          );

          return item.enabled ? (
            <Link
              key={item.href}
              href={item.href}
              style={{ display: "block", color: "inherit" }}
            >
              {button}
            </Link>
          ) : (
            <Box key={item.href}>{button}</Box>
          );
        })}
      </List>

      <Stack sx={{ px: 3, py: 2 }}>
        <Typography variant="caption" color="text.secondary">
          AviCare V1 · Volaille
        </Typography>
      </Stack>
    </Box>
  );
}
