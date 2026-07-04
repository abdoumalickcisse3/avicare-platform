"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Box,
  Button,
  Collapse,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import {
  BookOpen,
  Boxes,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  CreditCard,
  Drumstick,
  Egg,
  FileText,
  HeartPulse,
  LayoutDashboard,
  LayoutGrid,
  Lock,
  Receipt,
  Settings,
  ShoppingBag,
  ShoppingCart,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  Warehouse,
  Wheat,
} from "lucide-react";
import { useActiveModules } from "@/hooks/useActiveModules";
import { useCurrentFarmFocus } from "@/hooks/useCurrentFarmFocus";
import { useFarmPermissions } from "@/hooks/useFarmPermissions";
import { colors } from "@/theme/tokens";

export const SIDEBAR_WIDTH = 264;

type IconType = typeof LayoutDashboard;

interface Leaf {
  label: string;
  href: string;
  icon: IconType;
  enabled?: boolean; // default true
  requiredModule?: string;
  requiredModuleAny?: string[];
  requiredPermission?: string;
  focusToken?: "broiler" | "layer";
}
interface Group {
  key: string;
  label: string;
  icon: IconType;
  /** Group hidden unless this module is active (children share the gate). */
  requiredModule?: string;
  requiredPermission?: string;
  /** Show the "activate a module" CTA when no child is visible (Élevage). */
  emptyStateCta?: boolean;
  children: Leaf[];
}
type Entry = ({ kind: "leaf" } & Leaf) | ({ kind: "group" } & Group);
interface Section {
  heading?: string;
  entries: Entry[];
}

/**
 * Navigation (Sprint B4-8 redesign). Two collapsible groups — Élevage and
 * Stocks — gated by the selected farm's active modules (Décision 5) and, for
 * Élevage, by its production focus (Décision 17). Groups are multi-open; the
 * group owning the current route stays open. Leaves (Tableau de bord, Fermes,
 * Abonnement, Réglages) are always rendered.
 */
