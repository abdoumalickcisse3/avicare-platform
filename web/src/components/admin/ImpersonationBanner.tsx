"use client";

import { useMemo, useSyncExternalStore } from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import { ShieldAlert } from "lucide-react";
import { impersonation } from "@/lib/impersonation";
import { useCloseImpersonationMutation } from "@/store/api/adminApi";
import { tokenStorage } from "@/lib/storage";
import { colors } from "@/theme/tokens";

const noopSubscribe = () => () => {};

/**
 * Permanent, non-dismissable banner shown while a staff member is acting as a farmer.
 *
 * Non-dismissable on purpose: forgetting you are inside someone else's account is how support
 * sessions turn into accidents. Leaving restores the staff member's own session rather than
 * logging them out.
 */
export function ImpersonationBanner() {
  // The snapshot is the raw string: useSyncExternalStore compares by reference, so returning a
  // freshly parsed object here would re-render forever.
  const raw = useSyncExternalStore(
    noopSubscribe,
    () => impersonation.raw(),
    () => null,
  );
  const state = useMemo(() => impersonation.parse(raw), [raw]);
  const [closeSession] = useCloseImpersonationMutation();

  if (!state) return null;

  const onExit = () => {
    // Best-effort: the trail wants both ends of a support session, but leaving one must never
    // hang on a request. The opening is recorded server-side regardless.
    closeSession({ userId: state.targetUserId }).unwrap().catch(() => {});
    if (state.previousAccess && state.previousRefresh) {
      tokenStorage.set(state.previousAccess, state.previousRefresh);
    } else {
      tokenStorage.clear();
    }
    impersonation.clear();
    window.location.href = "/console/utilisateurs";
  };

  return (
    <Box
      sx={{
        bgcolor: colors.warning.dark,
        color: "#fff",
        px: 2,
        py: 1,
        position: "sticky",
        top: 0,
        zIndex: 1300,
      }}
    >
      <Stack
        direction="row"
        sx={{ alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}
      >
        <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
          <ShieldAlert size={18} />
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            Mode support — vous agissez au nom de {state.targetLabel}
          </Typography>
        </Stack>
        <Button size="small" variant="outlined" onClick={onExit} sx={{ color: "#fff", borderColor: "#fff" }}>
          Quitter le mode support
        </Button>
      </Stack>
    </Box>
  );
}
