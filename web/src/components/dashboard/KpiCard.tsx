import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
import type { LucideIcon } from "lucide-react";

export interface KpiCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  /** Token colour (from `@/theme/tokens`) applied to the icon box. */
  tint: string;
}

/**
 * Reusable KPI stat card: label + prominent value + tinted icon box.
 * Colors must come from `@/theme/tokens` — no hardcoded hex in callers.
 */
export function KpiCard({ label, value, icon: Icon, tint }: KpiCardProps) {
  return (
    <Card>
      <CardContent>
        <Stack
          direction="row"
          sx={{ alignItems: "center", justifyContent: "space-between" }}
        >
          <Box>
            <Typography variant="caption" color="text.secondary">
              {label}
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>
              {value}
            </Typography>
          </Box>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: `${tint}1A`,
              color: tint,
            }}
          >
            <Icon size={22} />
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
