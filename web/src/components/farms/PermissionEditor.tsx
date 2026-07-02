"use client";

import { Box, Checkbox, Stack, Typography } from "@mui/material";
import { colors } from "@/theme/tokens";
import type { PermissionCatalog } from "@/types";

const VERBS = ["read", "write", "delete"] as const;
const VERB_LABELS: Record<string, string> = {
  read: "Lecture",
  write: "Écriture",
  delete: "Suppression",
};

/** Expand "resource:*" / "*" into the set of concrete "resource:verb" strings. */
export function expandPermissions(perms: string[], catalog: PermissionCatalog): Set<string> {
  const out = new Set<string>();
  const all = perms.includes("*");
  for (const r of catalog.resources) {
    for (const v of r.verbs) {
      if (all || perms.includes(`${r.resource}:*`) || perms.includes(`${r.resource}:${v}`)) {
        out.add(`${r.resource}:${v}`);
      }
    }
  }
  return out;
}

export function PermissionEditor({
  catalog,
  value,
  disabled,
  onChange,
}: {
  catalog: PermissionCatalog;
  value: string[];
  roleDefaults?: string[];
  disabled?: boolean;
  onChange: (next: string[]) => void;
}) {
  const selected = expandPermissions(value, catalog);

  const toggle = (perm: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(perm);
    else next.delete(perm);
    onChange([...next].sort());
  };

  return (
    <Box sx={{ border: `1px solid ${colors.neutral[200]}`, borderRadius: 2, overflow: "hidden" }}>
      {/* header */}
      <Stack
        direction="row"
        sx={{ px: 2, py: 1, bgcolor: colors.neutral[50], alignItems: "center" }}
      >
        <Typography variant="caption" sx={{ flex: 1, fontWeight: 600, color: colors.neutral[500] }}>
          Module
        </Typography>
        {VERBS.map((v) => (
          <Typography
            key={v}
            variant="caption"
            sx={{ width: 88, textAlign: "center", fontWeight: 600, color: colors.neutral[500] }}
          >
            {VERB_LABELS[v]}
          </Typography>
        ))}
      </Stack>
      {catalog.resources.map((r) => (
        <Stack
          key={r.resource}
          direction="row"
          sx={{
            px: 2,
            py: 0.5,
            alignItems: "center",
            borderTop: `1px solid ${colors.neutral[100]}`,
          }}
        >
          <Typography sx={{ flex: 1, fontWeight: 500 }}>{r.label}</Typography>
          {VERBS.map((v) => {
            const perm = `${r.resource}:${v}`;
            const supported = r.verbs.includes(v);
            return (
              <Box key={v} sx={{ width: 88, textAlign: "center" }}>
                {supported ? (
                  <Checkbox
                    size="small"
                    disabled={disabled}
                    checked={selected.has(perm)}
                    onChange={(e) => toggle(perm, e.target.checked)}
                    slotProps={{ input: { "aria-label": perm } as any }}
                    sx={{ color: colors.primary[400], "&.Mui-checked": { color: colors.primary[600] } }}
                  />
                ) : (
                  <Typography component="span" sx={{ color: colors.neutral[300] }}>
                    —
                  </Typography>
                )}
              </Box>
            );
          })}
        </Stack>
      ))}
    </Box>
  );
}
