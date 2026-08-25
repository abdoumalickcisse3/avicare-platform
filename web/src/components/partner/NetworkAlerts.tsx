"use client";

import { Alert, AlertTitle, Stack } from "@mui/material";
import { useGetNetworkAlertsQuery } from "@/store/api/partnerApi";
import type { PartnerAlert } from "@/types";

/** CRITICAL reads as an error, everything else as a warning — nothing here is good news. */
function severityOf(alert: PartnerAlert): "error" | "warning" {
  return alert.severity === "CRITICAL" ? "error" : "warning";
}

/**
 * Open network alerts, above the dashboard. Renders nothing at all when there is none: an empty
 * "no alerts" panel would be noise on the screen a partner opens every week.
 */
export default function NetworkAlerts() {
  const { data: alerts = [] } = useGetNetworkAlertsQuery();

  if (alerts.length === 0) return null;

  return (
    <Stack spacing={1.5} sx={{ mb: 3 }}>
      {alerts.map((alert) => (
        <Alert key={alert.id} severity={severityOf(alert)} variant="outlined">
          <AlertTitle sx={{ fontWeight: 700, mb: 0.25 }}>{alert.title}</AlertTitle>
          {alert.body}
        </Alert>
      ))}
    </Stack>
  );
}
