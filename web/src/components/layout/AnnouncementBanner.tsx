"use client";

import { useMemo, useState } from "react";
import { Alert, AlertTitle, Stack } from "@mui/material";
import { useGetActiveAnnouncementsQuery } from "@/store/api/announcementsApi";

const DISMISSED_KEY = "jawdi.announcements.dismissed";

const SEVERITY_TO_ALERT = {
  INFO: "info",
  WARNING: "warning",
  CRITICAL: "error",
} as const;

/** Ids this browser has already dismissed. Never throws — private windows deny storage. */
function readDismissed(): number[] {
  try {
    const raw = window.localStorage.getItem(DISMISSED_KEY);
    return raw ? (JSON.parse(raw) as number[]) : [];
  } catch {
    return [];
  }
}

/**
 * Platform announcements, shown above the app.
 *
 * Dismissal is per browser, not per account: it is a convenience, and storing it server-side would
 * mean a table and a write on every close for something nobody will audit. The announcement's own
 * end date is what actually retires it — a farmer who dismisses one still stops seeing it when it
 * expires, and a new browser sees it again while it is still live, which is the intent.
 */
export function AnnouncementBanner() {
  const { data: announcements = [] } = useGetActiveAnnouncementsQuery();
  const [dismissed, setDismissed] = useState<number[]>(() =>
    typeof window === "undefined" ? [] : readDismissed(),
  );

  const visible = useMemo(
    () => announcements.filter((a) => !dismissed.includes(a.id)),
    [announcements, dismissed],
  );

  const dismiss = (id: number) => {
    const next = [...dismissed, id];
    setDismissed(next);
    try {
      window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
    } catch {
      // Storage denied: the banner stays closed for this session and returns on the next load.
    }
  };

  if (visible.length === 0) return null;

  return (
    <Stack spacing={1} sx={{ mb: 2 }}>
      {visible.map((a) => (
        <Alert
          key={a.id}
          severity={SEVERITY_TO_ALERT[a.severity] ?? "info"}
          onClose={() => dismiss(a.id)}
        >
          <AlertTitle sx={{ fontWeight: 700 }}>{a.title}</AlertTitle>
          {a.body}
        </Alert>
      ))}
    </Stack>
  );
}