const NAV: Section[] = [
  {
    entries: [
      { kind: "leaf", label: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
      { kind: "leaf", label: "Fermes", href: "/fermes", icon: Warehouse },
    ],
  },
  {
    heading: "Gestion",
    entries: [
      {
        kind: "group",
        key: "elevage",
        label: "Élevage",
        icon: Drumstick,
        emptyStateCta: true,
        children: [
          {
            label: "Poulets de chair",
            href: "/elevage/lots",
            icon: Drumstick,
            requiredModule: "module.poultry.broiler",
            requiredPermission: "poultry:read",
            focusToken: "broiler",
          },
          {
            label: "Œufs",
            href: "/elevage/oeufs",
            icon: Egg,
            requiredModule: "module.poultry.layer",
            requiredPermission: "poultry:read",
            focusToken: "layer",
          },
          {
            label: "Sanitaire",
            href: "/elevage/sanitaire",
            icon: HeartPulse,
            requiredModuleAny: ["module.health.basic", "module.health.advanced"],
            requiredPermission: "health:read",
          },
        ],
      },
      {
        kind: "group",
        key: "stocks",
        label: "Stocks",
        icon: Boxes,
        requiredModule: "module.inventory",
        requiredPermission: "inventory:read",
        children: [
          { label: "Vue d'ensemble", href: "/stocks", icon: LayoutGrid },
          { label: "Bibliothèque", href: "/stocks/articles", icon: BookOpen },
          { label: "Fournisseurs", href: "/stocks/fournisseurs", icon: Truck },
          { label: "Bons d'achat", href: "/stocks/achats", icon: ClipboardList },
          { label: "Formules", href: "/stocks/formules", icon: Wheat },
        ],
      },
      {
        kind: "group",
        key: "commercial",
        label: "Commercial",
        icon: ShoppingCart,
        requiredModule: "module.commercial.basic",
        requiredPermission: "commercial:read",
        children: [
          { label: "Clients", href: "/commercial/clients", icon: Users },
          { label: "Commandes", href: "/commercial/commandes", icon: ShoppingBag },
          { label: "Ventes", href: "/commercial/ventes", icon: Receipt },
          { label: "Factures", href: "/commercial/factures", icon: FileText },
        ],
      },
      {
        kind: "group",
        key: "finance",
        label: "Finance",
        icon: Wallet,
        requiredModule: "module.finance",
        requiredPermission: "finance:read",
        children: [
          { label: "Dépenses", href: "/finance/depenses", icon: Receipt },
          { label: "Analytique", href: "/finance/analytique", icon: TrendingUp },
        ],
      },
      { kind: "leaf", label: "Abonnement", href: "/abonnement", icon: CreditCard, enabled: false },
      {
        kind: "leaf",
        label: "Réglages",
        href: "/reglages",
        icon: Settings,
        requiredPermission: "settings:read",
      },
    ],
  },
];

const ALL_HREFS = NAV.flatMap((s) =>
  s.entries.flatMap((e) => (e.kind === "group" ? e.children.map((c) => c.href) : [e.href])),
);

const HEADING_SX = {
  display: "block",
  px: 1.5,
  pt: 2,
  pb: 0.5,
  fontSize: "0.7rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: colors.neutral[400],
} as const;

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { isModuleActive, isLoading, farmId, hasFarm } = useActiveModules();
  const { can } = useFarmPermissions(farmId);
  const { focus } = useCurrentFarmFocus();
  // Groups are open by default (discoverability); track the ones the user closes.
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set());

  // The single deepest nav href that prefixes the current route — avoids both
  // "/stocks" and "/stocks/articles" lighting up at once.
  const bestMatch = ALL_HREFS.filter(
    (h) => pathname === h || pathname.startsWith(`${h}/`),
  ).sort((a, b) => b.length - a.length)[0];

  const childVisible = (c: Leaf) =>
    (!c.requiredModule || isModuleActive(c.requiredModule)) &&
    (!c.requiredModuleAny || c.requiredModuleAny.some(isModuleActive)) &&
    (!c.requiredPermission || can(c.requiredPermission)) &&
    (!c.focusToken || focus.length === 0 || focus.includes(c.focusToken));

  const toggleCollapsed = (key: string) =>
    setCollapsedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const leafButton = (item: Leaf, nested: boolean) => {
    const enabled = item.enabled !== false;
    const active = enabled && item.href === bestMatch;
    const Icon = item.icon;
    const button = (
      <ListItemButton
        selected={active}
        disabled={!enabled}
        onClick={onNavigate}
        sx={{
          borderRadius: 2,
          mb: 0.25,
          py: 0.75,
          pl: nested ? 2.75 : 1.5,
          "&.Mui-selected": {
            bgcolor: colors.primary[100],
            color: colors.primary[700],
            "& .MuiListItemIcon-root": { color: colors.primary[700] },
            "&:hover": { bgcolor: colors.primary[100] },
          },
        }}
      >
        <ListItemIcon sx={{ minWidth: nested ? 30 : 34 }}>
          <Icon size={nested ? 18 : 20} />
        </ListItemIcon>
        <ListItemText
          primary={item.label}
          slotProps={{
            primary: {
              sx: {
                fontSize: "0.9rem",
                // Hierarchy: group header (600) > top-level leaf (500) >
                // inactive sub-item (regular 400); active sub-item is bold.
                fontWeight: active ? 600 : nested ? 400 : 500,
              },
            },
          }}
        />
        {!enabled && (
          <Typography variant="caption" sx={{ color: colors.neutral[400] }}>
            bientôt
          </Typography>
        )}
      </ListItemButton>
    );
    return enabled ? (
      <Link key={item.href} href={item.href} style={{ display: "block", color: "inherit" }}>
        {button}
      </Link>
    ) : (
      <Box key={item.href}>{button}</Box>
    );
  };

  const renderGroup = (group: Group) => {
    if (group.requiredModule && !isModuleActive(group.requiredModule)) return null;
    if (group.requiredPermission && !can(group.requiredPermission)) return null;

    const visible = group.children.filter(childVisible);
    if (visible.length === 0) {
      if (!group.emptyStateCta) return null;
      return (
        <Box
          key={group.key}
          sx={{
            mx: 1,
            mb: 1,
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
            Activez un module d&apos;élevage pour commencer.
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

    const hasActiveChild = visible.some((c) => c.href === bestMatch);
    // Open by default; the active group is always open; otherwise respect the
    // user's explicit collapse.
    const open = hasActiveChild || !collapsedKeys.has(group.key);
    const Icon = group.icon;

    return (
      <Box key={group.key}>
        <ListItemButton
          onClick={() => toggleCollapsed(group.key)}
          sx={{
            borderRadius: 2,
            mb: 0.25,
            py: 0.85,
            color: hasActiveChild ? colors.primary[700] : colors.neutral[800],
            "& .MuiListItemIcon-root": {
              color: hasActiveChild ? colors.primary[600] : colors.neutral[600],
            },
          }}
        >
          <ListItemIcon sx={{ minWidth: 34 }}>
            <Icon size={20} />
          </ListItemIcon>
          <ListItemText
            primary={group.label}
            slotProps={{ primary: { sx: { fontSize: "0.9rem", fontWeight: 600 } } }}
          />
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </ListItemButton>
        <Collapse in={open} unmountOnExit>
          <List disablePadding>{visible.map((c) => leafButton(c, true))}</List>
        </Collapse>
      </Box>
    );
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
      <Box sx={{ px: 3, py: 2.5, display: "flex", alignItems: "center", gap: 1 }}>
        <Box
          sx={{
            width: 30,
            height: 30,
            borderRadius: 2,
            bgcolor: colors.primary[500],
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: colors.neutral[0],
          }}
        >
          <Drumstick size={18} />
        </Box>
        <Typography variant="h5" sx={{ fontWeight: 700, color: colors.primary[600] }}>
          AviCare
        </Typography>
      </Box>

      <Box sx={{ px: 1.5, flex: 1, overflowY: "auto" }}>
        {NAV.map((section, i) => (
          <Box key={section.heading ?? `section-${i}`} sx={{ mb: 0.5 }}>
            {section.heading && (
              <Typography variant="caption" sx={HEADING_SX}>
                {section.heading}
              </Typography>
            )}
            {isLoading && section.entries.some((e) => e.kind === "group") ? (
              <Box sx={{ px: 0.5, py: 0.5 }}>
                {Array.from({ length: 2 }).map((_, k) => (
                  <Skeleton key={k} variant="rounded" height={40} sx={{ mb: 0.5, borderRadius: 2 }} />
                ))}
              </Box>
            ) : (
              <List disablePadding>
                {section.entries.map((entry) =>
                  entry.kind === "group"
                    ? renderGroup(entry)
                    : entry.requiredPermission && !can(entry.requiredPermission)
                      ? null
                      : leafButton(entry, false),
                )}
              </List>
            )}
          </Box>
        ))}
      </Box>

      <Stack sx={{ px: 3, py: 2, borderTop: `1px solid ${colors.neutral[100]}` }}>
        <Typography variant="caption" color="text.secondary">
          AviCare V1 · Volaille
        </Typography>
      </Stack>
    </Box>
  );
}
