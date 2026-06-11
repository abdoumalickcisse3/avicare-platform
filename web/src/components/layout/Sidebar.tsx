"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Box,
  Button,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import {
  Bird,
  CreditCard,
  Drumstick,
  Egg,
  LayoutDashboard,
  Lock,
  Settings,
  Warehouse,
} from "lucide-react";
import { useActiveModules } from "@/hooks/useActiveModules";
import { useCurrentFarmFocus } from "@/hooks/useCurrentFarmFocus";
import { colors } from "@/theme/tokens";

export const SIDEBAR_WIDTH = 260;

interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  enabled: boolean;
  /** When set, the item only shows if this subscription module is active. */
  requiredModule?: string;
  /** When set, also requires the current farm's production focus (Décision 17). */
  focusToken?: "broiler" | "layer";
}

interface NavSection {
  heading?: string;
  items: NavItem[];
  /** Élevage section is gated by active modules and shows an empty-state CTA. */
  moduleGated?: boolean;
}

/**
 * Navigation. The "Élevage" items are filtered by the active subscription
 * modules of the selected farm (Décision 5: no farm.type — a farm's nature is
 * its active modules). Fermes, Tableau de bord, Abonnement and Réglages are
 * always visible.
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
    moduleGated: true,
    items: [
      {
        label: "Lots",
        href: "/elevage/lots",
        icon: Bird,
        enabled: true,
        requiredModule: "module.poultry.broiler",
        focusToken: "broiler",
      },
      {
        label: "Œufs",
        href: "/elevage/oeufs",
        icon: Egg,
        enabled: true,
        requiredModule: "module.poultry.layer",
        focusToken: "layer",
      },
      {
        label: "Poulets de chair",
        href: "/elevage/chair",
        icon: Drumstick,
        enabled: false,
        requiredModule: "module.poultry.broiler",
        focusToken: "broiler",
      },
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

const HEADING_SX = {
  display: "block",
  px: 1.5,
  pt: 1.5,
  pb: 0.5,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: colors.neutral[500],
} as const;

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { isModuleActive, isLoading, farmId, hasFarm } = useActiveModules();
  const { focus } = useCurrentFarmFocus();

  // An item passes the métier filter if the current farm's focus includes its
  // token — or if the farm has no explicit focus (empty = don't filter).
  const inFarmFocus = (item: NavItem) =>
    !item.focusToken || focus.length === 0 || focus.includes(item.focusToken);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const renderItem = (item: NavItem) => {
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
          slotProps={{ primary: { sx: { fontSize: "0.9rem", fontWeight: 500 } } }}
        />
      </ListItemButton>
    );

    return item.enabled ? (
      <Link key={item.href} href={item.href} style={{ display: "block", color: "inherit" }}>
        {button}
      </Link>
    ) : (
      <Box key={item.href}>{button}</Box>
    );
  };

  const renderModuleGated = (section: NavSection) => {
    if (isLoading) {
      return (
        <Box sx={{ px: 1, py: 0.5 }}>
          {section.items.map((_, i) => (
            <Skeleton
              key={i}
              variant="rounded"
              height={40}
              sx={{ mb: 0.5, borderRadius: 2 }}
            />
          ))}
        </Box>
      );
    }

    const visible = section.items.filter(
      (it) =>
        (!it.requiredModule || isModuleActive(it.requiredModule)) && inFarmFocus(it),
    );

    if (visible.length === 0) {
      return (
        <Box
          sx={{
            mx: 1,
            p: 2,
            textAlign: "center",
            border: `1px dashed ${colors.neutral[300]}`,
            borderRadius: 2,
          }}
        >
          <Box sx={{ color: colors.neutral[400], mb: 0.5 }}>
            <Lock size={20} />
          </Box>
          <Typography variant="caption" sx={{ display: "block", color: colors.neutral[600], mb: 1 }}>
            Activez un module pour commencer.
          </Typography>
          <Button
            component={Link}
            href={hasFarm ? `/fermes/${farmId}?tab=subscription` : "/fermes"}
            onClick={onNavigate}
            size="small"
            variant="outlined"
            color="primary"
            fullWidth
          >
            Activer des modules
          </Button>
        </Box>
      );
    }

    return <List disablePadding>{visible.map(renderItem)}</List>;
  };

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
              <Typography variant="caption" sx={HEADING_SX}>
                {section.heading}
              </Typography>
            )}
            {section.moduleGated ? (
              renderModuleGated(section)
            ) : (
              <List disablePadding>{section.items.map(renderItem)}</List>
            )}
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
