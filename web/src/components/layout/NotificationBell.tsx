"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  Menu,
  Tooltip,
  Typography,
} from "@mui/material";
import { Bell, CheckCheck } from "lucide-react";
import {
  useGetNotificationsQuery,
  useGetUnreadCountQuery,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
} from "@/store/api/notificationsApi";
import type { AppNotification, NotificationSeverity } from "@/types";
import { colors } from "@/theme/tokens";

const SEVERITY_COLOR: Record<NotificationSeverity, string> = {
  INFO: colors.neutral[400],
  WARNING: colors.warning.main,
  CRITICAL: colors.error.main,
};

/** Deep-link a notification to the page its source lives on, from its sourceRef. */
function hrefFor(n: AppNotification): string | null {
  const ref = n.sourceRef ?? {};
  if (typeof ref.unitId === "number") return `/elevage/lots/${ref.unitId}`;
  if (typeof ref.purchaseOrderId === "number") return `/stocks/achats`;
  if (typeof ref.itemId === "number") return `/stocks`;
  if (typeof ref.invoiceId === "number") return `/commercial/factures`;
  if (typeof ref.clientId === "number") return `/commercial/clients`;
  return null;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  return `il y a ${d} j`;
}

export function NotificationBell({ farmId }: { farmId?: number }) {
  const router = useRouter();
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const open = Boolean(anchor);

  const { data: unread = 0 } = useGetUnreadCountQuery(
    { farmId: farmId as number },
    { skip: !farmId, pollingInterval: 60000 },
  );
  const { data: feed, isFetching } = useGetNotificationsQuery(
    { farmId: farmId as number, size: 12 },
    { skip: !farmId || !open },
  );
  const [markRead] = useMarkNotificationReadMutation();
  const [markAllRead] = useMarkAllNotificationsReadMutation();

  const items = feed?.items ?? [];

  const openItem = (n: AppNotification) => {
    if (farmId && !n.read) markRead({ farmId, id: n.id });
    const href = hrefFor(n);
    setAnchor(null);
    if (href) router.push(href);
  };

  return (
    <>
      <Tooltip title="Notifications">
        <span>
          <IconButton
            aria-label="Notifications"
            disabled={!farmId}
            onClick={(e) => setAnchor(e.currentTarget)}
            sx={{ color: colors.neutral[600] }}
          >
            <Badge badgeContent={unread} color="error" max={99}>
              <Bell size={20} />
            </Badge>
          </IconButton>
        </span>
      </Tooltip>

      <Menu
        anchorEl={anchor}
        open={open}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { width: 360, maxWidth: "90vw", maxHeight: 480 } } }}
      >
        <Box sx={{ px: 2, py: 1.25, display: "flex", alignItems: "center", gap: 1 }}>
          <Typography sx={{ fontWeight: 700, flex: 1 }}>Notifications</Typography>
          {unread > 0 && farmId && (
            <Button
              size="small"
              startIcon={<CheckCheck size={15} />}
              onClick={() => markAllRead({ farmId })}
              sx={{ textTransform: "none", color: colors.primary[600] }}
            >
              Tout lire
            </Button>
          )}
        </Box>
        <Divider />

        {isFetching && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
            <CircularProgress size={22} />
          </Box>
        )}

        {!isFetching && items.length === 0 && (
          <Box sx={{ px: 2, py: 4, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              Aucune notification
            </Typography>
          </Box>
        )}

        {!isFetching &&
          items.map((n) => (
            <Box
              key={n.id}
              onClick={() => openItem(n)}
              sx={{
                px: 2,
                py: 1.25,
                display: "flex",
                gap: 1.25,
                cursor: "pointer",
                bgcolor: n.read ? "transparent" : colors.primary[50],
                borderBottom: `1px solid ${colors.neutral[100]}`,
                "&:hover": { bgcolor: colors.neutral[50] },
              }}
            >
              <Box
                sx={{
                  mt: 0.75,
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  flexShrink: 0,
                  bgcolor: SEVERITY_COLOR[n.severity],
                }}
              />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontWeight: n.read ? 500 : 700, fontSize: "0.85rem" }} noWrap>
                  {n.title}
                </Typography>
                {n.body && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      fontSize: "0.8rem",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {n.body}
                  </Typography>
                )}
                <Typography variant="caption" sx={{ color: colors.neutral[400] }}>
                  {timeAgo(n.createdAt)}
                </Typography>
              </Box>
            </Box>
          ))}
      </Menu>
    </>
  );
}
