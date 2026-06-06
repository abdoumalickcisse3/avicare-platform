"use client";

import { useState } from "react";
import { Box, Drawer } from "@mui/material";
import { Header } from "./Header";
import { Sidebar, SIDEBAR_WIDTH } from "./Sidebar";
import { colors } from "@/theme/tokens";

/** Responsive app shell: permanent sidebar on md+, temporary drawer on mobile. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: colors.neutral[50] }}>
      {/* Permanent sidebar — desktop */}
      <Box
        component="nav"
        sx={{
          width: { md: SIDEBAR_WIDTH },
          flexShrink: { md: 0 },
          display: { xs: "none", md: "block" },
        }}
      >
        <Box sx={{ position: "fixed", width: SIDEBAR_WIDTH, height: "100vh" }}>
          <Sidebar />
        </Box>
      </Box>

      {/* Temporary drawer — mobile */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": { width: SIDEBAR_WIDTH, boxSizing: "border-box" },
        }}
      >
        <Sidebar onNavigate={() => setMobileOpen(false)} />
      </Drawer>

      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Header onMenuClick={() => setMobileOpen(true)} />
        <Box component="main" sx={{ flex: 1, p: { xs: 2, sm: 3, md: 4 } }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
