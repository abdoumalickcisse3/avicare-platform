"use client";

import { Box, CircularProgress } from "@mui/material";
import { useSelectedFarm } from "@/hooks/useSelectedFarm";
import { JawdiChat } from "@/components/assistant/JawdiChat";

/**
 * Jawdi IA — the conversational advisor page. Any farm member reaches it; the
 * tools the assistant can use are RBAC-scoped server-side, so the same page
 * adapts to each role. Renders the immersive chat once a farm is resolved.
 */
export default function AssistantPage() {
  const { farmId, isLoading } = useSelectedFarm();

  if (farmId === undefined) {
    return (
      <Box sx={{ display: "grid", placeItems: "center", minHeight: "40vh" }}>
        {isLoading ? <CircularProgress /> : null}
      </Box>
    );
  }

  return <JawdiChat farmId={farmId} />;
}
