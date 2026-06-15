"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  AppBar,
  Avatar,
  Badge,
  Box,
  Button,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import { Bell, Check, ChevronDown, LogOut, Menu as MenuIcon, Warehouse } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { clearAuth } from "@/store/slices/authSlice";
import { setSelectedFarmId } from "@/store/slices/uiSlice";
import { useSelectedFarm } from "@/hooks/useSelectedFarm";
import { useGetMyFarmsQuery } from "@/store/api/farmsApi";
import { colors } from "@/theme/tokens";

/** Longest-prefix → page title (+ parent crumb) for the header context label. */
const PAGE_TITLES: { prefix: string; label: string; parent?: string }[] = [
  { prefix: "/dashboard", label: "Tableau de bord" },
  { prefix: "/fermes", label: "Fermes" },
  { prefix: "/elevage/lots", label: "Poulets de chair", parent: "Élevage" },
  { prefix: "/elevage/oeufs", label: "Œufs", parent: "Élevage" },
  { prefix: "/elevage/sanitaire", label: "Sanitaire", parent: "Élevage" },
  { prefix: "/stocks/articles", label: "Bibliothèque", parent: "Stocks" },
  { prefix: "/stocks/fournisseurs", label: "Fournisseurs", parent: "Stocks" },
  { prefix: "/stocks/achats", label: "Bons d'achat", parent: "Stocks" },
  { prefix: "/stocks/formules", label: "Formules", parent: "Stocks" },
  { prefix: "/stocks", label: "Vue d'ensemble", parent: "Stocks" },
  { prefix: "/reglages", label: "Réglages" },
  { prefix: "/abonnement", label: "Abonnement" },
];

const MENU_LABEL_SX = {
  px: 2,
  py: 0.5,
  fontSize: "0.7rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: colors.neutral[400],
} as const;

function initials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.currentUser);
  const { farmId } = useSelectedFarm();
  const { data: farms = [] } = useGetMyFarmsQuery();

  const [accountAnchor, setAccountAnchor] = useState<null | HTMLElement>(null);
  const [farmAnchor, setFarmAnchor] = useState<null | HTMLElement>(null);

  const page = PAGE_TITLES.filter(
    (p) => pathname === p.prefix || pathname.startsWith(`${p.prefix}/`),
  ).sort((a, b) => b.prefix.length - a.prefix.length)[0];
  const currentFarm = farms.find((f) => f.id === farmId);

  const handleLogout = () => {
    setAccountAnchor(null);
    dispatch(clearAuth());
    router.replace("/login");
  };
  const pickFarm = (id: number) => {
    dispatch(setSelectedFarmId(id));
    setFarmAnchor(null);
  };

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        bgcolor: colors.neutral[0],
        color: colors.neutral[800],
        borderBottom: `1px solid ${colors.neutral[200]}`,
      }}
    >
      <Toolbar sx={{ minHeight: { xs: 60, md: 64 }, gap: 1 }}>
        <IconButton
          edge="start"
          aria-label="Ouvrir le menu"
          onClick={onMenuClick}
          sx={{ mr: 0.5, display: { md: "none" } }}
        >
          <MenuIcon size={22} />
        </IconButton>

        {/* Page context */}
        <Box sx={{ minWidth: 0 }}>
          {page?.parent && (
            <Typography variant="caption" sx={{ color: colors.neutral[500], lineHeight: 1 }}>
              {page.parent}
            </Typography>
          )}
          <Typography variant="h6" noWrap sx={{ fontWeight: 700, fontSize: "1.05rem", lineHeight: 1.2 }}>
            {page?.label ?? "AviCare"}
          </Typography>
        </Box>

        <Box sx={{ flex: 1 }} />

        {/* Farm selector */}
        {currentFarm && (
          <>
            <Button
              onClick={(e) => setFarmAnchor(e.currentTarget)}
              startIcon={<Warehouse size={18} />}
              endIcon={<ChevronDown size={16} />}
              sx={{
                color: colors.neutral[700],
                bgcolor: colors.neutral[50],
                border: `1px solid ${colors.neutral[200]}`,
                px: 1.5,
                maxWidth: { xs: 140, sm: 240 },
                "& .MuiButton-endIcon": { ml: 0.5 },
              }}
            >
              <Typography
                noWrap
                sx={{ fontWeight: 600, fontSize: "0.875rem", display: { xs: "none", sm: "block" } }}
              >
                {currentFarm.name}
              </Typography>
              <Typography
                noWrap
                sx={{ fontWeight: 600, fontSize: "0.875rem", display: { xs: "block", sm: "none" } }}
              >
                Ferme
              </Typography>
            </Button>
            <Menu
              anchorEl={farmAnchor}
              open={Boolean(farmAnchor)}
              onClose={() => setFarmAnchor(null)}
              anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
              transformOrigin={{ vertical: "top", horizontal: "right" }}
            >
              <Typography sx={MENU_LABEL_SX}>Mes fermes</Typography>
              {farms.map((f) => (
                <MenuItem key={f.id} selected={f.id === farmId} onClick={() => pickFarm(f.id)}>
                  <Box sx={{ flex: 1 }}>{f.name}</Box>
                  {f.id === farmId && (
                    <Check size={16} color={colors.primary[600]} style={{ marginLeft: 12 }} />
                  )}
                </MenuItem>
              ))}
            </Menu>
          </>
        )}

        {/* Notifications (placeholder — Sprint C1) */}
        <Tooltip title="Notifications — bientôt disponible">
          <span>
            <IconButton aria-label="Notifications" sx={{ color: colors.neutral[600] }}>
              <Badge variant="dot" color="secondary" invisible>
                <Bell size={20} />
              </Badge>
            </IconButton>
          </span>
        </Tooltip>

        {/* Account */}
        <IconButton onClick={(e) => setAccountAnchor(e.currentTarget)} aria-label="Compte" sx={{ p: 0.5 }}>
          <Avatar sx={{ width: 34, height: 34, bgcolor: colors.primary[500], fontSize: "0.85rem" }}>
            {initials(user?.fullName)}
          </Avatar>
        </IconButton>
        <Menu
          anchorEl={accountAnchor}
          open={Boolean(accountAnchor)}
          onClose={() => setAccountAnchor(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
          slotProps={{ paper: { sx: { minWidth: 220 } } }}
        >
          <Box sx={{ px: 2, py: 1 }}>
            <Typography sx={{ fontWeight: 600 }} noWrap>
              {user?.fullName ?? "—"}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
              {user?.email ?? ""}
            </Typography>
          </Box>
          <Divider />
          <MenuItem onClick={handleLogout}>
            <LogOut size={16} style={{ marginRight: 8 }} />
            Se déconnecter
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
}
