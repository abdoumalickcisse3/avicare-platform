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
  Drumstick,
  Egg,
  LayoutDashboard,
  Settings,
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

interface NavSection {
  heading?: string;
  items: NavItem[];
}

/**
 * Navigation. Dashboard and Fermes are live in A6-2; the Élevage items are
 * Phase B placeholders, Abonnement/Paramètres land in A6-3.
 */
const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { label: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard, enabled: true },
      { label: "Fermes", href: "/fermes", icon: Warehouse, enabled: true },
    ],
  },
  {
    heading: "Élevage",
    items: [
      { label: "Lots", href: "/elevage/lots", icon: Bird, enabled: false },
      { label: "Œufs", href: "/elevage/oeufs", icon: Egg, enabled: false },
      { label: "Poulets de chair", href: "/elevage/chair", icon: Drumstick, enabled: false },
    ],
  },
  {
    heading: "Gestion",
    items: [
      { label: "Abonnement", href: "/abonnement", icon: CreditCard, enabled: false },
      { label: "Réglages", href: "/reglages", icon: Settings, enabled: true },
    ],
  },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

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

      <Box sx={{ px: 1.5, flex: 1, overflowY: "auto" }}>
        {NAV_SECTIONS.map((section, i) => (
          <Box key={section.heading ?? `section-${i}`} sx={{ mb: 1 }}>
            {section.heading && (
              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  px: 1.5,
                  pt: 1.5,
                  pb: 0.5,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: colors.neutral[500],
                }}
              >
                {section.heading}
              </Typography>
            )}
            <List disablePadding>
              {section.items.map((item) => {
                const active = item.enabled && isActive(item.href);
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
                        bgcolor: colors.primary[100],
                        color: colors.primary[700],
                        "& .MuiListItemIcon-root": { color: colors.primary[700] },
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
          </Box>
        ))}
      </Box>

      <Stack sx={{ px: 3, py: 2 }}>
        <Typography variant="caption" color="text.secondary">
          AviCare V1 · Volaille
        </Typography>
      </Stack>
    </Box>
  );
}
