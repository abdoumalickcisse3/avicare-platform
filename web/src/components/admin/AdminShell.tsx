"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from "@mui/material";
import {
  Activity,
  Bot,
  Building2,
  ChevronDown,
  Handshake,
  HeartPulse,
  Library,
  Megaphone,
  OctagonX,
  ShieldAlert,
  Radar,
  ScrollText,
  KeyRound,
  LogOut,
  Settings2,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";
import { useGetAdminMeQuery } from "@/store/api/adminApi";
import { adminTokenStorage } from "@/lib/adminStorage";
import { ChangePasswordForm } from "@/components/account/ChangePasswordForm";
import { colors } from "@/theme/tokens";

interface NavEntry {
  href: string;
  label: string;
  icon: typeof Building2;
  /** Permission required to see the entry; the wildcard covers everything. */
  permission: string;
}

interface NavGroup {
  label: string;
  icon: typeof Building2;
  entries: NavEntry[];
}

/**
 * Two entries stay one click away, on purpose.
 *
 * Pilotage is where the console opens. Urgence is the kill switch — burying an emergency control
 * inside a dropdown costs seconds at the exact moment they matter, so it keeps its own place in
 * the bar even though it makes the bar one item longer.
 */
const DIRECT: NavEntry[] = [
  { href: "/console/pilotage", label: "Pilotage", icon: Activity, permission: "metrics:read" },
  { href: "/console/urgence", label: "Urgence", icon: OctagonX, permission: "flags:manage" },
];

/**
 * Everything else is grouped by the question it answers: what is the platform doing (Supervision),
 * who is on it (Clients), what it offers them (Plateforme).
 *
 * Fourteen links on one row is what overflowed the header and pushed the title off-screen; three
 * dropdowns fit, and give the reader a shorter thing to scan.
 */
const GROUPS: NavGroup[] = [
  {
    label: "Supervision",
    icon: Radar,
    entries: [
      { href: "/console/traces", label: "Traces", icon: Radar, permission: "metrics:read" },
      {
        href: "/console/integrite",
        label: "Intégrité",
        icon: ShieldAlert,
        permission: "integrity:read",
      },
      {
        href: "/console/securite",
        label: "Sécurité",
        icon: ShieldCheck,
        permission: "security:read",
      },
      {
        href: "/console/conformite",
        label: "Conformité",
        icon: ScrollText,
        permission: "compliance:export",
      },
    ],
  },
  {
    label: "Clients",
    icon: Building2,
    entries: [
      { href: "/console/fermes", label: "Fermes", icon: Building2, permission: "tenants:read" },
      { href: "/console/utilisateurs", label: "Utilisateurs", icon: Users, permission: "users:read" },
      { href: "/console/sante", label: "Santé", icon: HeartPulse, permission: "tenants:read" },
      {
        href: "/console/partenaires",
        label: "Partenaires",
        icon: Handshake,
        permission: "partners:read",
      },
    ],
  },
  {
    label: "Plateforme",
    icon: Settings2,
    entries: [
      { href: "/console/catalogue", label: "Catalogue", icon: Library, permission: "catalog:write" },
      { href: "/console/assistant", label: "Assistant", icon: Bot, permission: "assistant:review" },
      {
        href: "/console/communication",
        label: "Communication",
        icon: Megaphone,
        permission: "broadcast:send",
      },
      { href: "/console/personnel", label: "Personnel", icon: UserCog, permission: "staff:manage" },
    ],
  },
];

function holds(permissions: string[], required: string): boolean {
  if (permissions.includes("*") || permissions.includes(required)) return true;
  const c = required.indexOf(":");
  return c > 0 && permissions.includes(`${required.slice(0, c)}:*`);
}

const linkSx = (active: boolean) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 0.75,
  whiteSpace: "nowrap" as const,
  color: active ? colors.neutral[0] : colors.neutral[300],
  fontWeight: active ? 700 : 500,
});

