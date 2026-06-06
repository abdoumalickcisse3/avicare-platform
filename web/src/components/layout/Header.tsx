"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AppBar,
  Avatar,
  Box,
  IconButton,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
} from "@mui/material";
import { LogOut, Menu as MenuIcon } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { clearAuth } from "@/store/slices/authSlice";
import { colors } from "@/theme/tokens";

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
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.currentUser);
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);

  const handleLogout = () => {
    setAnchor(null);
    dispatch(clearAuth());
    router.replace("/login");
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
      <Toolbar>
        <IconButton
          edge="start"
          aria-label="Ouvrir le menu"
          onClick={onMenuClick}
          sx={{ mr: 1, display: { md: "none" } }}
        >
          <MenuIcon size={22} />
        </IconButton>

        <Box sx={{ flex: 1 }} />

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mr: 1.5, display: { xs: "none", sm: "block" } }}
        >
          {user?.fullName ?? ""}
        </Typography>
        <IconButton
          onClick={(e) => setAnchor(e.currentTarget)}
          aria-label="Compte"
        >
          <Avatar
            sx={{
              width: 34,
              height: 34,
              bgcolor: colors.primary[500],
              fontSize: "0.85rem",
            }}
          >
            {initials(user?.fullName)}
          </Avatar>
        </IconButton>
        <Menu
          anchorEl={anchor}
          open={Boolean(anchor)}
          onClose={() => setAnchor(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
        >
          <MenuItem onClick={handleLogout}>
            <LogOut size={16} style={{ marginRight: 8 }} />
            Se déconnecter
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
}
