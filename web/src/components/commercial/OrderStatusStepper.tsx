"use client";

import { Box, Stack, Typography } from "@mui/material";
import { Check, X } from "lucide-react";
import { ORDER_STATUS_FLOW } from "@/lib/commercial";
import { colors } from "@/theme/tokens";
import type { OrderStatus } from "@/types";

/**
 * Horizontal progress of one order across the D23 flow (PENDING → CONFIRMED →
 * IN_PROGRESS → DELIVERED). Per the commercial strategy this replaces a Kanban —
 * it shows where THIS order is, not a board to manage. A cancelled order shows a
 * single cancelled state instead of the flow.
 */
export function OrderStatusStepper({ status }: { status: OrderStatus }) {
  if (status === "CANCELLED") {
    return (
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", color: colors.neutral[500] }}>
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            bgcolor: colors.neutral[200],
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X size={16} />
        </Box>
        <Typography sx={{ fontWeight: 600 }}>Commande annulée</Typography>
      </Stack>
    );
  }

  const currentIndex = ORDER_STATUS_FLOW.findIndex((s) => s.status === status);

  return (
    <Stack direction="row" sx={{ alignItems: "center" }}>
      {ORDER_STATUS_FLOW.map((step, i) => {
        const done = i < currentIndex;
        const current = i === currentIndex;
        const active = done || current;
        const dot = active ? colors.primary[500] : colors.neutral[200];
        const text = active ? colors.primary[700] : colors.neutral[400];
        return (
          <Stack key={step.status} direction="row" sx={{ alignItems: "center", flex: i < ORDER_STATUS_FLOW.length - 1 ? 1 : "0 0 auto" }}>
            <Stack spacing={0.5} sx={{ alignItems: "center" }}>
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  bgcolor: dot,
                  color: colors.neutral[0],
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  fontWeight: 700,
                  border: current ? `2px solid ${colors.primary[700]}` : "none",
                }}
              >
                {done ? <Check size={15} /> : i + 1}
              </Box>
              <Typography variant="caption" sx={{ color: text, fontWeight: current ? 700 : 500 }}>
                {step.label}
              </Typography>
            </Stack>
            {i < ORDER_STATUS_FLOW.length - 1 && (
              <Box
                sx={{
                  flex: 1,
                  height: 2,
                  mx: 1,
                  mb: 2.5,
                  bgcolor: i < currentIndex ? colors.primary[500] : colors.neutral[200],
                }}
              />
            )}
          </Stack>
        );
      })}
    </Stack>
  );
}