/** One dropdown. Renders nothing when the caller may use none of its entries. */
function NavMenu({ group, pathname }: { group: NavGroup; pathname: string }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const Icon = group.icon;
  // The group carries the active state of whichever child is open, so the reader still knows
  // where they are without opening the menu.
  const active = group.entries.some((e) => pathname.startsWith(e.href));

  return (
    <>
      <Button
        size="small"
        onClick={(e) => setAnchor(e.currentTarget)}
        startIcon={<Icon size={16} />}
        endIcon={<ChevronDown size={14} />}
        aria-haspopup="menu"
        aria-expanded={anchor !== null}
        sx={{ ...linkSx(active), textTransform: "none", fontSize: "0.875rem", px: 1 }}
      >
        {group.label}
      </Button>
      <Menu anchorEl={anchor} open={anchor !== null} onClose={() => setAnchor(null)}>
        {group.entries.map((e) => {
          const EntryIcon = e.icon;
          return (
            <MenuItem
              key={e.href}
              component={Link}
              href={e.href}
              onClick={() => setAnchor(null)}
              selected={pathname.startsWith(e.href)}
              sx={{ gap: 1.25, fontSize: "0.875rem" }}
            >
              <EntryIcon size={16} />
              {e.label}
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}

/**
 * Console shell: a permanently distinct dark header so the back-office is never mistaken for the
 * farmer app, and a navigation built from the caller's own permissions — an entry they cannot use
 * is not rendered at all, and a group whose every entry is out of reach disappears with them.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: me } = useGetAdminMeQuery();
  const [accountOpen, setAccountOpen] = useState(false);

  const permissions = useMemo(() => me?.permissions ?? [], [me]);

  const direct = useMemo(
    () => DIRECT.filter((e) => holds(permissions, e.permission)),
    [permissions],
  );

  const groups = useMemo(
    () =>
      GROUPS.map((g) => ({
        ...g,
        entries: g.entries.filter((e) => holds(permissions, e.permission)),
      })).filter((g) => g.entries.length > 0),
    [permissions],
  );

  const onLogout = () => {
    adminTokenStorage.clear();
    router.replace("/console/login");
  };

  return (
    <Box sx={{ minHeight: "100dvh" }}>
      <Box
        sx={{
          bgcolor: colors.neutral[900],
          color: colors.neutral[0],
          px: { xs: 2, md: 3 },
          py: 1.5,
        }}
      >
        <Stack
          direction="row"
          sx={{
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
            flexWrap: "wrap",
          }}
        >
          <Stack
            direction="row"
            sx={{ alignItems: "center", gap: 1.5, flexShrink: 0, minWidth: 0 }}
          >
            <ShieldCheck size={20} />
            <Typography sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>Console Jawdi</Typography>
            {me?.superAdmin && (
              <Chip
                size="small"
                label="Super-admin"
                sx={{ bgcolor: colors.neutral[700], color: colors.neutral[0] }}
              />
            )}
          </Stack>

          {/* Wraps rather than overflowing: a narrow window gets a second row, never a header
              scrolled off its own page. */}
          <Stack
            direction="row"
            component="nav"
            aria-label="Navigation de la console"
            sx={{ alignItems: "center", gap: 1.5, flexWrap: "wrap", minWidth: 0 }}
          >
            {direct.map((e) => {
              const Icon = e.icon;
              return (
                <Typography
                  key={e.href}
                  component={Link}
                  href={e.href}
                  variant="body2"
                  sx={linkSx(pathname.startsWith(e.href))}
                >
                  <Icon size={16} />
                  {e.label}
                </Typography>
              );
            })}

            {groups.map((g) => (
              <NavMenu key={g.label} group={g} pathname={pathname} />
            ))}

            <Button
              size="small"
              onClick={() => setAccountOpen(true)}
              startIcon={<KeyRound size={15} />}
              sx={{ color: colors.neutral[300], whiteSpace: "nowrap" }}
            >
              Mon compte
            </Button>
            <Button
              size="small"
              onClick={onLogout}
              startIcon={<LogOut size={15} />}
              sx={{ color: colors.neutral[300], whiteSpace: "nowrap" }}
            >
              Quitter
            </Button>
          </Stack>
        </Stack>
      </Box>

      <Box sx={{ maxWidth: 1200, mx: "auto", px: { xs: 2, md: 3 }, py: { xs: 3, md: 4 } }}>
        {children}
      </Box>

      <Dialog open={accountOpen} onClose={() => setAccountOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700 }}>{me?.email ?? "Mon compte"}</DialogTitle>
        <DialogContent>
          {/* The console has no profile to edit — a staff account is an identity, not a tenant
              member — so the password is the whole of it. */}
          <ChangePasswordForm
            onChanged={() => {
              // Every refresh token was revoked, this one included.
              setTimeout(() => {
                adminTokenStorage.clear();
                router.replace("/console/login");
              }, 1800);
            }}
          />
        </DialogContent>
      </Dialog>
    </Box>
  );
}
